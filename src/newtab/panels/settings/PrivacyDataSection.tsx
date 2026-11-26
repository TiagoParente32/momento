import { useRef, useState } from 'react';
import { Download, Upload, RotateCcw, Trash2, Gift, Heart, Check, KeyRound } from 'lucide-react';
import { Button, Toggle, confirmDialog, toast } from '@/components/ui';
import { useS, useSettings } from '@/stores/settings';
import { useIntegrations } from '@/stores/integrations';
import { useAI } from '@/stores/ai';
import { useAuth, deleteAccount } from '@/lib/sync';
import { clearAll, getAll, setItem, SYNCED_KEYS } from '@/lib/storage';
import { download, todayISO } from '@/lib/utils';
import { Group, Note, Row, Section } from './common';

export function PlanSection() {
  const features = [
    'Unlimited focus sessions & Pomodoro', 'Ambient sounds', 'Website blocker & schedules', 'Unlimited task lists, subtasks & reminders',
    'Notes with folders & rich text', 'Tab Stash & Tab Groups', 'Calendar with Google & Outlook', 'Task integrations (Todoist, Trello, …)',
    'Momento AI', 'Advanced stats & custom metrics', 'Countdowns', 'Custom backgrounds, themes & fonts', 'Custom quotes & mantras',
    'World clocks', 'Hourly & 5-day weather, air quality', 'Balance Mode', 'Cloud sync (bring your own Supabase)',
  ];
  return (
    <Section title="Plan" description="No subscriptions, no paywalls.">
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-accent/25 to-accent/5 p-5">
          <p className="flex items-center gap-2 text-lg font-semibold"><Gift className="h-5 w-5 text-accent" /> Momento is free — every feature included</p>
          <p className="mt-1 text-sm text-muted">There is no Plus tier, no billing and nothing to cancel. Everything you see is yours to use.</p>
        </div>
        <ul className="grid gap-x-4 gap-y-1.5 p-5 text-sm sm:grid-cols-2">
          {features.map((f) => <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{f}</li>)}
        </ul>
      </div>
      <Note>Optional services you configure yourself (your own Supabase project for sync, your own Anthropic key) are billed by those providers under your own account, if at all.</Note>
    </Section>
  );
}

export function PrivacySection() {
  const s = useS();
  return (
    <Section title="Privacy" description="Momento is local-first. Here's exactly what's stored where.">
      <Group title="Where your data lives">
        <ul className="space-y-2 text-sm">
          <li><b>This device</b> — everything, in Chrome's extension storage.</li>
          <li><b>Your Supabase project</b> (only if you sign in) — a copy of your settings, tasks, notes, focus history and other content, protected by row-level security so only you can read it.</li>
          <li><b>Never synced or exported</b> — integration tokens, OAuth client IDs, your Anthropic API key, AI conversations and caches.</li>
          <li><b>Third parties contacted</b> — Unsplash (photos), Open-Meteo (weather), Google Fonts, favicon lookups, and any integration or AI provider you explicitly enable.</li>
        </ul>
      </Group>
      <Group title="Analytics">
        <Row label="Usage analytics" description="Momento contains no analytics, tracking or advertising code."><span className="chip bg-emerald-500/15 text-emerald-600">Off — always</span></Row>
      </Group>
      <Group title="Display">
        <Toggle checked={s.privacy.blurQuoteOnHover} onChange={(blurQuoteOnHover) => useSettings.getState().updateNested('privacy', { blurQuoteOnHover })} label="Blur quote until hovered" description="Keeps the dashboard calm when sharing your screen" />
      </Group>
      <Group title="Credentials">
        <Row label="Clear all integration tokens" description="Disconnects every integration on this device">
          <Button size="sm" variant="danger" onClick={async () => {
            if (!(await confirmDialog({ title: 'Clear integration tokens?', message: 'All connected apps will be disconnected.', confirmLabel: 'Clear', danger: true }))) return;
            useIntegrations.getState().clearAll();
            toast('Integration tokens cleared', 'success');
          }}><KeyRound className="h-3.5 w-3.5" /> Clear</Button>
        </Row>
        <Row label="Remove AI key & conversation">
          <Button size="sm" variant="danger" onClick={async () => {
            if (!(await confirmDialog({ title: 'Remove AI data?', message: 'Deletes your stored Anthropic key and chat history.', confirmLabel: 'Remove', danger: true }))) return;
            useAI.getState().setApiKey(''); useAI.getState().clear();
            toast('AI data removed', 'success');
          }}>Remove</Button>
        </Row>
      </Group>
    </Section>
  );
}

interface ExportFile { app: 'momento'; version: number; exportedAt: string; data: Record<string, unknown> }

