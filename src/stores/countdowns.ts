import { createPersisted } from '@/lib/persist';
import { KEYS } from '@/lib/storage';
import { daysBetween, fromISODate, toISODate, uid } from '@/lib/utils';
import type { Countdown, CountdownKind } from '@/lib/types';

export const COUNTDOWN_KINDS: { value: CountdownKind; label: string; emoji: string }[] = [
  { value: 'birthday', label: 'Birthday', emoji: '🎂' },
  { value: 'exam', label: 'Exam', emoji: '📝' },
  { value: 'holiday', label: 'Holiday', emoji: '🎉' },
  { value: 'vacation', label: 'Vacation', emoji: '🏖️' },
  { value: 'deadline', label: 'Deadline', emoji: '⏰' },
  { value: 'milestone', label: 'Milestone', emoji: '🏁' },
  { value: 'other', label: 'Other', emoji: '✨' },
];
export const kindMeta = (k: CountdownKind) => COUNTDOWN_KINDS.find((x) => x.value === k) ?? COUNTDOWN_KINDS[6];

/** Next occurrence date (for yearly-repeating countdowns) or the date itself. */
export function nextOccurrence(c: Countdown, today = new Date()): Date {
  const d = fromISODate(c.date);
  if (!c.repeatYearly) return d;
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const next = new Date(t.getFullYear(), d.getMonth(), d.getDate());
  if (next < t) next.setFullYear(t.getFullYear() + 1);
  return next;
}

/** Days remaining (negative if past, 0 = today). */
export function daysUntil(c: Countdown, today = new Date()) {
  return daysBetween(today, nextOccurrence(c, today));
}

export function formatDays(n: number) {
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  return n > 0 ? `${n} days` : `${-n} days ago`;
}

export type CountdownInput = Omit<Countdown, 'id'>;

export const useCountdowns = createPersisted(KEYS.countdowns, { countdowns: [] as Countdown[] }, (set) => ({
  addCountdown(input: CountdownInput) {
    const c: Countdown = { ...input, id: uid() };
    set((s) => ({ countdowns: [...s.countdowns, c] }));
    return c;
  },
  updateCountdown(id: string, patch: Partial<Countdown>) {
    set((s) => ({ countdowns: s.countdowns.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  },
  removeCountdown(id: string) {
    set((s) => ({ countdowns: s.countdowns.filter((c) => c.id !== id) }));
  },
  togglePin(id: string) {
    set((s) => ({ countdowns: s.countdowns.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)) }));
  },
}));

export const emptyCountdown = (): CountdownInput => ({
  title: '',
  date: toISODate(new Date(Date.now() + 7 * 86400000)),
  kind: 'milestone',
  color: '#7c83ff',
  repeatYearly: false,
  pinned: true,
});
