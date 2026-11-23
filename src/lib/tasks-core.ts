// Pure task helpers shared by the UI store and the service worker (no DOM / zustand).
import type { Priority, Recurrence, Task, TaskList } from './types';
import { addDays, fromISODate, toISODate, todayISO, uid } from './utils';

export const DEFAULT_LISTS: TaskList[] = [
  { id: 'personal', name: 'Personal', color: '#6366f1', order: 0 },
  { id: 'work', name: 'Work', color: '#0ea5e9', order: 1 },
  { id: 'education', name: 'Education', color: '#f59e0b', order: 2 },
  { id: 'health', name: 'Health', color: '#22c55e', order: 3 },
  { id: 'projects', name: 'Projects', color: '#ec4899', order: 4 },
];

export const PRIORITY_META: Record<Priority, { label: string; color: string; rank: number }> = {
  urgent: { label: 'Urgent', color: '#ef4444', rank: 4 },
  high: { label: 'High', color: '#f97316', rank: 3 },
  medium: { label: 'Medium', color: '#eab308', rank: 2 },
  low: { label: 'Low', color: '#0ea5e9', rank: 1 },
  none: { label: 'None', color: '#94a3b8', rank: 0 },
};

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: 'Does not repeat',
  daily: 'Every day',
  weekdays: 'Every weekday',
  weekly: 'Every week',
  monthly: 'Every month',
  yearly: 'Every year',
};

export function makeTask(input: Partial<Task> & { title: string }, order = 0): Task {
  const now = new Date().toISOString();
  return {
    id: uid(),
    listId: 'personal',
    description: '',
    priority: 'none',
    dueDate: null,
    dueTime: null,
    reminderAt: null,
    recurrence: 'none',
    category: '',
    subtasks: [],
    done: false,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    order,
    focusMinutes: 0,
    ...input,
    title: input.title.trim(),
  };
}

export function nextDueDate(date: string | null, rec: Recurrence): string | null {
  if (rec === 'none') return date;
  const base = date ? fromISODate(date) : new Date();
  // never schedule the next occurrence in the past
  const today = fromISODate(todayISO());
  let d = new Date(base);
  const step = () => {
    switch (rec) {
      case 'daily': d = addDays(d, 1); break;
      case 'weekdays': do { d = addDays(d, 1); } while (d.getDay() === 0 || d.getDay() === 6); break;
      case 'weekly': d = addDays(d, 7); break;
      case 'monthly': { const n = new Date(d); n.setMonth(n.getMonth() + 1); d = n; break; }
      case 'yearly': { const n = new Date(d); n.setFullYear(n.getFullYear() + 1); d = n; break; }
    }
  };
  step();
  let guard = 0;
  while (d < today && guard++ < 1000) step();
  return toISODate(d);
}

/** Toggle completion; completing a recurring task spawns the next occurrence. */
export function applyToggle(tasks: Task[], id: string): Task[] {
  const t = tasks.find((x) => x.id === id);
  if (!t) return tasks;
  const now = new Date().toISOString();
  const done = !t.done;
  let out = tasks.map((x) => (x.id === id ? { ...x, done, completedAt: done ? now : null, updatedAt: now } : x));
  if (done && t.recurrence !== 'none') {
    const due = nextDueDate(t.dueDate, t.recurrence);
    let reminderAt: string | null = null;
    if (t.reminderAt && t.dueDate && due) {
      const shift = fromISODate(due).getTime() - fromISODate(t.dueDate).getTime();
      reminderAt = new Date(new Date(t.reminderAt).getTime() + shift).toISOString();
    }
    const next = makeTask({
      ...t,
      id: uid(),
      title: t.title,
      dueDate: due,
      reminderAt,
      done: false,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      focusMinutes: 0,
      subtasks: t.subtasks.map((s) => ({ ...s, id: uid(), done: false })),
    });
    out = [...out, next];
  }
  return out;
}

const dueKey = (t: Task) => (t.dueDate ? `${t.dueDate}T${t.dueTime ?? '23:59'}` : '9999');

/** Most important open task: priority, then overdue/soonest due, then manual order. */
export function topTask(tasks: Task[]): Task | undefined {
  return [...tasks.filter((t) => !t.done)].sort((a, b) => {
    const p = PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank;
    if (p) return p;
    const d = dueKey(a).localeCompare(dueKey(b));
    if (d) return d;
    return a.order - b.order;
  })[0];
}

export const isOverdue = (t: Task) => !t.done && !!t.dueDate && t.dueDate < todayISO();
export const isDueToday = (t: Task) => !!t.dueDate && t.dueDate === todayISO();

export function formatDue(t: Task): string {
  if (!t.dueDate) return '';
  const today = todayISO();
  const tomorrow = toISODate(addDays(new Date(), 1));
  const yesterday = toISODate(addDays(new Date(), -1));
  let label: string;
  if (t.dueDate === today) label = 'Today';
  else if (t.dueDate === tomorrow) label = 'Tomorrow';
  else if (t.dueDate === yesterday) label = 'Yesterday';
  else {
    const d = fromISODate(t.dueDate);
    label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
  }
  return t.dueTime ? `${label} ${t.dueTime}` : label;
}
