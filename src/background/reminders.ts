// Task reminders ('task:<id>') and calendar event reminders ('event:<id>').
import { KEYS, getItem, setItem } from '@/lib/storage';
import { applyToggle } from '@/lib/tasks-core';
import type { CalendarEvent, Task } from '@/lib/types';
import { notify, openNewtab } from './notify';

const SNOOZE = 'snooze:task:';

async function loadTasks() {
  return (await getItem<{ tasks: Task[]; lists: unknown[] }>(KEYS.tasks)) ?? null;
}
async function loadEvents(): Promise<CalendarEvent[]> {
  return (await getItem<{ events: CalendarEvent[] }>(KEYS.calendar))?.events ?? [];
}

async function reconcile() {
  const now = Date.now();
  const tasks = (await loadTasks())?.tasks ?? [];
  const events = await loadEvents();
  const desired = new Map<string, number>();
  for (const t of tasks) {
    if (t.done || !t.reminderAt) continue;
    const when = new Date(t.reminderAt).getTime();
    if (when > now) desired.set(`task:${t.id}`, when);
  }
  for (const e of events) {
    if (e.reminderMin == null) continue;
    const when = new Date(e.start).getTime() - e.reminderMin * 60000;
    if (when > now) desired.set(`event:${e.id}`, when);
  }
  const alarms = await chrome.alarms.getAll();
  const openTaskIds = new Set(tasks.filter((t) => !t.done).map((t) => t.id));
  for (const a of alarms) {
    if (a.name.startsWith('task:') || a.name.startsWith('event:')) {
      const want = desired.get(a.name);
      if (want == null) await chrome.alarms.clear(a.name);
      else if (Math.abs(a.scheduledTime - want) < 1000) desired.delete(a.name);
    } else if (a.name.startsWith(SNOOZE) && !openTaskIds.has(a.name.slice(SNOOZE.length))) {
      await chrome.alarms.clear(a.name);
    }
  }
  for (const [name, when] of desired) await chrome.alarms.create(name, { when });
}

async function fireTask(id: string) {
  const t = (await loadTasks())?.tasks.find((x) => x.id === id);
  if (!t || t.done) return;
  const due = t.dueDate ? `Due ${t.dueDate}${t.dueTime ? ' ' + t.dueTime : ''}` : 'Reminder';
  await notify(`task:${id}`, 'reminders', {
    title: t.title,
    message: t.description ? `${due} · ${t.description.slice(0, 120)}` : due,
    buttons: ['Mark done', 'Snooze 10 min'],
    requireInteraction: true,
  });
}

async function fireEvent(id: string) {
  const e = (await loadEvents()).find((x) => x.id === id);
  if (!e) return;
  const start = new Date(e.start);
  const mins = Math.round((start.getTime() - Date.now()) / 60000);
  const when = e.allDay ? 'Today (all day)' : mins <= 0 ? 'Starting now' : `Starts in ${mins} min · ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  await notify(`event:${id}`, 'events', { title: e.title, message: e.location ? `${when} · ${e.location}` : when });
}

export async function init() {
  await reconcile();
}

export async function onAlarm(a: chrome.alarms.Alarm) {
  if (a.name.startsWith(SNOOZE)) { await fireTask(a.name.slice(SNOOZE.length)); return true; }
  if (a.name.startsWith('task:')) { await fireTask(a.name.slice(5)); return true; }
  if (a.name.startsWith('event:')) { await fireEvent(a.name.slice(6)); return true; }
  return false;
}

export function onStorage(changes: Record<string, chrome.storage.StorageChange>) {
  if (KEYS.tasks in changes || KEYS.calendar in changes) void reconcile();
}

export function onNotificationClick(id: string) {
  if (id.startsWith('task:')) {
    void openNewtab(`#panel=tasks&task=${id.slice(5)}`);
    void chrome.notifications.clear(id);
    return true;
  }
  if (id.startsWith('event:')) {
    void openNewtab('#panel=calendar');
    void chrome.notifications.clear(id);
    return true;
  }
  return false;
}

export function onNotificationButton(id: string, index: number) {
  if (!id.startsWith('task:')) return false;
  const taskId = id.slice(5);
  void (async () => {
    if (index === 0) {
      const stored = await loadTasks();
      const t = stored?.tasks.find((x) => x.id === taskId);
      if (stored && t && !t.done) await setItem(KEYS.tasks, { ...stored, tasks: applyToggle(stored.tasks, taskId) });
    } else {
      await chrome.alarms.create(SNOOZE + taskId, { when: Date.now() + 10 * 60000 });
    }
    await chrome.notifications.clear(id);
  })();
  return true;
}
