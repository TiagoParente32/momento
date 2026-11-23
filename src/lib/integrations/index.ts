import { useIntegrations } from '@/stores/integrations';
import type { CalendarEvent, IntegrationId } from '@/lib/types';
import { googleCalendar, googleTasks } from './google';
import { outlook } from './outlook';
import { asana, basecamp, clickup, github, spotify, todoist, trello, youtube } from './tokens';
import { IntegrationError, type ExternalTask, type Integration } from './types';

export * from './types';
export { redirectUri } from './http';

export const INTEGRATIONS: Integration[] = [googleCalendar, outlook, googleTasks, todoist, trello, asana, clickup, github, basecamp, spotify, youtube];
export const getIntegration = (id: IntegrationId) => INTEGRATIONS.find((i) => i.id === id)!;

export type ConnectionStatus = 'connected' | 'expired' | 'error' | 'disconnected' | 'unavailable';

export function connectionStatus(id: IntegrationId): ConnectionStatus {
  const integ = getIntegration(id);
  if (integ.authType === 'unavailable') return 'unavailable';
  const c = useIntegrations.getState().connections[id];
  if (!c?.connected) return 'disconnected';
  if (c.expiresAt && Date.now() > c.expiresAt - 30_000) return 'expired';
  if (c.error) return 'error';
  return 'connected';
}

const isLive = (id: IntegrationId) => connectionStatus(id) === 'connected' || connectionStatus(id) === 'error';

export function hasCalendarConnection(): boolean {
  return (['google-calendar', 'outlook'] as IntegrationId[]).some((id) => connectionStatus(id) === 'connected');
}

/** Records success/failure on the connection. */
async function track<T>(id: IntegrationId, fn: () => Promise<T>): Promise<T> {
  try {
    const r = await fn();
    useIntegrations.getState().setConnection(id, { lastSync: new Date().toISOString(), error: undefined });
    return r;
  } catch (e: any) {
    useIntegrations.getState().setConnection(id, { error: e?.message ?? String(e) });
    throw e;
  }
}

/**
 * Fetches events from connected Google / Outlook calendars, merges them (source-tagged)
 * and stores them into the calendar store as external events.
 */
export async function syncExternalCalendars(from: Date, to: Date): Promise<CalendarEvent[]> {
  await useIntegrations.ready;
  const sources = [googleCalendar, outlook].filter((i) => isLive(i.id));
  const results = await Promise.allSettled(sources.map((i) => track(i.id, () => i.fetchEvents!(from, to))));
  const events = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  events.sort((a, b) => a.start.localeCompare(b.start));
  try {
    const mod = await import('@/stores/calendar');
    const cal = (mod as any).useCalendar?.getState?.();
    cal?.setExternal?.(events);
  } catch (e) {
    console.warn('[momento] calendar store unavailable', e);
  }
  const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
  if (failed.length && !events.length && sources.length) throw failed[0].reason;
  return events;
}

/** Open tasks from every connected task-capable integration. Failures are recorded per integration. */
export async function fetchExternalTasks(): Promise<ExternalTask[]> {
  await useIntegrations.ready;
  const sources = INTEGRATIONS.filter((i) => i.fetchTasks && isLive(i.id));
  const results = await Promise.allSettled(sources.map((i) => track(i.id, () => i.fetchTasks!())));
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}

export async function connectIntegration(id: IntegrationId, input: Parameters<NonNullable<Integration['connect']>>[0] = {}) {
  const integ = getIntegration(id);
  if (!integ.connect) throw new IntegrationError(integ.unavailableReason ?? 'This integration is not available.');
  await integ.connect(input);
  useIntegrations.getState().setConnection(id, { error: undefined, lastSync: new Date().toISOString() });
}

export async function disconnectIntegration(id: IntegrationId) {
  await getIntegration(id).disconnect?.();
  if (id === 'google-calendar' || id === 'outlook') {
    // drop that source's events from the calendar view
    try {
      const mod = await import('@/stores/calendar');
      const cal = (mod as any).useCalendar?.getState?.();
      if (cal?.setExternal) cal.setExternal((cal.external ?? []).filter((e: CalendarEvent) => e.source !== (id === 'outlook' ? 'outlook' : 'google')));
    } catch { /* ignore */ }
  }
}

export async function testIntegration(id: IntegrationId) {
  const integ = getIntegration(id);
  if (!integ.test) return;
  await track(id, () => integ.test!());
}
