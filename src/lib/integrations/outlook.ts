import { useIntegrations } from '@/stores/integrations';
import type { CalendarEvent } from '@/lib/types';
import { apiFetch, launchTokenFlow, redirectUri, requireToken } from './http';
import { IntegrationError, type Integration } from './types';

interface GraphEvent {
  id: string; subject?: string; bodyPreview?: string; isAllDay?: boolean; isCancelled?: boolean;
  start: { dateTime: string; timeZone: string }; end: { dateTime: string; timeZone: string };
  location?: { displayName?: string };
}

// Graph returns UTC times without a 'Z' when Prefer: outlook.timezone="UTC"
const utc = (s: string) => (/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : s + 'Z');

export const outlook: Integration = {
  id: 'outlook',
  name: 'Microsoft Outlook',
  description: 'Show events from your Outlook / Microsoft 365 calendar (read-only).',
  category: 'calendar',
  authType: 'oauth',
  oauthProvider: 'microsoft',
  docsUrl: 'https://learn.microsoft.com/graph/api/user-list-calendarview',
  async connect() {
    const clientId = useIntegrations.getState().clientIds.microsoft;
    if (!clientId) throw new IntegrationError('Add your Microsoft application (client) ID first.');
    const url = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'token');
    url.searchParams.set('redirect_uri', redirectUri());
    url.searchParams.set('scope', 'https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/User.Read');
    url.searchParams.set('response_mode', 'fragment');
    url.searchParams.set('prompt', 'select_account');
    const { token, expiresIn } = await launchTokenFlow(url.toString());
    useIntegrations.getState().setConnection('outlook', { connected: true, token, expiresAt: Date.now() + expiresIn * 1000, error: undefined });
  },
  async disconnect() { useIntegrations.getState().removeConnection('outlook'); },
  async test() {
    await apiFetch('outlook', 'https://graph.microsoft.com/v1.0/me', { headers: { Authorization: `Bearer ${requireToken('outlook')}` } });
  },
  async fetchEvents(from, to) {
    const url = new URL('https://graph.microsoft.com/v1.0/me/calendarView');
    url.searchParams.set('startDateTime', from.toISOString());
    url.searchParams.set('endDateTime', to.toISOString());
    url.searchParams.set('$top', '250');
    url.searchParams.set('$select', 'id,subject,bodyPreview,isAllDay,isCancelled,start,end,location');
    const data = await apiFetch<{ value: GraphEvent[] }>('outlook', url.toString(), {
      headers: { Authorization: `Bearer ${requireToken('outlook')}`, Prefer: 'outlook.timezone="UTC"' },
    });
    return (data.value ?? [])
      .filter((e) => !e.isCancelled)
      .map<CalendarEvent>((e) => ({
        id: `outlook:${e.id}`,
        externalId: e.id,
        title: e.subject || '(No title)',
        description: e.bodyPreview ?? '',
        location: e.location?.displayName || undefined,
        start: new Date(utc(e.start.dateTime)).toISOString(),
        end: new Date(utc(e.end.dateTime)).toISOString(),
        allDay: !!e.isAllDay,
        color: '#0078d4',
        reminderMin: null,
        source: 'outlook',
      }));
  },
};
