import { useMemo, useState } from 'react';
import { Check, Plus, Star, ChevronRight, Timer, Flag } from 'lucide-react';
import { useTasks, topTask, PRIORITY_META, formatDue, isOverdue } from '@/stores/tasks';
import { useS } from '@/stores/settings';
import { useUI } from '@/stores/ui';
import { cn, todayISO } from '@/lib/utils';
import { Burst } from '@/components/ui';
import type { Task } from '@/lib/types';

export default function TasksWidget() {
  const tasks = useTasks((s) => s.tasks);
  const { addTask, toggleTask } = useTasks.getState();
  const s = useS();
  const openPanel = useUI((st) => st.openPanel);
  const [text, setText] = useState('');
  const today = todayISO();
  // Tasks mid-completion: show the tick + burst + strike before the row leaves the list.
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  const complete = (t: Task) => {
    if (t.done) { toggleTask(t.id); return; }
    if (completing.has(t.id)) return;
    setCompleting((s) => new Set(s).add(t.id));
    setTimeout(() => {
      toggleTask(t.id);
      setCompleting((s) => { const n = new Set(s); n.delete(t.id); return n; });
    }, 550);
  };

  const top = useMemo(() => topTask(tasks), [tasks]);
  const todays = useMemo(() => {
    const open = tasks.filter((t) => !t.done && t.id !== top?.id && (!t.dueDate || t.dueDate <= today));
    const done = s.tasks.showCompletedOnDashboard ? tasks.filter((t) => t.done && t.completedAt?.slice(0, 10) === today) : [];
    return [...open.sort((a, b) => PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank || a.order - b.order), ...done];
  }, [tasks, top, today, s.tasks.showCompletedOnDashboard]);
  const doneToday = tasks.filter((t) => t.done && t.completedAt?.slice(0, 10) === today).length;

  const add = () => {
    if (!text.trim()) return;
    const listId = s.tasks.defaultListId ?? undefined;
    addTask({ title: text.trim(), dueDate: today, ...(listId ? { listId } : {}) });
    setText('');
  };

  const row = (t: Task) => {
    const done = t.done || completing.has(t.id);
    return (
    <li key={t.id} className={cn('group flex items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-white/10', completing.has(t.id) && !s.tasks.showCompletedOnDashboard ? 'task-leave' : 'animate-fade-in')}>
      <button
        onClick={() => complete(t)}
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Mark “${t.title}” not done` : `Complete “${t.title}”`}
        className={cn('relative grid h-4 w-4 shrink-0 place-items-center rounded-full border-[1.5px] border-white/70 transition duration-300 ease-spring hover:scale-110 active:scale-90', done && 'border-transparent bg-white text-zinc-900')}
      >
        {done && <Check className="h-2.5 w-2.5 animate-pop" strokeWidth={3.5} />}
        {completing.has(t.id) && <Burst count={8} distance={14} />}
      </button>
      <button className={cn('strike min-w-0 flex-1 truncate text-left text-sm', done && 'is-done')} onClick={() => openPanel('tasks', { task: t.id })}>
        {t.title}
      </button>
      {isOverdue(t) && <span className="text-[10px] font-medium text-red-300">{formatDue(t)}</span>}
      {t.priority !== 'none' && <Flag className="h-3 w-3 shrink-0" style={{ color: PRIORITY_META[t.priority].color }} />}
    </li>
    );
  };

  return (
    <div className="glass w-80 rounded-2xl p-4 text-left">
      <div className="mb-2 flex items-center justify-between">
        <button className="flex items-center gap-1 text-sm font-semibold hover:opacity-80" onClick={() => openPanel('tasks')}>
          Today <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <span key={doneToday} className="text-xs text-white/70 animate-fade-in">{doneToday} done</span>
      </div>

      {top && (
        <div key={top.id} className="mb-2 rounded-xl bg-white/10 p-2.5 animate-scale-in">
          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-white/70"><Star className="h-3 w-3" /> Most important</p>
          <div className="flex items-start gap-2.5">
            <button
              onClick={() => complete(top)}
              role="checkbox"
              aria-checked={completing.has(top.id)}
              aria-label={`Complete “${top.title}”`}
              className={cn('relative mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-[1.5px] transition duration-300 ease-spring hover:scale-110 active:scale-90', completing.has(top.id) && 'bg-white text-zinc-900')}
              style={{ borderColor: completing.has(top.id) ? 'transparent' : top.priority !== 'none' ? PRIORITY_META[top.priority].color : 'rgba(255,255,255,.8)' }}
            >
              {completing.has(top.id) && <><Check className="h-2.5 w-2.5 animate-pop" strokeWidth={3.5} /><Burst count={12} distance={22} /></>}
            </button>
            <button className={cn('strike min-w-0 flex-1 text-left text-sm font-medium leading-snug', completing.has(top.id) && 'is-done')} onClick={() => openPanel('tasks', { task: top.id })}>{top.title}</button>
            <button className="rounded-md p-0.5 text-white/70 hover:bg-white/15 hover:text-white" aria-label="Focus on this task" title="Focus on this" onClick={() => openPanel('focus', { task: top.id })}>
              <Timer className="h-4 w-4" />
            </button>
          </div>
          {top.dueDate && <p className={cn('ml-6 mt-0.5 text-[11px]', isOverdue(top) ? 'text-red-300' : 'text-white/60')}>{formatDue(top)}</p>}
        </div>
      )}

      <ul className="max-h-52 space-y-0.5 overflow-y-auto scroll-thin">
        {todays.slice(0, 12).map(row)}
        {!top && todays.length === 0 && <li className="px-1.5 py-2 text-sm text-white/70">No tasks yet. Add one below.</li>}
      </ul>
      {todays.length > 12 && <button className="mt-1 text-xs text-white/70 hover:text-white" onClick={() => openPanel('tasks')}>+{todays.length - 12} more</button>}

      <form className="mt-2 flex items-center gap-2 border-t border-white/15 pt-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <Plus className="h-4 w-4 text-white/70" />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="New task" className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/55" aria-label="New task" />
      </form>
    </div>
  );
}
