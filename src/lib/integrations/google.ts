import { useIntegrations } from '@/stores/integrations';
import type { CalendarEvent, IntegrationId } from '@/lib/types';
import { apiFetch, launchTokenFlow, redirectUri, requireToken } from './http';
import { IntegrationError, type ExternalTask, type Integration } from './types';

const SCOPES: Record<'google-calendar' | 'google-tasks', string> = {
  'google-calendar': 'https://www.googleapis.com/auth/calendar.readonly',
  'google-tasks': 'https://www.googleapis.com/auth/tasks.readonly',
};

async function googleConnect(id: 'google-calendar' | 'google-tasks') {
  const clientId = useIntegrations.getState().clientIds.google;
  if (!clientId) throw new IntegrationError('Add your Google OAuth client ID first (see the setup steps).');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'token');
  url.searchParams.set('redirect_uri', redirectUri());
  url.searchParams.set('scope', SCOPES[id]);
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('prompt', 'consent');
  const { token, expiresIn } = await launchTokenFlow(url.toString());
  useIntegrations.getState().setConnection(id, { connected: true, token, expiresAt: Date.now() + expiresIn * 1000, error: undefined });
}

async function revoke(id: IntegrationId) {
  const token = useIntegrations.getState().connections[id]?.token;
  if (token) fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => {});
  useIntegrations.getState().removeConnection(id);
}

const auth = (id: IntegrationId) => ({ headers: { Authorization: `Bearer ${requireToken(id)}` } });

interface GEvent {
  id: string; summary?: string; description?: string; location?: string; status?: string;
  start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string };
}

export const googleCalendar: Integration = {
  id: 'google-calendar',
  name: 'Google Calendar',
  description: 'Show events from your primary Google Calendar (read-only).',
  category: 'calendar',
  authType: 'oauth',
  oauthProvider: 'google',
  docsUrl: 'https://developers.google.com/calendar/api',
  connect: () => googleConnect('google-calendar'),
  disconnect: () => revoke('google-calendar'),
  async test() {
    await apiFetch('google-calendar', 'https://www.googleapis.com/calendar/v3/calendars/primary', auth('google-calendar'));
  },
  async fetchEvents(from, to) {
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.set('timeMin', from.toISOString());
    url.searchParams.set('timeMax', to.toISOString());
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '250');
    const data = await apiFetch<{ items: GEvent[] }>('google-calendar', url.toString(), auth('google-calendar'));
    return (data.items ?? [])
      .filter((e) => e.status !== 'cancelled')
      .map<CalendarEvent>((e) => {
        const allDay = !!e.start.date;
        return {
          id: `google:${e.id}`,
          externalId: e.id,
          title: e.summary || '(No title)',
          description: e.description ?? '',
          location: e.location,
          start: allDay ? new Date(e.start.date + 'T00:00:00').toISOString() : e.start.dateTime!,
          end: allDay ? new Date(e.end.date + 'T00:00:00').toISOString() : e.end.dateTime!,
          allDay,
          color: '#4285f4',
          reminderMin: null,
          source: 'google',
        };
      });
  },
};

export const googleTasks: Integration = {
  id: 'google-tasks',
  name: 'Google Tasks',
  description: 'Import open tasks from your Google Tasks lists (read-only).',
  category: 'tasks',
  authType: 'oauth',
  oauthProvider: 'google',
  docsUrl: 'https://developers.google.com/tasks',
  connect: () => googleConnect('google-tasks'),
  disconnect: () => revoke('google-tasks'),
  async test() {
    await apiFetch('google-tasks', 'https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=1', auth('google-tasks'));
  },
  async fetchTasks() {
    const lists = await apiFetch<{ items?: { id: string; title: string }[] }>('google-tasks', 'https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=50', auth('google-tasks'));
    const out: ExternalTask[] = [];
    for (const l of lists.items ?? []) {
      const t = await apiFetch<{ items?: { id: string; title: string; due?: string; webViewLink?: string }[] }>(
        'google-tasks',
        `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(l.id)}/tasks?showCompleted=false&maxResults=100`,
        auth('google-tasks'),
      );
      for (const task of t.items ?? []) {
        if (!task.title?.trim()) continue;
        out.push({ integration: 'google-tasks', id: task.id, title: task.title, due: task.due ? task.due.slice(0, 10) : null, url: task.webViewLink });
      }
    }
    return out;
  },
};
