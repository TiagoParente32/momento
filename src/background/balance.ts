// Balance Mode: break reminders during working hours and a gentle "work day is over" nudge.
import { getItem, KEYS } from '@/lib/storage';
import { inTimeWindow, timeToMinutes } from '@/lib/utils';
import type { Settings } from '@/lib/types';

const BREAK = 'balance-break';
const END = 'balance-end';
const ICON = () => chrome.runtime.getURL('icons/icon-128.png');

async function loadSettings(): Promise<Settings | null> {
  const raw = await getItem<{ settings: Settings }>(KEYS.settings);
  return raw?.settings ?? null;
}

const notifyAllowed = (s: Settings) => s.notifications?.enabled !== false && s.notifications?.breaks !== false;

/** Next occurrence (epoch ms) of work end time on a working day. */
function nextWorkEnd(s: Settings, now = new Date()): number | null {
  const { days, end } = s.balance.work;
  if (!days.length) return null;
  const mins = timeToMinutes(end);
  for (let i = 0; i < 8; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    if (d.getTime() > now.getTime() + 1000 && days.includes(d.getDay())) return d.getTime();
  }
  return null;
}

let lastSig = '';
async function schedule(force = false) {
  const s = await loadSettings();
  const b = s?.balance;
  const sig = JSON.stringify([b, s?.notifications]);
  if (!force && sig === lastSig) return;
  lastSig = sig;

  await chrome.alarms.clear(BREAK);
  await chrome.alarms.clear(END);
  if (!s || !b?.enabled) return;

  if (b.breakReminders && b.breakEveryMin >= 5) {
    await chrome.alarms.create(BREAK, { delayInMinutes: b.breakEveryMin, periodInMinutes: b.breakEveryMin });
  }
  const end = nextWorkEnd(s);
  if (end) await chrome.alarms.create(END, { when: end });
}

export async function init() {
  await schedule(true);
}

export async function onAlarm(alarm: chrome.alarms.Alarm): Promise<boolean> {
  if (alarm.name !== BREAK && alarm.name !== END) return false;
  const s = await loadSettings();
  if (!s?.balance.enabled) return true;
  const { days, start, end } = s.balance.work;

  if (alarm.name === BREAK) {
    if (!inTimeWindow(new Date(), days, start, end) || !notifyAllowed(s)) return true;
    // Don't interrupt an active focus session.
    const focus = await getItem<{ timer?: { status?: string; phase?: string } }>(KEYS.focus);
    if (focus?.timer?.status === 'running' && focus.timer.phase === 'work') return true;
    chrome.notifications.create(`balance-break-${Date.now()}`, {
      type: 'basic',
      iconUrl: ICON(),
      title: 'Time for a short break',
      message: 'Stand up, stretch, drink some water and rest your eyes for a few minutes.',
      priority: 0,
    });
    return true;
  }

  // END
  if (notifyAllowed(s)) {
    chrome.notifications.create(`balance-end-${Date.now()}`, {
      type: 'basic',
      iconUrl: ICON(),
      title: 'Your work day is over',
      message: s.balance.downtimeMessage || 'Time to switch off and enjoy your evening.',
      priority: 0,
    });
  }
  const next = nextWorkEnd(s, new Date(Date.now() + 60_000));
  if (next) await chrome.alarms.create(END, { when: next });
  return true;
}

export function onStorage(changes: Record<string, chrome.storage.StorageChange>) {
  if (changes[KEYS.settings]) void schedule();
}
