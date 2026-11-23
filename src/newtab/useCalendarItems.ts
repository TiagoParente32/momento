import { useMemo } from 'react';
import { useCalendar } from '@/stores/calendar';
import { useTasks } from '@/stores/tasks';
import { eventToItem, taskToItem, type CalItem } from '@/lib/calendarUtils';

/** Local + external events + open tasks with due dates, as unified calendar items. */
export function useCalendarItems(): CalItem[] {
  const events = useCalendar((s) => s.events);
  const external = useCalendar((s) => s.external);
  const tasks = useTasks((s) => s.tasks);
  const lists = useTasks((s) => s.lists);
  return useMemo(() => {
    const color = (listId: string) => lists.find((l) => l.id === listId)?.color ?? '#94a3b8';
    return [
      ...events.map(eventToItem),
      ...external.map(eventToItem),
      ...tasks.filter((t) => !t.done && t.dueDate).map((t) => taskToItem(t, color(t.listId))).filter((x): x is CalItem => !!x),
    ];
  }, [events, external, tasks, lists]);
}
