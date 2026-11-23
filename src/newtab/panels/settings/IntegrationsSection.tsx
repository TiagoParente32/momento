import { useState } from 'react';
import { Plug, Unplug, RefreshCw, ExternalLink, Copy, Download, CheckCircle2, AlertCircle, Clock, Ban } from 'lucide-react';
import { Badge, Button, Field, Input, Modal, Spinner, toast, confirmDialog } from '@/components/ui';
import { useIntegrations } from '@/stores/integrations';
import { useTasks } from '@/stores/tasks';
import {
  INTEGRATIONS, connectIntegration, connectionStatus, disconnectIntegration, fetchExternalTasks, redirectUri,
  syncExternalCalendars, testIntegration, type ConnectInput, type ExternalTask, type Integration, type ConnectionStatus,
} from '@/lib/integrations';
import { addDays, startOfDay } from '@/lib/utils';
import { Group, Note, Section } from './common';

const STATUS: Record<ConnectionStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  connected: { label: 'Connected', color: '#22c55e', icon: CheckCircle2 },
  expired: { label: 'Reconnect needed', color: '#f59e0b', icon: Clock },
  error: { label: 'Error', color: '#ef4444', icon: AlertCircle },
  disconnected: { label: 'Not connected', color: '#94a3b8', icon: Plug },
  unavailable: { label: 'Not available yet', color: '#94a3b8', icon: Ban },
};

export function IntegrationsSection() {
  // subscribe so cards re-render when connections change
  useIntegrations((s) => s.connections);
  const clientIds = useIntegrations((s) => s.clientIds);
  const [connecting, setConnecting] = useState<Integration | null>(null);

  return (
    <Section title="Integrations" description="Connect calendars and task apps through their official APIs. Credentials stay on this device and are never synced.">
      <OAuthSetup clientIds={clientIds} />

      {(['calendar', 'tasks', 'dev', 'media'] as const).map((cat) => (
        <Group key={cat} title={{ calendar: 'Calendars', tasks: 'Task managers', dev: 'Developer', media: 'Media' }[cat]}>
          <div className="space-y-2">
            {INTEGRATIONS.filter((i) => i.category === cat).map((i) => (
              <IntegrationCard key={i.id} integ={i} onConnect={() => setConnecting(i)} />
            ))}
          </div>
        </Group>
      ))}

      <ExternalTasks />

      <ConnectModal integ={connecting} onClose={() => setConnecting(null)} />
    </Section>
  );
}

function OAuthSetup({ clientIds }: { clientIds: { google: string; microsoft: string } }) {
  const [google, setGoogle] = useState(clientIds.google);
  const [ms, setMs] = useState(clientIds.microsoft);
  const uri = redirectUri();
  const copy = () => navigator.clipboard.writeText(uri).then(() => toast('Redirect URI copied', 'success'));
  return (
    <Group title="OAuth setup (Google & Microsoft)" description="Calendar sign-in uses your own OAuth app so no third party ever sees your tokens.">
      <Note>
        <p><b>Redirect URI</b> — register this exactly in your OAuth app:</p>
        <p className="mt-1 flex items-center gap-2"><code className="break-all">{uri}</code>
          <button onClick={copy} className="rounded p-1 hover:bg-ink/10" aria-label="Copy redirect URI"><Copy className="h-3.5 w-3.5" /></button></p>
        <p className="mt-2"><b>Google:</b> Google Cloud Console → APIs & Services → enable Calendar API and Tasks API → Credentials → OAuth client ID → type <i>Web application</i> → add the redirect URI.</p>
        <p className="mt-1"><b>Microsoft:</b> Entra admin centre → App registrations → New → platform <i>Single-page application</i> with the redirect URI, enable access tokens (implicit grant), API permission <code>Calendars.Read</code>.</p>
      </Note>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
        e.preventDefault();
        useIntegrations.getState().setClientId('google', google);
        useIntegrations.getState().setClientId('microsoft', ms);
        toast('Client IDs saved', 'success');
      }}>
        <Field label="Google OAuth client ID"><Input value={google} onChange={(e) => setGoogle(e.target.value)} placeholder="…apps.googleusercontent.com" /></Field>
        <Field label="Microsoft application (client) ID"><Input value={ms} onChange={(e) => setMs(e.target.value)} placeholder="00000000-0000-…" /></Field>
        <div><Button type="submit" size="sm" variant="primary" disabled={google === clientIds.google && ms === clientIds.microsoft}>Save client IDs</Button></div>
      </form>
    </Group>
  );
}

