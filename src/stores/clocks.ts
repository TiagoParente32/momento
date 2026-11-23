import { createPersisted } from '@/lib/persist';
import { KEYS } from '@/lib/storage';
import { uid } from '@/lib/utils';
import type { WorldClock } from '@/lib/types';

export const useClocks = createPersisted(KEYS.clocks, { clocks: [] as WorldClock[] }, (set, get) => ({
  addClock(label: string, timezone: string, country?: string) {
    if (get().clocks.some((c) => c.timezone === timezone && c.label === label)) return;
    set((s) => ({ clocks: [...s.clocks, { id: uid(), label, timezone, country }] }));
  },
  removeClock(id: string) {
    set((s) => ({ clocks: s.clocks.filter((c) => c.id !== id) }));
  },
  renameClock(id: string, label: string) {
    set((s) => ({ clocks: s.clocks.map((c) => (c.id === id ? { ...c, label: label.trim() || c.label } : c)) }));
  },
  moveClock(id: string, delta: number) {
    const list = [...get().clocks];
    const i = list.findIndex((c) => c.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    set({ clocks: list });
  },
  /** Move clock to a target index (drag & drop). */
  reorderClock(id: string, toIndex: number) {
    const list = [...get().clocks];
    const i = list.findIndex((c) => c.id === id);
    if (i < 0) return;
    const [item] = list.splice(i, 1);
    list.splice(Math.max(0, Math.min(toIndex, list.length)), 0, item);
    set({ clocks: list });
  },
}));

/** Time parts in a timezone, plus day offset vs local. DST handled by Intl. */
export function zonedTime(now: Date, timeZone: string, h24: boolean) {
  try {
    const time = new Intl.DateTimeFormat(undefined, { timeZone, hour: 'numeric', minute: '2-digit', hour12: !h24 }).format(now);
    const ymd = (tz?: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const there = ymd(timeZone), here = ymd();
    const dayOffset = there === here ? 0 : there > here ? 1 : -1;
    const offsetName = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' }).formatToParts(now).find((p) => p.type === 'timeZoneName')?.value ?? '';
    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hour12: false }).format(now)) % 24;
    return { time, dayOffset, offsetName, isNight: hour < 6 || hour >= 20, valid: true };
  } catch {
    return { time: '--:--', dayOffset: 0, offsetName: '', isNight: false, valid: false };
  }
}
