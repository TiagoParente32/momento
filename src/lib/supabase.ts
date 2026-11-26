import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getItem, KEYS } from './storage';

/**
 * Optional Supabase backend (auth + cloud sync), using the user's own Supabase project.
 * Configured only at runtime from Settings → Account (stored locally under KEYS.sync, never synced);
 * no project is ever baked into the build.
 * Only the public anon key is ever used client-side; data access is protected by RLS.
 */
export interface SupabaseConfig { url: string; anonKey: string; source: 'user' }

let client: SupabaseClient | null = null;
let clientKey = '';

export async function getSupabaseConfig(): Promise<SupabaseConfig | null> {
  const stored = await getItem<{ config?: { url?: string; anonKey?: string } }>(KEYS.sync);
  const url = stored?.config?.url?.trim();
  const anonKey = stored?.config?.anonKey?.trim();
  if (url && anonKey) return { url: url.replace(/\/$/, ''), anonKey, source: 'user' };
  return null;
}

/** Returns a cached client, or null when Supabase isn't configured. */
export async function getSupabase(): Promise<SupabaseClient | null> {
  const cfg = await getSupabaseConfig();
  if (!cfg) { client = null; clientKey = ''; return null; }
  const key = cfg.url + '|' + cfg.anonKey;
  if (!client || clientKey !== key) {
    client = createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'momento-auth' },
    });
    clientKey = key;
  }
  return client;
}

export function isValidSupabaseUrl(url: string) {
  try {
    const u = new URL(url.trim());
    return u.protocol === 'https:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  } catch { return false; }
}
