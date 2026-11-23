import { useIntegrations } from '@/stores/integrations';
import type { IntegrationId } from '@/lib/types';
import { apiFetch, requireToken } from './http';
import { IntegrationError, type ConnectInput, type ExternalTask, type Integration } from './types';

/** Shared connect/disconnect for personal-access-token integrations: save, then verify. */
function tokenAuth(id: IntegrationId, test: () => Promise<void>, needsKey = false) {
  return {
    async connect(input: ConnectInput) {
      const token = input.token?.trim();
      if (!token) throw new IntegrationError('Enter a token.');
      if (needsKey && !input.key?.trim()) throw new IntegrationError('Enter your API key.');
      const store = useIntegrations.getState();
      store.setConnection(id, { connected: true, token, meta: needsKey ? { key: input.key!.trim() } : undefined, error: undefined });
      try {
        await test();
      } catch (e) {
        store.removeConnection(id);
        throw e instanceof IntegrationError ? new IntegrationError(`Could not verify credentials: ${e.message}`) : e;
      }
    },
    async disconnect() { useIntegrations.getState().removeConnection(id); },
    test,
  };
}

// ---------- Todoist (API v1) ----------
const todoistHeaders = () => ({ headers: { Authorization: `Bearer ${requireToken('todoist')}` } });
interface TodoistTask { id: string; content: string; due?: { date?: string } | null; checked?: boolean }
const todoistTest = async () => { await apiFetch('todoist', 'https://api.todoist.com/api/v1/tasks?limit=1', todoistHeaders()); };
export const todoist: Integration = {
  id: 'todoist',
  name: 'Todoist',
  description: 'Import your open Todoist tasks.',
  category: 'tasks',
  authType: 'token',
  fields: [{ name: 'token', label: 'API token', secret: true, help: 'Todoist → Settings → Integrations → Developer → API token' }],
  docsUrl: 'https://developer.todoist.com/api/v1/',
  ...tokenAuth('todoist', todoistTest),
  async fetchTasks() {
    const out: ExternalTask[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 10; page++) {
      const url = new URL('https://api.todoist.com/api/v1/tasks');
      url.searchParams.set('limit', '200');
      if (cursor) url.searchParams.set('cursor', cursor);
      const data = await apiFetch<{ results?: TodoistTask[]; next_cursor?: string | null } | TodoistTask[]>('todoist', url.toString(), todoistHeaders());
      const items = Array.isArray(data) ? data : data.results ?? [];
      for (const t of items) {
        if (t.checked) continue;
        out.push({ integration: 'todoist', id: t.id, title: t.content, due: t.due?.date?.slice(0, 10) ?? null, url: `https://app.todoist.com/app/task/${t.id}` });
      }
      cursor = Array.isArray(data) ? null : data.next_cursor ?? null;
      if (!cursor) break;
    }
    return out;
  },
};

// ---------- GitHub ----------
const ghHeaders = () => ({ headers: { Authorization: `Bearer ${requireToken('github')}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
const ghTest = async () => { await apiFetch('github', 'https://api.github.com/user', ghHeaders()); };
export const github: Integration = {
  id: 'github',
  name: 'GitHub',
  description: 'See issues and pull requests assigned to you.',
  category: 'dev',
  authType: 'token',
  fields: [{ name: 'token', label: 'Personal access token', secret: true, help: 'Fine-grained token with read access to Issues and Pull requests' }],
  docsUrl: 'https://docs.github.com/rest/issues/issues#list-issues-assigned-to-the-authenticated-user',
  ...tokenAuth('github', ghTest),
  async fetchTasks() {
    const items = await apiFetch<{ id: number; title: string; html_url: string; number: number; repository?: { full_name: string }; pull_request?: unknown }[]>(
      'github', 'https://api.github.com/issues?filter=assigned&state=open&per_page=50', ghHeaders(),
    );
    return items.map((i) => ({
      integration: 'github' as const,
      id: String(i.id),
      title: `${i.pull_request ? 'PR' : 'Issue'} ${i.repository?.full_name ?? ''}#${i.number}: ${i.title}`,
      url: i.html_url,
      due: null,
    }));
  },
};

// ---------- Trello ----------
const trelloAuth = () => {
  const c = useIntegrations.getState().connections.trello;
  return `key=${encodeURIComponent(c?.meta?.key ?? '')}&token=${encodeURIComponent(requireToken('trello'))}`;
};
const trelloTest = async () => { await apiFetch('trello', `https://api.trello.com/1/members/me?fields=username&${trelloAuth()}`); };
export const trello: Integration = {
  id: 'trello',
  name: 'Trello',
  description: 'Import open cards assigned to you.',
  category: 'tasks',
  authType: 'token',
  fields: [
    { name: 'key', label: 'API key', help: 'From your Trello Power-Up admin page (trello.com/power-ups/admin)' },
    { name: 'token', label: 'Token', secret: true, help: 'Generate a token from the same page' },
  ],
  docsUrl: 'https://developer.atlassian.com/cloud/trello/guides/rest-api/api-introduction/',
  ...tokenAuth('trello', trelloTest, true),
  async fetchTasks() {
    const cards = await apiFetch<{ id: string; name: string; shortUrl: string; due: string | null; closed: boolean }[]>(
      'trello', `https://api.trello.com/1/members/me/cards?filter=open&fields=name,shortUrl,due,closed&${trelloAuth()}`,
    );
    return cards.filter((c) => !c.closed).map((c) => ({ integration: 'trello' as const, id: c.id, title: c.name, url: c.shortUrl, due: c.due ? c.due.slice(0, 10) : null }));
  },
};

