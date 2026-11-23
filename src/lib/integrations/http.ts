import { useIntegrations } from '@/stores/integrations';
import type { IntegrationId } from '@/lib/types';
import { IntegrationError } from './types';

/** Returns a live token for an integration, or throws a "reconnect" error. */
export function requireToken(id: IntegrationId): string {
  const c = useIntegrations.getState().connections[id];
  if (!c?.connected || !c.token) throw new IntegrationError('Not connected.', true);
  if (c.expiresAt && Date.now() > c.expiresAt - 30_000) {
    useIntegrations.getState().setConnection(id, { error: 'Session expired — reconnect to continue.' });
    throw new IntegrationError('Session expired — reconnect to continue.', true);
  }
  return c.token;
}

/** fetch JSON with readable errors; 401/403 marks the connection as needing reconnect. */
export async function apiFetch<T>(id: IntegrationId, url: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new IntegrationError('Network error — check your connection.');
  }
  if (res.status === 401 || res.status === 403) {
    const msg = res.status === 401 ? 'Authorisation was rejected — reconnect.' : 'Access denied — check the permissions granted.';
    useIntegrations.getState().setConnection(id, { error: msg });
    throw new IntegrationError(msg, true);
  }
  if (res.status === 429) throw new IntegrationError('Rate limited — try again in a minute.');
  if (!res.ok) {
    let detail = '';
    try { const b = await res.json(); detail = b?.error?.message ?? b?.message ?? b?.error ?? ''; } catch { /* ignore */ }
    throw new IntegrationError(`Request failed (${res.status})${detail ? `: ${detail}` : ''}`);
  }
  return res.json() as Promise<T>;
}

/** OAuth 2.0 implicit/token flow through chrome.identity (opens the provider's consent window). */
export async function launchTokenFlow(authorizeUrl: string): Promise<{ token: string; expiresIn: number }> {
  if (typeof chrome === 'undefined' || !chrome.identity?.launchWebAuthFlow) {
    throw new IntegrationError('OAuth sign-in only works inside the installed extension.');
  }
  let redirect: string | undefined;
  try {
    redirect = await chrome.identity.launchWebAuthFlow({ url: authorizeUrl, interactive: true });
  } catch (e: any) {
    throw new IntegrationError(e?.message?.includes('did not approve') || e?.message?.includes('closed') ? 'Sign-in was cancelled.' : `Sign-in failed: ${e?.message ?? e}`);
  }
  if (!redirect) throw new IntegrationError('Sign-in was cancelled.');
  const hash = new URLSearchParams(new URL(redirect).hash.slice(1));
  const err = hash.get('error_description') ?? hash.get('error') ?? new URL(redirect).searchParams.get('error');
  if (err) throw new IntegrationError(`Provider returned an error: ${err}`);
  const token = hash.get('access_token');
  if (!token) throw new IntegrationError('No access token returned by the provider.');
  return { token, expiresIn: Number(hash.get('expires_in') ?? 3600) };
}

export const redirectUri = () =>
  typeof chrome !== 'undefined' && chrome.identity?.getRedirectURL ? chrome.identity.getRedirectURL() : 'https://<extension-id>.chromiumapp.org/';
