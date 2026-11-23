// Focus timer finaliser: owns the 'focus-end' alarm and phase transitions.
import { KEYS, getItem, setItem } from '@/lib/storage';
import { DEFAULT_FOCUS, DEFAULT_FOCUS_SETTINGS, PHASE_LABEL, completePhase, startTimer, skipPhase, type FocusData, type Transition } from '@/lib/focus-core';
import type { Task } from '@/lib/types';
import { notify, openNewtab } from './notify';

const ALARM = 'focus-end';
const NOTIF = 'focus-done';

async function load(): Promise<FocusData> {
  const s = await getItem<Partial<FocusData>>(KEYS.focus);
  return {
    timer: s?.timer ?? DEFAULT_FOCUS.timer,
    sessions: s?.sessions ?? [],
    settings: { ...DEFAULT_FOCUS_SETTINGS, ...s?.settings },
  };
}

async function creditTask(tr: Transition) {
  if (!tr.credit || tr.credit.minutes <= 0) return;
  const stored = await getItem<{ tasks: Task[]; lists: unknown[] }>(KEYS.tasks);
  if (!stored?.tasks) return;
  const { taskId, minutes } = tr.credit;
  await setItem(KEYS.tasks, { ...stored, tasks: stored.tasks.map((t) => (t.id === taskId ? { ...t, focusMinutes: (t.focusMinutes || 0) + minutes } : t)) });
}

async function schedule(data?: FocusData) {
  const d = data ?? (await load());
  if (d.timer.status === 'running' && d.timer.endsAt) {
    const existing = await chrome.alarms.get(ALARM);
    if (!existing || Math.abs(existing.scheduledTime - d.timer.endsAt) > 500) {
      await chrome.alarms.create(ALARM, { when: Math.max(Date.now() + 100, d.timer.endsAt) });
    }
  } else {
    await chrome.alarms.clear(ALARM);
  }
}

async function finalize() {
  const data = await load();
  const t = data.timer;
  if (t.status !== 'running' || !t.endsAt) return;
  if (t.endsAt > Date.now() + 1500) { await schedule(data); return; } // fired early / rescheduled
  const tr = completePhase(data, t.endsAt, true);
  await setItem(KEYS.focus, tr.data);
  await creditTask(tr);
  await schedule(tr.data);

  if (!data.settings.notify) return;
  const next = tr.data.timer;
  const autoStarted = next.status === 'running';
  const finished = tr.finished ?? t.phase;
  const title = finished === 'work' ? 'Focus session complete 🎉' : 'Break is over';
  const nextLabel = PHASE_LABEL[next.phase].toLowerCase();
  const message = autoStarted
    ? `Your ${nextLabel} has started (${Math.round(next.durationMs / 60000)} min).`
    : finished === 'work'
      ? data.settings.pomodoro ? `Great work! Time for a ${nextLabel}.` : 'Great work! Take a moment before the next one.'
      : 'Ready to focus again?';
  const buttons = autoStarted ? undefined : finished === 'work' && data.settings.pomodoro ? [`Start ${nextLabel}`, 'Skip break'] : ['Start focus'];
  await notify(NOTIF, 'focus', { title, message, buttons, requireInteraction: !autoStarted });
}

export async function init() {
  const data = await load();
  if (data.timer.status === 'running' && data.timer.endsAt && data.timer.endsAt <= Date.now()) await finalize();
  else await schedule(data);
}

export async function onAlarm(a: chrome.alarms.Alarm) {
  if (a.name !== ALARM) return false;
  await finalize();
  return true;
}

export function onStorage(changes: Record<string, chrome.storage.StorageChange>) {
  if (KEYS.focus in changes) void schedule(changes[KEYS.focus].newValue as FocusData | undefined);
}

export function onMessage(msg: any) {
  if (msg?.type === 'focus:finalize') return finalize().then(() => ({ ok: true }));
  return undefined;
}

export function onNotificationClick(id: string) {
  if (id !== NOTIF) return false;
  void openNewtab('#panel=focus');
  void chrome.notifications.clear(id);
  return true;
}

export function onNotificationButton(id: string, index: number) {
  if (id !== NOTIF) return false;
  void (async () => {
    let data = await load();
    if (data.timer.status === 'idle') {
      if (index === 1 && data.timer.phase !== 'work') data = skipPhase(data, Date.now()).data; // "Skip break"
      data = startTimer(data, Date.now());
      await setItem(KEYS.focus, data);
      await schedule(data);
    }
    await chrome.notifications.clear(id);
  })();
  return true;
}
