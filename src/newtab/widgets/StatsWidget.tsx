import { useFocus } from '@/stores/focus';
import { useTasks } from '@/stores/tasks';
import { useUI } from '@/stores/ui';
import { ProgressRing } from '@/components/ui';
import { formatMinutes, todayISO, toISODate } from '@/lib/utils';

const DAILY_FOCUS_TARGET = 120; // minutes – ring fills at 2h of focus

export default function StatsWidget() {
  const sessions = useFocus((s) => s.sessions);
  const tasks = useTasks((s) => s.tasks);
  const openPanel = useUI((u) => u.openPanel);
  const today = todayISO();
  const focus = sessions.filter((s) => s.phase === 'work' && toISODate(new Date(s.startedAt)) === today).reduce((a, s) => a + s.minutes, 0);
  const done = tasks.filter((t) => t.done && t.completedAt && toISODate(new Date(t.completedAt)) === today).length;
  const dueToday = tasks.filter((t) => t.dueDate === today);
  const dueDone = dueToday.filter((t) => t.done).length;

  return (
    <button onClick={() => openPanel('stats')} className="glass flex items-center gap-4 rounded-2xl px-4 py-3 text-left transition hover:bg-white/15" aria-label="Open productivity stats">
      <ProgressRing value={focus / DAILY_FOCUS_TARGET} size={52} stroke={5} color="#fff" track="rgba(255,255,255,0.2)">
        <span className="text-[11px] font-semibold tabular-nums">{Math.min(100, Math.round((focus / DAILY_FOCUS_TARGET) * 100))}%</span>
      </ProgressRing>
      <div className="text-sm leading-tight">
        <p><span className="text-lg font-semibold tabular-nums">{formatMinutes(focus)}</span> <span className="text-white/75">focused</span></p>
        <p className="text-white/80">{done} {done === 1 ? 'task' : 'tasks'} done{dueToday.length ? ` · ${dueDone}/${dueToday.length} due today` : ''}</p>
      </div>
    </button>
  );
}