// ---------- Asana ----------
const asanaHeaders = () => ({ headers: { Authorization: `Bearer ${requireToken('asana')}`, Accept: 'application/json' } });
const asanaTest = async () => { await apiFetch('asana', 'https://app.asana.com/api/1.0/users/me', asanaHeaders()); };
export const asana: Integration = {
  id: 'asana',
  name: 'Asana',
  description: 'Import incomplete tasks assigned to you (first workspace).',
  category: 'tasks',
  authType: 'token',
  fields: [{ name: 'token', label: 'Personal access token', secret: true, help: 'Asana → My settings → Apps → Developer apps → Personal access tokens' }],
  docsUrl: 'https://developers.asana.com/reference/gettasks',
  ...tokenAuth('asana', asanaTest),
  async fetchTasks() {
    const me = await apiFetch<{ data: { workspaces: { gid: string }[] } }>('asana', 'https://app.asana.com/api/1.0/users/me', asanaHeaders());
    const ws = me.data.workspaces?.[0]?.gid;
    if (!ws) return [];
    const url = `https://app.asana.com/api/1.0/tasks?assignee=me&workspace=${ws}&completed_since=now&limit=100&opt_fields=name,due_on,permalink_url`;
    const res = await apiFetch<{ data: { gid: string; name: string; due_on: string | null; permalink_url: string }[] }>('asana', url, asanaHeaders());
    return res.data.filter((t) => t.name).map((t) => ({ integration: 'asana' as const, id: t.gid, title: t.name, url: t.permalink_url, due: t.due_on }));
  },
};

// ---------- ClickUp ----------
const cuHeaders = () => ({ headers: { Authorization: requireToken('clickup') } });
const cuTest = async () => { await apiFetch('clickup', 'https://api.clickup.com/api/v2/user', cuHeaders()); };
export const clickup: Integration = {
  id: 'clickup',
  name: 'ClickUp',
  description: 'Import open tasks assigned to you (first workspace).',
  category: 'tasks',
  authType: 'token',
  fields: [{ name: 'token', label: 'Personal API token', secret: true, help: 'ClickUp → Settings → Apps → API Token (starts with pk_)' }],
  docsUrl: 'https://clickup.com/api/',
  ...tokenAuth('clickup', cuTest),
  async fetchTasks() {
    const me = await apiFetch<{ user: { id: number } }>('clickup', 'https://api.clickup.com/api/v2/user', cuHeaders());
    const teams = await apiFetch<{ teams: { id: string }[] }>('clickup', 'https://api.clickup.com/api/v2/team', cuHeaders());
    const team = teams.teams?.[0]?.id;
    if (!team) return [];
    const res = await apiFetch<{ tasks: { id: string; name: string; url: string; due_date: string | null }[] }>(
      'clickup', `https://api.clickup.com/api/v2/team/${team}/task?assignees[]=${me.user.id}&include_closed=false&subtasks=true`, cuHeaders(),
    );
    return res.tasks.map((t) => ({
      integration: 'clickup' as const, id: t.id, title: t.name, url: t.url,
      due: t.due_date ? new Date(Number(t.due_date)).toISOString().slice(0, 10) : null,
    }));
  },
};

// ---------- Not yet supported (honest placeholders) ----------
const unavailable = (id: IntegrationId, name: string, description: string, category: Integration['category'], reason: string, docsUrl: string): Integration => ({
  id, name, description, category, authType: 'unavailable', unavailableReason: reason, docsUrl,
});

export const basecamp = unavailable('basecamp', 'Basecamp', 'To-dos from your Basecamp projects.', 'tasks',
  'Basecamp requires registering a developer app with a server-side OAuth token exchange (no client-only flow). Not yet supported.',
  'https://github.com/basecamp/bc3-api');
export const spotify = unavailable('spotify', 'Spotify', 'Focus playlists and playback controls.', 'media',
  'Requires registering a Spotify developer app and a PKCE OAuth flow; playback control also needs Spotify Premium. Not yet supported.',
  'https://developer.spotify.com/documentation/web-api');
export const youtube = unavailable('youtube', 'YouTube', 'Focus music and saved playlists.', 'media',
  'Requires registering a Google Cloud project with the YouTube Data API and app verification for its scopes. Not yet supported.',
  'https://developers.google.com/youtube/v3');