function IntegrationCard({ integ, onConnect }: { integ: Integration; onConnect: () => void }) {
  const status = connectionStatus(integ.id);
  const conn = useIntegrations.getState().connections[integ.id];
  const [busy, setBusy] = useState<string | null>(null);
  const S = STATUS[status];

  const run = async (label: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(label);
    try { await fn(); if (ok) toast(ok, 'success'); } catch (e: any) { toast(e?.message ?? 'Something went wrong', 'error'); } finally { setBusy(null); }
  };

  const connect = () => {
    if (integ.authType === 'oauth') {
      const id = integ.oauthProvider === 'google' ? useIntegrations.getState().clientIds.google : useIntegrations.getState().clientIds.microsoft;
      if (!id) { toast(`Add your ${integ.oauthProvider === 'google' ? 'Google' : 'Microsoft'} client ID above first`, 'error'); return; }
      void run('connect', async () => {
        await connectIntegration(integ.id);
        if (integ.fetchEvents) await syncExternalCalendars(startOfDay(addDays(new Date(), -30)), addDays(new Date(), 90));
      }, `${integ.name} connected`);
    } else onConnect();
  };

  return (
    <div className="rounded-xl border border-line/10 p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{integ.name}</p>
            <Badge color={S.color}><S.icon className="h-3 w-3" /> {S.label}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted">{integ.description}</p>
          {status === 'unavailable' && <p className="mt-1 text-xs text-muted">{integ.unavailableReason}</p>}
          {conn?.error && status !== 'disconnected' && <p className="mt-1 text-xs text-red-500">{conn.error}</p>}
          {conn?.lastSync && status === 'connected' && <p className="mt-1 text-[11px] text-muted">Last synced {new Date(conn.lastSync).toLocaleString()}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {integ.docsUrl && (
            <a href={integ.docsUrl} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-ink/5 hover:text-ink" aria-label={`${integ.name} API docs`} title="API docs">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {status === 'disconnected' && <Button size="sm" variant="primary" onClick={connect} loading={busy === 'connect'}><Plug className="h-3.5 w-3.5" /> Connect</Button>}
          {status === 'expired' && <Button size="sm" variant="primary" onClick={connect} loading={busy === 'connect'}><RefreshCw className="h-3.5 w-3.5" /> Reconnect</Button>}
          {(status === 'connected' || status === 'error') && (
            <Button size="sm" onClick={() => run('test', async () => {
              await testIntegration(integ.id);
              if (integ.fetchEvents) await syncExternalCalendars(startOfDay(addDays(new Date(), -30)), addDays(new Date(), 90));
            }, 'Connection OK')} loading={busy === 'test'}>
              <RefreshCw className="h-3.5 w-3.5" /> {integ.fetchEvents ? 'Sync' : 'Test'}
            </Button>
          )}
          {status !== 'disconnected' && status !== 'unavailable' && (
            <Button size="sm" variant="ghost" loading={busy === 'disconnect'} onClick={async () => {
              if (await confirmDialog({ title: `Disconnect ${integ.name}?`, message: 'The stored token is deleted from this device.', confirmLabel: 'Disconnect', danger: true }))
                void run('disconnect', () => disconnectIntegration(integ.id), `${integ.name} disconnected`);
            }}>
              <Unplug className="h-3.5 w-3.5" /> Disconnect
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ConnectModal({ integ, onClose }: { integ: Integration | null; onClose: () => void }) {
  const [values, setValues] = useState<ConnectInput>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const close = () => { setValues({}); setErr(null); onClose(); };
  const submit = async () => {
    if (!integ) return;
    for (const f of integ.fields ?? []) if (!values[f.name]?.trim()) { setErr(`${f.label} is required`); return; }
    setBusy(true); setErr(null);
    try { await connectIntegration(integ.id, values); toast(`${integ.name} connected`, 'success'); close(); }
    catch (e: any) { setErr(e?.message ?? 'Could not connect'); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={!!integ} onClose={close} title={integ ? `Connect ${integ.name}` : ''} size="sm"
      footer={<><Button variant="ghost" onClick={close}>Cancel</Button><Button variant="primary" loading={busy} onClick={submit}>Connect</Button></>}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {integ?.fields?.map((f) => (
          <Field key={f.name} label={f.label} hint={f.help}>
            <Input type={f.secret ? 'password' : 'text'} autoComplete="off" value={values[f.name] ?? ''} placeholder={f.placeholder}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
          </Field>
        ))}
        {err && <Note tone="danger">{err}</Note>}
        <p className="text-xs text-muted">Your token is verified, then stored only on this device. Momento only reads data; it never modifies your {integ?.name} account.</p>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function ExternalTasks() {
  const [items, setItems] = useState<ExternalTask[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [imported, setImported] = useState<Set<string>>(new Set());
  const anyConnected = INTEGRATIONS.some((i) => i.fetchTasks && ['connected', 'error'].includes(connectionStatus(i.id)));

  const load = async () => {
    setLoading(true);
    try { setItems(await fetchExternalTasks()); } catch (e: any) { toast(e?.message ?? 'Could not load tasks', 'error'); } finally { setLoading(false); }
  };

  const importTask = (t: ExternalTask) => {
    const name = INTEGRATIONS.find((i) => i.id === t.integration)?.name ?? t.integration;
    useTasks.getState().addTask({
      title: t.title,
      dueDate: t.due ?? null,
      description: t.url ? `Imported from ${name}: ${t.url}` : `Imported from ${name}`,
      category: name,
    });
    setImported((s) => new Set(s).add(`${t.integration}:${t.id}`));
  };

  return (
    <Group title="External tasks" description="Tasks assigned to you in connected apps. Import any of them into Momento.">
      <div className="flex gap-2">
        <Button size="sm" onClick={load} loading={loading} disabled={!anyConnected}><Download className="h-3.5 w-3.5" /> {items ? 'Refresh' : 'Load tasks'}</Button>
        {items && items.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => { items.filter((t) => !imported.has(`${t.integration}:${t.id}`)).forEach(importTask); toast('Imported all tasks', 'success'); }}>Import all</Button>
        )}
      </div>
      {!anyConnected && <p className="text-xs text-muted">Connect Todoist, Google Tasks, Trello, Asana, ClickUp or GitHub to see tasks here.</p>}
      {loading && <Spinner />}
      {items && !loading && (items.length === 0 ? <p className="text-xs text-muted">No open tasks found.</p> : (
        <ul className="max-h-72 divide-y divide-line/10 overflow-y-auto scroll-thin">
          {items.map((t) => {
            const key = `${t.integration}:${t.id}`;
            const done = imported.has(key);
            return (
              <li key={key} className="flex items-center gap-2 py-2 text-sm">
                <Badge>{INTEGRATIONS.find((i) => i.id === t.integration)?.name}</Badge>
                <span className="min-w-0 flex-1 truncate" title={t.title}>{t.title}</span>
                {t.due && <span className="text-xs text-muted">{t.due}</span>}
                {t.url && <a href={t.url} target="_blank" rel="noreferrer" className="text-muted hover:text-ink" aria-label="Open in app"><ExternalLink className="h-3.5 w-3.5" /></a>}
                <Button size="sm" variant={done ? 'ghost' : 'secondary'} disabled={done} onClick={() => importTask(t)}>{done ? 'Imported' : 'Import'}</Button>
              </li>
            );
          })}
        </ul>
      ))}
    </Group>
  );
}
