import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Play, Pause, RotateCcw, Plus, Layers, ShieldBan, LayoutDashboard, StickyNote, Timer, Check } from 'lucide-react';
import '@/styles.css';
import { useSettings, useS } from '@/stores/settings';
import { useTasks, topTask } from '@/stores/tasks';
import { useFocus } from '@/stores/focus';
import { useBlocker, blockingActive } from '@/stores/blocker';
import { stashTabs } from '@/lib/tabsApi';
import { useTabs } from '@/stores/tabs';
import { applyAppearance } from '@/lib/appearance';
import { formatMs, todayISO, cn } from '@/lib/utils';
import { Button, ToastHost, toast } from '@/components/ui';

// Popups size to content: undo the full-height page styles.
for (const el of [document.documentElement, document.body]) { el.style.height = 'auto'; el.style.overflow = 'visible'; }

const openDashboard = (hash = '') => {
  const url = chrome.runtime.getURL('newtab.html') + hash;
  chrome.tabs.create({ url });
  window.close();
};

function useTick(ms = 1000) {
  const [, s] = useState(0);
  useEffect(() => { const t = setInterval(() => s((n) => n + 1), ms); return () => clearInterval(t); }, [ms]);
}

function Popup() {
  const settings = useS();
  const hydrated = useSettings((s) => s.hydrated);
  const tasks = useTasks((s) => s.tasks);
  const lists = useTasks((s) => s.lists);
  const timer = useFocus((s) => s.timer);
  const focusSettings = useFocus((s) => s.settings);
  const blocker = useBlocker((s) => s.blocker);
  const [title, setTitle] = useState('');
  useTick();

  useEffect(() => { if (hydrated) applyAppearance(settings, null); }, [hydrated, settings]);

  const top = topTask(tasks);
  const today = todayISO();
  const dueToday = tasks.filter((t) => !t.done && t.dueDate && t.dueDate <= today).slice(0, 5);
  const remaining = timer.status === 'running' && timer.endsAt ? timer.endsAt - Date.now() : timer.remainingMs;
  const block = blockingActive(blocker, timer, focusSettings, new Date());

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    useTasks.getState().addTask({ title: title.trim(), listId: settings.tasks.defaultListId ?? lists[0]?.id ?? 'personal', dueDate: today });
    setTitle('');
    toast('Task added', 'success');
  };

  const stash = async () => {
    try {
      const c = await stashTabs(false);
      toast(`Stashed ${c.tabs.length} tabs`, 'success');
    } catch (err: any) {
      toast(err?.message ?? 'Could not stash tabs', 'error');
    }
  };

  const snooze = (min: number) => {
    useBlocker.getState().snooze(min);
    toast(`Blocking paused for ${min} min`);
  };

  return (
    <div className="w-[360px] space-y-3 bg-[rgb(var(--panel-bg))] p-4 text-ink">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Momento</p>
          <p className="text-xs text-muted">Make every moment count.</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => openDashboard()}><LayoutDashboard className="h-4 w-4" /> Dashboard</Button>
      </header>

      {/* Focus */}
      <section className="card p-3">
        <div className="flex items-center justify-between">
          <span className="section-title flex items-center gap-1"><Timer className="h-3.5 w-3.5" /> {timer.phase === 'work' ? 'Focus' : timer.phase === 'shortBreak' ? 'Short break' : 'Long break'}</span>
          <span className="font-display text-2xl font-semibold tabular-nums">{formatMs(remaining)}</span>
        </div>
        <div className="mt-2 flex gap-2">
          {timer.status === 'running' ? (
            <Button size="sm" variant="primary" onClick={() => useFocus.getState().pause()}><Pause className="h-3.5 w-3.5" /> Pause</Button>
          ) : timer.status === 'paused' ? (
            <Button size="sm" variant="primary" onClick={() => useFocus.getState().resume()}><Play className="h-3.5 w-3.5" /> Resume</Button>
          ) : (
            <Button size="sm" variant="primary" onClick={() => useFocus.getState().start({ taskId: top?.id ?? null })}><Play className="h-3.5 w-3.5" /> Start focus</Button>
          )}
          {timer.status !== 'idle' && <Button size="sm" onClick={() => useFocus.getState().reset()}><RotateCcw className="h-3.5 w-3.5" /> Reset</Button>}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => openDashboard('#panel=focus')}>Full screen</Button>
        </div>
      </section>

      {/* Tasks */}
      <section className="card space-y-2 p-3">
        <form onSubmit={addTask} className="flex gap-2">
          <input className="input" placeholder="Add a task for today…" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="New task" />
          <Button type="submit" size="icon" variant="primary" aria-label="Add task"><Plus className="h-4 w-4" /></Button>
        </form>
        {top && (
          <p className="text-xs text-muted">Most important: <span className="font-medium text-ink">{top.title}</span></p>
        )}
        <ul className="space-y-1">
          {dueToday.map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-sm">
              <button
                aria-label={`Complete ${t.title}`}
                onClick={() => useTasks.getState().toggleTask(t.id)}
                className={cn('grid h-4 w-4 place-items-center rounded border border-line/30 hover:border-accent')}
              >
                {t.done && <Check className="h-3 w-3" />}
              </button>
              <span className="truncate">{t.title}</span>
            </li>
          ))}
          {!dueToday.length && <li className="text-xs text-muted">Nothing due today.</li>}
        </ul>
      </section>

      {/* Quick actions */}
      <section className="grid grid-cols-3 gap-2 [&_button]:whitespace-nowrap">
        <Button size="sm" onClick={stash} className="justify-center"><Layers className="h-3.5 w-3.5" /> Stash tabs</Button>
        <Button size="sm" onClick={() => openDashboard('#panel=notes')} className="justify-center"><StickyNote className="h-3.5 w-3.5" /> Notes</Button>
        <Button size="sm" onClick={() => openDashboard('#panel=blocker')} className="justify-center"><ShieldBan className="h-3.5 w-3.5" /> Blocker</Button>
      </section>

      <section className="flex items-center justify-between rounded-xl bg-ink/5 px-3 py-2 text-xs">
        <span className={cn('flex items-center gap-1.5', block.active ? 'text-red-500' : 'text-muted')}>
          <span className={cn('h-2 w-2 rounded-full', block.active ? 'bg-red-500' : 'bg-ink/30')} />
          {block.active ? `Blocking on · ${block.reason}` : 'Site blocking off'}
        </span>
        {block.active && (
          <span className="flex gap-1">
            <button className="rounded px-1.5 py-0.5 hover:bg-ink/10" onClick={() => snooze(15)}>Pause 15m</button>
          </span>
        )}
      </section>
      <p className="text-center text-[11px] text-muted">{useTabs((s) => s.collections.length)} saved tab collections</p>
      <ToastHost />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
