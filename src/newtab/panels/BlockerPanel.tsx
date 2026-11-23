import { useState } from 'react';
import { ShieldBan, Plus, X, Trash2, Clock, Info, ShieldCheck, ShieldOff } from 'lucide-react';
import { PanelFrame } from '@/components/PanelFrame';
import { Button, EmptyState, Input, Toggle, toast } from '@/components/ui';
import { useBlocker, blockingActive, SUGGESTED_SITES } from '@/stores/blocker';
import { useFocus } from '@/stores/focus';
import { isExtension } from '@/lib/storage';
import { DAY_NAMES, cn, faviconFor } from '@/lib/utils';
import { useNow } from '../widgets/core';

export default function BlockerPanel() {
  const blocker = useBlocker((s) => s.blocker);
  const b = useBlocker.getState();
  const { timer, settings: fs } = useFocus();
  const updateFocus = useFocus.getState().updateSettings;
  const now = useNow(15_000);
  const status = blockingActive(blocker, timer, fs, now);
  const [site, setSite] = useState('');
  const [allow, setAllow] = useState('');

  const add = (v: string) => {
    if (!b.addSite(v)) { toast('Enter a valid domain, e.g. twitter.com', 'error'); return false; }
    return true;
  };

  return (
    <PanelFrame title="Site blocker" icon={<ShieldBan className="h-4 w-4" />}>
      <div className="space-y-6 p-5">
        {/* status */}
        <div className={cn('flex items-center gap-3 rounded-2xl p-4', status.active ? 'bg-emerald-500/10' : 'bg-ink/5')}>
          {status.active ? <ShieldCheck className="h-6 w-6 text-emerald-500" /> : <ShieldOff className="h-6 w-6 text-muted" />}
          <div className="flex-1">
            <p className="text-sm font-semibold">{status.active ? 'Blocking is active' : 'Blocking is off'}</p>
            <p className="text-xs text-muted">{status.reason}</p>
          </div>
          {blocker.snoozeUntil && blocker.snoozeUntil > now.getTime() ? (
            <Button size="sm" onClick={() => b.clearSnooze()}>Resume now</Button>
          ) : (
            <div className="flex gap-1">
              {[15, 30, 60].map((m) => (
                <Button key={m} size="sm" variant="ghost" onClick={() => { b.snooze(m); toast(`Blocking snoozed for ${m} minutes`); }} disabled={!blocker.sites.length} title={`Snooze ${m} minutes`}>
                  {m}m
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* when */}
        <section>
          <h3 className="section-title mb-1">When to block</h3>
          <Toggle checked={blocker.alwaysOn} onChange={(v) => b.setAlwaysOn(v)} label="Always on" description="Block these sites all the time." />
          <Toggle checked={fs.blockDuringFocus} onChange={(v) => updateFocus({ blockDuringFocus: v })} label="During focus sessions" description="Block while a focus (work) session is running." />
          <Toggle checked={fs.blockDuringBreaks} disabled={!fs.blockDuringFocus} onChange={(v) => updateFocus({ blockDuringBreaks: v })} label="During breaks too" description="Keep blocking during short and long breaks." />
        </section>

        {/* blocklist */}
        <section>
          <h3 className="section-title mb-2">Blocked sites</h3>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (add(site)) setSite(''); }}>
            <Input value={site} onChange={(e) => setSite(e.target.value)} placeholder="e.g. reddit.com" aria-label="Site to block" />
            <Button type="submit" variant="primary" disabled={!site.trim()}><Plus className="h-4 w-4" /> Block</Button>
          </form>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGESTED_SITES.filter((s) => !blocker.sites.includes(s)).slice(0, 8).map((s) => (
              <button key={s} onClick={() => add(s)} className="chip bg-ink/5 text-muted hover:bg-ink/10 hover:text-ink">+ {s}</button>
            ))}
          </div>
          {blocker.sites.length === 0 ? (
            <EmptyState icon={<ShieldBan className="h-6 w-6" />} title="No blocked sites yet" description="Add the sites that pull you away from deep work." />
          ) : (
            <ul className="mt-3 divide-y divide-line/10 rounded-2xl border border-line/10">
              {blocker.sites.map((d) => (
                <li key={d} className="flex items-center gap-3 px-3 py-2">
                  <img src={faviconFor('https://' + d, 32)} alt="" className="h-4 w-4 rounded" />
                  <span className="flex-1 text-sm">{d}</span>
                  <span className="text-[11px] text-muted">incl. subdomains</span>
                  <button className="rounded-lg p-1 text-muted hover:bg-ink/5 hover:text-red-500" aria-label={`Unblock ${d}`} onClick={() => b.removeSite(d)}><X className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* allowlist */}
        <section>
          <h3 className="section-title mb-1">Always allow (exceptions)</h3>
          <p className="mb-2 text-xs text-muted">Useful for e.g. allowing <code>music.youtube.com</code> while blocking <code>youtube.com</code>.</p>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!b.addAllow(allow)) toast('Enter a valid domain', 'error'); else setAllow(''); }}>
            <Input value={allow} onChange={(e) => setAllow(e.target.value)} placeholder="e.g. music.youtube.com" aria-label="Domain to allow" />
            <Button type="submit" disabled={!allow.trim()}>Allow</Button>
          </form>
          {blocker.allowlist.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {blocker.allowlist.map((d) => (
                <span key={d} className="chip bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  {d}
                  <button aria-label={`Remove ${d} from allowlist`} onClick={() => b.removeAllow(d)}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* schedules */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="section-title">Schedules</h3>
            <Button size="sm" onClick={() => b.addSchedule()}><Plus className="h-3.5 w-3.5" /> Add schedule</Button>
          </div>
          {blocker.schedules.length === 0 && <p className="text-xs text-muted">Block automatically at set times, e.g. weekdays 9:00–12:00.</p>}
          <div className="space-y-2">
            {blocker.schedules.map((sc) => (
              <div key={sc.id} className="card space-y-2 p-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted" />
                  <input value={sc.name} onChange={(e) => b.updateSchedule(sc.id, { name: e.target.value })} className="flex-1 bg-transparent text-sm font-medium outline-none" aria-label="Schedule name" />
                  <Toggle checked={sc.enabled} onChange={(v) => b.updateSchedule(sc.id, { enabled: v })} />
                  <button className="rounded-lg p-1 text-muted hover:text-red-500" aria-label={`Delete schedule ${sc.name}`} onClick={() => b.removeSchedule(sc.id)}><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {DAY_NAMES.map((d, i) => {
                    const on = sc.days.includes(i);
                    return (
                      <button
                        key={d}
                        aria-pressed={on}
                        onClick={() => b.updateSchedule(sc.id, { days: on ? sc.days.filter((x) => x !== i) : [...sc.days, i].sort() })}
                        className={cn('h-7 w-10 rounded-lg text-xs font-medium transition', on ? 'bg-accent text-white' : 'bg-ink/5 text-muted hover:bg-ink/10')}
                      >
                        {d}
                      </button>
                    );
                  })}
                  <span className="mx-1" />
                  <Input type="time" value={sc.start} onChange={(e) => e.target.value && b.updateSchedule(sc.id, { start: e.target.value })} className="h-8 w-28" aria-label="Start time" />
                  <span className="text-xs text-muted">to</span>
                  <Input type="time" value={sc.end} onChange={(e) => e.target.value && b.updateSchedule(sc.id, { end: e.target.value })} className="h-8 w-28" aria-label="End time" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* limitations */}
        <section className="flex gap-3 rounded-2xl bg-ink/5 p-4 text-xs leading-relaxed text-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <p><strong className="text-ink">How blocking works:</strong> Momento uses Chrome’s <code>declarativeNetRequest</code> API to redirect top-level page loads of blocked domains (and their subdomains) to a calm “stay focused” page. Tabs already open on a blocked site are redirected when blocking switches on.</p>
            <p>It does not block content embedded in other pages, apps outside Chrome, or other browsers. In incognito windows it only works if you enable “Allow in Incognito” for Momento on <code>chrome://extensions</code>.</p>
            {!isExtension && <p className="font-medium text-amber-600">You are running Momento outside the extension (dev mode) — sites will not actually be blocked here.</p>}
          </div>
        </section>
      </div>
    </PanelFrame>
  );
}
