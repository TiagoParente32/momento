import type { CalendarEvent, Task } from './types';
import { addDays, fromISODate, startOfDay, toISODate } from './utils';

/** A unified item shown on calendars: events (local/external) and tasks with due dates. */
export interface CalItem {
  key: string;
  kind: 'event' | 'task';
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  color: string;
  readOnly: boolean;
  event?: CalendarEvent;
  task?: Task;
}

export function eventToItem(e: CalendarEvent): CalItem {
  const start = new Date(e.start);
  let end = new Date(e.end);
  if (!(end > start)) end = new Date(start.getTime() + (e.allDay ? 86400000 : 3600000));
  return { key: `e-${e.source}-${e.id}`, kind: 'event', title: e.title || '(No title)', start, end, allDay: e.allDay, color: e.color || '#6366f1', readOnly: e.source !== 'local', event: e };
}

export function taskToItem(t: Task, color = '#94a3b8'): CalItem | null {
  if (!t.dueDate) return null;
  const day = fromISODate(t.dueDate);
  if (t.dueTime) {
    const [h, m] = t.dueTime.split(':').map(Number);
    const start = new Date(day); start.setHours(h, m || 0, 0, 0);
    return { key: `t-${t.id}`, kind: 'task', title: t.title, start, end: new Date(start.getTime() + 30 * 60000), allDay: false, color, readOnly: true, task: t };
  }
  return { key: `t-${t.id}`, kind: 'task', title: t.title, start: day, end: addDays(day, 1), allDay: true, color, readOnly: true, task: t };
}

/** Items overlapping the local calendar day `d`. */
export function itemsOnDay(items: CalItem[], d: Date) {
  const s = startOfDay(d).getTime();
  const e = s + 86400000;
  return items
    .filter((i) => i.start.getTime() < e && i.end.getTime() > s)
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime());
}

export const fmtTime = (d: Date, h24: boolean) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: !h24 });

/** Build a local ISO datetime from date ('YYYY-MM-DD') and time ('HH:mm'). */
export const combine = (date: string, time: string) => {
  const d = fromISODate(date);
  const [h, m] = (time || '00:00').split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toISOString();
};
export const timeOf = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
export const dateOf = (iso: string) => toISODate(new Date(iso));
