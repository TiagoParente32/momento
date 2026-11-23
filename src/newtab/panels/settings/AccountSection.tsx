import { useEffect, useState } from 'react';
import { Cloud, CloudOff, LogOut, RefreshCw, KeyRound, Mail } from 'lucide-react';
import { Button, Field, Input, Segmented, Toggle, confirmDialog, toast } from '@/components/ui';
import { useS, useSettings } from '@/stores/settings';
import {
  useAuth, useSyncConfig, initAuth, login, logout, register, sendPasswordReset, syncNow, updatePassword, updateProfile, deleteCloudData,
} from '@/lib/sync';
import { hasBuildConfig, isValidSupabaseUrl } from '@/lib/supabase';
import { Group, Note, Row, Section } from './common';

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

export function AccountSection() {
  const auth = useAuth();
  useEffect(() => { if (!auth.ready) void initAuth(); }, [auth.ready]);

  return (
    <Section title="Account & profile" description="Your profile, sign-in and optional cloud sync across devices.">
      <ProfileGroup />
      {!auth.ready ? null : !auth.configured ? <SupabaseConfig /> : auth.user ? <SignedIn /> : <AuthForms />}
      {auth.ready && auth.configured && !hasBuildConfig() && <SupabaseConfig compact />}
    </Section>
  );
}

function ProfileGroup() {
  const s = useS();
  const [name, setName] = useState(s.name);
  const [saving, setSaving] = useState(false);
  useEffect(() => setName(s.name), [s.name]);
  const save = async () => {
    setSaving(true);
    try {
      await updateProfile(name.trim());
      useSettings.getState().update({ name: name.trim() });
      toast('Profile saved', 'success');
    } catch (e: any) { toast(e?.message ?? 'Could not save profile', 'error'); } finally { setSaving(false); }
  };
  return (
    <Group title="Profile">
      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <Field label="Display name" className="flex-1"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Your name" /></Field>
        <Button type="submit" variant="primary" loading={saving} disabled={name.trim() === s.name}>Save</Button>
      </form>
    </Group>
  );
}

function SupabaseConfig({ compact }: { compact?: boolean }) {
  const cfg = useSyncConfig((s) => s.config);
  const [url, setUrl] = useState(cfg.url);
  const [key, setKey] = useState(cfg.anonKey);
  const [open, setOpen] = useState(!compact);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setUrl(cfg.url); setKey(cfg.anonKey); }, [cfg.url, cfg.anonKey]);

  const save = async () => {
    if (url && !isValidSupabaseUrl(url)) { setErr('Enter a valid https:// project URL'); return; }
    if (url && key.trim().length < 20) { setErr('The anon key looks too short'); return; }
    setErr(null);
    useSyncConfig.getState().setConfig(url, key);
    await useSyncConfig.flush();
    await initAuth();
    toast(url ? 'Cloud sync configured' : 'Cloud sync disabled', 'success');
  };

  if (compact && !open) {
    return <button className="text-xs text-muted underline" onClick={() => setOpen(true)}>Change Supabase project…</button>;
  }

  return (
    <Group title="Cloud sync (optional)" description="Cloud sync is optional – everything is stored locally on this device.">
      {!compact && (
        <Note>
          <p className="flex items-center gap-1.5 font-medium"><CloudOff className="h-3.5 w-3.5" /> Not configured</p>
          <p className="mt-1">To sync across devices, create a free Supabase project, run <code>supabase/migrations/0001_init.sql</code>, then paste the project URL and <b>anon public</b> key below (Project Settings → API). You can also bake them in at build time with <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>. Never paste the service-role key here.</p>
        </Note>
      )}
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <Field label="Project URL" error={err}><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xyzcompany.supabase.co" /></Field>
        <Field label="Anon public key"><Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJhbGciOi…" type="password" autoComplete="off" /></Field>
        <div className="flex gap-2">
          <Button type="submit" variant="primary">Save</Button>
          {(cfg.url || cfg.anonKey) && <Button variant="ghost" onClick={() => { setUrl(''); setKey(''); useSyncConfig.getState().setConfig('', ''); void useSyncConfig.flush().then(initAuth); }}>Remove</Button>}
        </div>
      </form>
    </Group>
  );
}

