import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { createPersisted } from './persist';
import { getAll, getItem, KEYS, setItem, SYNCED_KEYS, isExtension, clearAll } from './storage';
import { getSupabase, getSupabaseConfig } from './supabase';
import { debounce, hashString } from './utils';

/**
 * Account + cloud sync (Supabase). One row per user in `momento_state`
 * holding every SYNCED_KEYS value. Conflict policy: last write wins, decided by
 * comparing the remote `updated_at` with the time of this device's last local change.
 */

// ---------- persisted sync config (KEYS.sync – local only, never synced) ----------
export const useSyncConfig = createPersisted(
  KEYS.sync,
  {
    config: { url: '', anonKey: '' },
    autoSync: true,
    lastSyncedAt: null as string | null,
    lastSyncedHash: '' as string,
    localChangedAt: null as string | null,
  },
  (set) => ({
    setConfig(url: string, anonKey: string) { set({ config: { url: url.trim(), anonKey: anonKey.trim() } }); },
    setAutoSync(v: boolean) { set({ autoSync: v }); },
    markSynced(at: string, hash: string) { set({ lastSyncedAt: at, lastSyncedHash: hash, localChangedAt: null }); },
    markLocalChange() { set({ localChangedAt: new Date().toISOString() }); },
  }),
);

// ---------- live auth state (memory) ----------
interface AuthState {
  ready: boolean;
  configured: boolean;
  user: User | null;
  session: Session | null;
  syncing: boolean;
  syncError: string | null;
}
export const useAuth = create<AuthState>(() => ({ ready: false, configured: false, user: null, session: null, syncing: false, syncError: null }));

let authUnsub: (() => void) | null = null;

/** Initialise auth listener. Safe to call repeatedly (e.g. after config change). */
export async function initAuth() {
  authUnsub?.();
  authUnsub = null;
  const sb = await getSupabase();
  if (!sb) { useAuth.setState({ ready: true, configured: false, user: null, session: null }); return; }
  const { data } = await sb.auth.getSession();
  useAuth.setState({ ready: true, configured: true, session: data.session, user: data.session?.user ?? null });
  const { data: sub } = sb.auth.onAuthStateChange((_evt, session) => {
    useAuth.setState({ session, user: session?.user ?? null });
  });
  authUnsub = () => sub.subscription.unsubscribe();
  if (data.session) void syncNow().catch(() => {});
}

async function requireClient() {
  const sb = await getSupabase();
  if (!sb) throw new Error('Cloud sync is not configured. Add your Supabase project URL and anon key first.');
  return sb;
}

// ---------- auth actions ----------
export async function register(email: string, password: string, name?: string) {
  const sb = await requireClient();
  const { data, error } = await sb.auth.signUp({ email, password, options: { data: { display_name: name ?? '' } } });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}

export async function login(email: string, password: string) {
  const sb = await requireClient();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await syncNow();
}

export async function logout() {
  const sb = await requireClient();
  const { error } = await sb.auth.signOut();
  if (error) throw error;
  useAuth.setState({ user: null, session: null });
}

export async function sendPasswordReset(email: string) {
  const sb = await requireClient();
  const { error } = await sb.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const sb = await requireClient();
  const { error } = await sb.auth.updateUser({ password });
  if (error) throw error;
}

/** Saves display name into auth metadata and local settings.name */
export async function updateProfile(displayName: string) {
  const sb = await getSupabase();
  if (sb && useAuth.getState().user) {
    const { error } = await sb.auth.updateUser({ data: { display_name: displayName } });
    if (error) throw error;
  }
  const raw = (await getItem<{ settings: Record<string, unknown> }>(KEYS.settings)) ?? { settings: {} };
  await setItem(KEYS.settings, { ...raw, settings: { ...raw.settings, name: displayName } });
}

// ---------- push / pull ----------
async function snapshot() {
  const all = await getAll();
  const data: Record<string, unknown> = {};
  for (const k of SYNCED_KEYS) if (all[k] !== undefined) data[k] = all[k];
  return data;
}
const hashData = (d: unknown) => String(hashString(JSON.stringify(d)));

let applyingRemote = false;

async function applyRemote(data: Record<string, unknown>) {
  applyingRemote = true;
  try {
    for (const k of SYNCED_KEYS) if (data[k] !== undefined) await setItem(k, data[k]);
  } finally {
    // storage change events fire async; release the guard after they flush
    setTimeout(() => { applyingRemote = false; }, 500);
  }
}

