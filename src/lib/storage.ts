// Thin async key/value wrapper over chrome.storage.local, with a localStorage
// fallback so the pages also run under `vite dev` in a normal browser tab.

export const isExtension = typeof chrome !== 'undefined' && !!chrome.storage?.local;

type Listener = (value: unknown) => void;
const listeners = new Map<string, Set<Listener>>();

export async function getItem<T>(key: string): Promise<T | undefined> {
  if (isExtension) {
    const res = await chrome.storage.local.get(key);
    return res[key] as T | undefined;
  }
  const raw = localStorage.getItem(key);
  return raw == null ? undefined : (JSON.parse(raw) as T);
}

export async function setItem<T>(key: string, value: T): Promise<void> {
  if (isExtension) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }
  localStorage.setItem(key, JSON.stringify(value));
}

export async function removeItem(key: string): Promise<void> {
  if (isExtension) return chrome.storage.local.remove(key);
  localStorage.removeItem(key);
}

export async function getAll(): Promise<Record<string, unknown>> {
  if (isExtension) return chrome.storage.local.get(null);
  const out: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (!k.startsWith('momento:')) continue;
    try { out[k] = JSON.parse(localStorage.getItem(k)!); } catch { /* ignore */ }
  }
  return out;
}

export async function clearAll(): Promise<void> {
  if (isExtension) return chrome.storage.local.clear();
  Object.keys(localStorage).filter((k) => k.startsWith('momento:')).forEach((k) => localStorage.removeItem(k));
}

/** Subscribe to changes of a key made from any *other* extension context (tabs, popup, worker). */
export function onKeyChange(key: string, fn: Listener): () => void {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(fn);
  return () => { listeners.get(key)!.delete(fn); };
}

if (isExtension) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const [key, change] of Object.entries(changes)) {
      listeners.get(key)?.forEach((l) => l(change.newValue));
    }
  });
} else if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (!e.key) return;
    listeners.get(e.key)?.forEach((l) => l(e.newValue ? JSON.parse(e.newValue) : undefined));
  });
}

/** Storage keys. Every persisted store lives under one key. */
export const KEYS = {
  settings: 'momento:settings',
  tasks: 'momento:tasks',
  focus: 'momento:focus',
  blocker: 'momento:blocker',
  notes: 'momento:notes',
  tabs: 'momento:tabs',
  calendar: 'momento:calendar',
  countdowns: 'momento:countdowns',
  metrics: 'momento:metrics',
  inspiration: 'momento:inspiration',
  daily: 'momento:daily',
  clocks: 'momento:clocks',
  integrations: 'momento:integrations', // never synced (tokens)
  ai: 'momento:ai', // never synced (keys/endpoints)
  sync: 'momento:sync', // never synced (account config)
  weatherCache: 'momento:weatherCache', // never synced
  bgCache: 'momento:bgCache', // never synced
} as const;

/** Keys that are included in cloud sync and data export. */
export const SYNCED_KEYS: string[] = [
  KEYS.settings, KEYS.tasks, KEYS.focus, KEYS.blocker, KEYS.notes, KEYS.tabs, KEYS.calendar,
  KEYS.countdowns, KEYS.metrics, KEYS.inspiration, KEYS.daily, KEYS.clocks,
];
