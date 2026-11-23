// Builds plain-text context about the user's day for Momento AI prompts.
// Reads other feature stores defensively (shapes documented in src/lib/types.ts).
import { useTasks } from '@/stores/tasks';
import { useNotes } from '@/stores/notes';
import { useCalendar } from '@/stores/calendar';
import { useFocus } from '@/stores/focus';
import { useDaily } from '@/stores/daily';
import { useSettings } from '@/stores/settings';
import type { CalendarEvent, FocusSession, Note, Task, TaskList } from '@/lib/types';
import { addDays, sameDay, todayISO, toISODate } from '@/lib/utils';

const tasksState = () => useTasks.getState() as unknown as { tasks: Task[]; lists: TaskList[] };
const notesState = () => useNotes.getState() as unknown as { notes: Note[] };
const calState = () => useCalendar.getState() as unknown as { events?: CalendarEvent[]; external?: CalendarEvent[] };
const focusState = () => useFocus.getState() as unknown as { sessions?: FocusSession[] };

export const stripHtml = (html: string) => {
  const d = document.createElement('div');
  d.innerHTML = html.replace(/<(br|\/p|\/div|\/li|\/h\d)>/gi, '\n$&');
  return (d.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
};

export function listsForPicker(): TaskList[] {
  return [...(tasksState().lists ?? [])].sort((a, b) => a.order - b.order);
}

export function notesForPicker(): Note[] {
  return [...(notesState().notes ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function noteText(id: string) {
  const n = notesState().notes?.find((x) => x.id === id);
  return n ? { title: n.title || 'Untitled', text: stripHtml(n.html).slice(0, 30_000) } : null;
}

export function todayContext(): string {
  const today = todayISO();
  const { tasks = [], lists = [] } = tasksState();
  const listName = (id: string) => lists.find((l) => l.id === id)?.name ?? '';
  const open = tasks.filter((t) => !t.done);
  const dueToday = open.filter((t) => t.dueDate && t.dueDate <= today);
  const important = open.filter((t) => t.priority === 'high' || t.priority === 'urgent');
  const pick = [...new Map([...dueToday, ...important, ...open.slice(0, 10)].map((t) => [t.id, t])).values()].slice(0, 25);
  const goal = useDaily.getState().goals.find((g) => g.date === today);
  const cal = calState();
  const now = new Date();
  const events = [...(cal.events ?? []), ...(cal.external ?? [])]
    .filter((e) => sameDay(new Date(e.start), now))
    .sort((a, b) => a.start.localeCompare(b.start));
  const name = useSettings.getState().settings.name;

  const lines: string[] = [];
  lines.push(`Today is ${now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}, current time ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`);
  if (name) lines.push(`User's name: ${name}.`);
  lines.push(goal ? `Main goal for today: "${goal.text}"${goal.done ? ' (done)' : ''}.` : 'No main goal set for today.');
  lines.push(events.length ? `Calendar today:\n${events.map((e) => `- ${e.allDay ? 'All day' : new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '–' + new Date(e.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}: ${e.title}`).join('\n')}` : 'No calendar events today.');
  lines.push(pick.length
    ? `Open tasks:\n${pick.map((t) => `- ${t.title}${t.priority !== 'none' ? ` [${t.priority}]` : ''}${t.dueDate ? ` (due ${t.dueDate}${t.dueTime ? ' ' + t.dueTime : ''})` : ''}${listName(t.listId) ? ` {${listName(t.listId)}}` : ''}`).join('\n')}`
    : 'No open tasks.');
  return lines.join('\n');
}

export function statsContext(days = 7): string {
  const since = toISODate(addDays(new Date(), -days + 1));
  const sessions = (focusState().sessions ?? []).filter((s) => s.phase === 'work' && s.startedAt.slice(0, 10) >= since);
  const focusMin = sessions.reduce((n, s) => n + s.minutes, 0);
  const completedSessions = sessions.filter((s) => s.completed).length;
  const { tasks = [] } = tasksState();
  const done = tasks.filter((t) => t.done && t.completedAt && t.completedAt.slice(0, 10) >= since);
  const created = tasks.filter((t) => t.createdAt.slice(0, 10) >= since);
  const overdue = tasks.filter((t) => !t.done && t.dueDate && t.dueDate < todayISO());
  const byHour = new Map<number, number>();
  sessions.forEach((s) => { const h = new Date(s.startedAt).getHours(); byHour.set(h, (byHour.get(h) ?? 0) + s.minutes); });
  const bestHour = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0];
  const goals = useDaily.getState().goals.filter((g) => g.date >= since);
  return [
    `Last ${days} days:`,
    `- Focus: ${Math.round(focusMin)} minutes over ${sessions.length} work sessions (${completedSessions} completed fully).`,
    bestHour ? `- Most focused hour of day: ${bestHour[0]}:00.` : '- No focus sessions recorded.',
    `- Tasks completed: ${done.length}; tasks created: ${created.length}; currently overdue: ${overdue.length}.`,
    `- Daily goals set: ${goals.length}, achieved: ${goals.filter((g) => g.done).length}.`,
  ].join('\n');
}

export function reflectionContext(): string {
  const today = todayISO();
  const { tasks = [] } = tasksState();
  const doneToday = tasks.filter((t) => t.done && t.completedAt?.slice(0, 10) === today);
  const sessions = (focusState().sessions ?? []).filter((s) => s.phase === 'work' && s.startedAt.slice(0, 10) === today);
  const goal = useDaily.getState().goals.find((g) => g.date === today);
  return [
    goal ? `Today's goal: "${goal.text}" — ${goal.done ? 'achieved' : 'not yet achieved'}.` : 'No goal set today.',
    `Focus today: ${sessions.reduce((n, s) => n + s.minutes, 0)} minutes in ${sessions.length} sessions.`,
    doneToday.length ? `Completed today:\n${doneToday.map((t) => `- ${t.title}`).join('\n')}` : 'No tasks completed today yet.',
  ].join('\n');
}

export const isoToday = todayISO;