function AuthForms() {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(useSettings.getState().settings.name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async () => {
    setErr(null); setInfo(null);
    if (!emailOk(email)) { setErr('Enter a valid email address'); return; }
    if (mode !== 'reset' && password.length < 8) { setErr('Password must be at least 8 characters'); return; }
    setBusy(true);
    try {
      if (mode === 'login') { await login(email.trim(), password); toast('Signed in — your data is syncing', 'success'); }
      else if (mode === 'register') {
        const r = await register(email.trim(), password, name.trim());
        if (r.needsConfirmation) setInfo('Check your inbox to confirm your email, then sign in.');
        else toast('Account created', 'success');
      } else { await sendPasswordReset(email.trim()); setInfo('If an account exists for that email, a reset link is on its way.'); }
    } catch (e: any) { setErr(e?.message ?? 'Something went wrong'); } finally { setBusy(false); }
  };

  return (
    <Group title="Sign in to sync" description="Access your dashboard on every device where Momento is installed.">
      <Segmented value={mode} onChange={(m) => { setMode(m); setErr(null); setInfo(null); }}
        options={[{ value: 'login', label: 'Log in' }, { value: 'register', label: 'Create account' }, { value: 'reset', label: 'Forgot password' }]} />
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {mode === 'register' && <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>}
        <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></Field>
        {mode !== 'reset' && (
          <Field label="Password" hint={mode === 'register' ? 'At least 8 characters' : undefined}>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
          </Field>
        )}
        {err && <Note tone="danger">{err}</Note>}
        {info && <Note tone="success">{info}</Note>}
        <Button type="submit" variant="primary" loading={busy}>
          {mode === 'login' ? 'Log in' : mode === 'register' ? 'Create account' : <><Mail className="h-4 w-4" /> Send reset link</>}
        </Button>
      </form>
    </Group>
  );
}

function SignedIn() {
  const { user, syncing, syncError } = useAuth();
  const { lastSyncedAt, autoSync } = useSyncConfig();
  const [pw, setPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  const doSync = async () => {
    try {
      const r = await syncNow();
      toast(r === 'pulled' ? 'Pulled latest data from the cloud' : r === 'pushed' ? 'Uploaded your data' : 'Already up to date', 'success');
    } catch (e: any) { toast(e?.message ?? 'Sync failed', 'error'); }
  };

  return (
    <>
      <Group title="Account">
        <Row label={user?.email} description={<span className="flex items-center gap-1"><Cloud className="h-3 w-3" /> Signed in · {lastSyncedAt ? `last synced ${new Date(lastSyncedAt).toLocaleString()}` : 'not synced yet'}</span>}>
          <div className="flex gap-2">
            <Button size="sm" onClick={doSync} loading={syncing}><RefreshCw className="h-3.5 w-3.5" /> Sync now</Button>
            <Button size="sm" variant="ghost" onClick={() => logout().then(() => toast('Signed out')).catch((e) => toast(e.message, 'error'))}><LogOut className="h-3.5 w-3.5" /> Sign out</Button>
          </div>
        </Row>
        {syncError && <Note tone="danger">Sync error: {syncError}</Note>}
        <Toggle checked={autoSync} onChange={(v) => useSyncConfig.getState().setAutoSync(v)} label="Automatic sync" description="Upload changes a few seconds after you make them and check for updates every 10 minutes." />
        <Note>Synced: settings, tasks, focus history, notes, tabs, calendar, countdowns, metrics, quotes, goals and clocks. Never synced: integration tokens, AI keys and caches.</Note>
      </Group>

      <Group title="Change password">
        <form className="flex items-end gap-2" onSubmit={async (e) => {
          e.preventDefault();
          if (pw.length < 8) { toast('Password must be at least 8 characters', 'error'); return; }
          setPwBusy(true);
          try { await updatePassword(pw); setPw(''); toast('Password updated', 'success'); } catch (er: any) { toast(er.message, 'error'); } finally { setPwBusy(false); }
        }}>
          <Field label="New password" className="flex-1"><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
          <Button type="submit" loading={pwBusy}><KeyRound className="h-4 w-4" /> Update</Button>
        </form>
      </Group>

      <Group title="Cloud data">
        <Row label="Delete cloud copy" description="Removes your synced data from the server but keeps your account and this device's data.">
          <Button size="sm" variant="danger" onClick={async () => {
            if (!(await confirmDialog({ title: 'Delete cloud data?', message: 'Your data stays on this device. Other devices will stop receiving updates until you sync again.', confirmLabel: 'Delete', danger: true }))) return;
            try { await deleteCloudData(); toast('Cloud data deleted', 'success'); } catch (e: any) { toast(e.message, 'error'); }
          }}>Delete</Button>
        </Row>
      </Group>
    </>
  );
}
