import { useMemo } from 'react';
import { CalendarDays, CheckSquare } from 'lucide-react';
import { useUI } from '@/stores/ui';
import { useS } from '@/stores/settings';
import { useCalendarItems } from '../useCalendarItems';
import { fmtTime } from '@/lib/calendarUtils';
import { addDays, sameDay, startOfDay } from '@/lib/utils';
import { useNow } from './core';

export default function CalendarWidget() {
  const s = useS();
  const openPanel = useUI((st) => st.openPanel);
  const items = useCalendarItems();
  const now = useNow(60_000);

  const upcoming = useMemo(() => {
    const horizon = addDays(startOfDay(now), 14).getTime();
    return items
      .filter((i) => i.end.getTime() > now.getTime() && i.start.getTime() < horizon)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 5);
  }, [items, now]);

  const dayLabel = (d: Date) =>
    sameDay(d, now) ? 'Today' : sameDay(d, addDays(now, 1)) ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="glass w-72 rounded-2xl p-4 text-left">
      <button className="mb-2 flex w-full items-center gap-2 text-sm font-semibold" onClick={() => openPanel('calendar')}>
        <CalendarDays className="h-4 w-4" /> Upcoming
        <span className="ml-auto text-xs font-normal text-white/60">{now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
      </button>
      {upcoming.length ? (
        <ul className="space-y-1">
          {upcoming.map((it) => (
            <li key={it.key}>
              <button
                className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1 text-left hover:bg-white/10"
                onClick={() => openPanel(it.kind === 'task' ? 'tasks' : 'calendar', it.kind === 'task' ? { taskId: it.task?.id } : { view: 'day', date: it.start.toISOString() })}
              >
                <span className="h-7 w-1 shrink-0 rounded-full" style={{ background: it.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{it.kind === 'task' && <CheckSquare className="mr-1 inline h-3 w-3 opacity-70" />}{it.title}</span>
                  <span className="block text-[11px] text-white/65">{dayLabel(it.start)}{it.allDay ? '' : ` · ${fmtTime(it.start, s.clock24h)}`}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <button className="w-full rounded-lg py-3 text-center text-xs text-white/70 hover:bg-white/10" onClick={() => openPanel('calendar')}>
          Nothing scheduled in the next two weeks. Add an event →
        </button>
      )}
    </div>
  );
}