export async function push() {
  const sb = await requireClient();
  const user = useAuth.getState().user;
  if (!user) throw new Error('Sign in to sync.');
  const data = await snapshot();
  const hash = hashData(data);
  const now = new Date().toISOString();
  const { error } = await sb.from('momento_state').upsert({ user_id: user.id, data, updated_at: now }, { onConflict: 'user_id' });
  if (error) throw error;
  useSyncConfig.getState().markSynced(now, hash);
  await useSyncConfig.flush();
}

/** Full two-way sync with last-write-wins. */
export async function syncNow(): Promise<'pushed' | 'pulled' | 'unchanged'> {
  const sb = await requireClient();
  const user = useAuth.getState().user;
  if (!user) throw new Error('Sign in to sync.');
  useAuth.setState({ syncing: true, syncError: null });
  try {
    await useSyncConfig.ready;
    const { data: row, error } = await sb.from('momento_state').select('data, updated_at').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    const cfg = useSyncConfig.getState();
    const local = await snapshot();
    const localHash = hashData(local);

    if (!row) { await push(); return 'pushed'; }

    const remoteAt = new Date(row.updated_at).getTime();
    const lastSynced = cfg.lastSyncedAt ? new Date(cfg.lastSyncedAt).getTime() : 0;
    const localChanged = localHash !== cfg.lastSyncedHash;
    const localAt = cfg.localChangedAt ? new Date(cfg.localChangedAt).getTime() : localChanged ? Date.now() : 0;

    if (remoteAt > lastSynced && (!localChanged || remoteAt > localAt)) {
      await applyRemote(row.data as Record<string, unknown>);
      useSyncConfig.getState().markSynced(row.updated_at, hashData(row.data));
      await useSyncConfig.flush();
      return 'pulled';
    }
    if (localChanged) { await push(); return 'pushed'; }
    return 'unchanged';
  } catch (e: any) {
    useAuth.setState({ syncError: e?.message ?? String(e) });
    throw e;
  } finally {
    useAuth.setState({ syncing: false });
  }
}

/** Delete the user's synced row (keeps the account). */
export async function deleteCloudData() {
  const sb = await requireClient();
  const user = useAuth.getState().user;
  if (!user) throw new Error('Not signed in.');
  const { error } = await sb.from('momento_state').delete().eq('user_id', user.id);
  if (error) throw error;
}

/** Permanently delete the auth account (server-side edge function) and wipe local data. */
export async function deleteAccount() {
  const sb = await requireClient();
  const cfg = await getSupabaseConfig();
  const session = useAuth.getState().session;
  if (!session || !cfg) throw new Error('Not signed in.');
  const res = await fetch(`${cfg.url}/functions/v1/delete-account`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, apikey: cfg.anonKey, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Account deletion failed (${res.status}). Is the delete-account function deployed?`);
  }
  await sb.auth.signOut().catch(() => {});
  await clearAll();
  useAuth.setState({ user: null, session: null });
}

// ---------- auto sync ----------
let autoStarted = false;
const debouncedPush = debounce(() => {
  if (!useAuth.getState().user || !useSyncConfig.getState().autoSync) return;
  push().catch((e) => useAuth.setState({ syncError: e?.message ?? String(e) }));
}, 5000);

/** Watch local changes to synced keys and push them (debounced) while signed in. */
export function startAutoSync() {
  if (autoStarted) return;
  autoStarted = true;
  const onChange = (keys: string[]) => {
    if (applyingRemote) return;
    if (!keys.some((k) => SYNCED_KEYS.includes(k))) return;
    if (!useAuth.getState().user) return;
    useSyncConfig.getState().markLocalChange();
    debouncedPush();
  };
  if (isExtension) {
    chrome.storage.onChanged.addListener((changes, area) => area === 'local' && onChange(Object.keys(changes)));
  } else {
    window.addEventListener('storage', (e) => e.key && onChange([e.key]));
  }
  // pull periodically so other devices' changes arrive
  setInterval(() => { if (useAuth.getState().user && useSyncConfig.getState().autoSync) syncNow().catch(() => {}); }, 10 * 60 * 1000);
  void initAuth();
}