export function DataSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const user = useAuth((a) => a.user);
  const [busy, setBusy] = useState<string | null>(null);

  const exportData = async () => {
    const all = await getAll();
    const data: Record<string, unknown> = {};
    for (const k of SYNCED_KEYS) if (all[k] !== undefined) data[k] = all[k];
    const file: ExportFile = { app: 'momento', version: 1, exportedAt: new Date().toISOString(), data };
    download(`momento-backup-${todayISO()}.json`, JSON.stringify(file, null, 2));
    toast('Backup downloaded', 'success');
  };

  const importData = async (f: File | undefined) => {
    if (!f) return;
    try {
      if (f.size > 50 * 1024 * 1024) throw new Error('File is too large');
      const parsed = JSON.parse(await f.text()) as Partial<ExportFile>;
      if (parsed?.app !== 'momento' || typeof parsed.data !== 'object' || !parsed.data) throw new Error('This is not a Momento backup file');
      const keys = Object.keys(parsed.data).filter((k) => SYNCED_KEYS.includes(k));
      if (!keys.length) throw new Error('The backup contains no Momento data');
      for (const k of keys) {
        const v = (parsed.data as Record<string, unknown>)[k];
        if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error(`Invalid data for ${k.replace('momento:', '')}`);
      }
      const ok = await confirmDialog({
        title: 'Import backup?',
        message: `This replaces your current ${keys.map((k) => k.replace('momento:', '')).join(', ')} with the backup from ${parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleString() : 'an unknown date'}.`,
        confirmLabel: 'Import',
        danger: true,
      });
      if (!ok) return;
      for (const k of keys) await setItem(k, (parsed.data as Record<string, unknown>)[k]);
      toast('Backup imported — reloading…', 'success');
      setTimeout(() => location.reload(), 800);
    } catch (e: any) {
      toast(e instanceof SyntaxError ? 'That file is not valid JSON' : e?.message ?? 'Import failed', 'error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const resetAll = async () => {
    if (!(await confirmDialog({ title: 'Reset Momento?', message: 'Deletes all data on this device: tasks, notes, settings, history, tokens. Your cloud copy (if any) is not affected. Consider exporting a backup first.', confirmLabel: 'Reset everything', danger: true }))) return;
    await clearAll();
    location.reload();
  };

  const removeAccount = async () => {
    if (!(await confirmDialog({ title: 'Delete your account?', message: 'Your Momento account and all cloud data will be permanently deleted, and this device will be wiped.', confirmLabel: 'Continue', danger: true }))) return;
    if (!(await confirmDialog({ title: 'Are you absolutely sure?', message: 'This cannot be undone.', confirmLabel: 'Delete my account forever', danger: true }))) return;
    setBusy('delete');
    try { await deleteAccount(); toast('Account deleted'); setTimeout(() => location.reload(), 800); }
    catch (e: any) { toast(e?.message ?? 'Deletion failed', 'error'); }
    finally { setBusy(null); }
  };

  return (
    <Section title="Data & deletion" description="Your data is yours: take it with you or delete it.">
      <Group title="Backup">
        <Row label="Export all data" description="Download a JSON file with your settings, tasks, notes, history and more (no tokens or keys).">
          <Button size="sm" onClick={exportData}><Download className="h-3.5 w-3.5" /> Export</Button>
        </Row>
        <Row label="Import from backup" description="Restore a file created by Export.">
          <>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => importData(e.target.files?.[0])} />
            <Button size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-3.5 w-3.5" /> Import</Button>
          </>
        </Row>
      </Group>
      <Group title="Danger zone" className="border-red-500/25">
        <Row label="Reset this device" description="Erase all Momento data stored in this browser.">
          <Button size="sm" variant="danger" onClick={resetAll}><RotateCcw className="h-3.5 w-3.5" /> Reset</Button>
        </Row>
        <Row label="Delete account" description={user ? `Permanently delete ${user.email} and its cloud data.` : 'Sign in to delete your cloud account. Without an account, "Reset this device" removes everything.'}>
          <Button size="sm" variant="danger" disabled={!user} loading={busy === 'delete'} onClick={removeAccount}><Trash2 className="h-3.5 w-3.5" /> Delete account</Button>
        </Row>
      </Group>
    </Section>
  );
}

export function AboutSection() {
  const version = typeof chrome !== 'undefined' && chrome.runtime?.getManifest ? chrome.runtime.getManifest().version : 'dev';
  const shortcuts: [string, string][] = [
    ['T', 'Open Tasks'], ['F', 'Start Focus Mode'], ['N', 'Open Notes'], ['C', 'Open Calendar'], ['S', 'Open Settings'], ['A', 'Open Momento AI'],
    ['Esc', 'Close the current panel'], ['Alt + M', 'Open the Momento popup (configurable at chrome://extensions/shortcuts)'],
  ];
  return (
    <Section title="About Momento" description="Make every moment count.">
      <Group>
        <Row label="Version"><span className="text-sm text-muted">{version}</span></Row>
        <p className="flex items-center gap-1.5 text-xs text-muted"><Heart className="h-3.5 w-3.5 text-accent" /> Photos from Unsplash · Weather by Open-Meteo · Icons by Lucide</p>
      </Group>
      <Group title="Keyboard shortcuts" description="Available on the dashboard when you're not typing.">
        <ul className="divide-y divide-line/10">
          {shortcuts.map(([k, d]) => (
            <li key={k} className="flex items-center justify-between py-2 text-sm">
              <span>{d}</span>
              <kbd className="rounded-md border border-line/20 bg-ink/5 px-2 py-0.5 font-mono text-xs">{k}</kbd>
            </li>
          ))}
        </ul>
      </Group>
    </Section>
  );
}
