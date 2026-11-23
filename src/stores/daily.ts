import { createPersisted } from '@/lib/persist';
import { KEYS } from '@/lib/storage';
import { todayISO } from '@/lib/utils';
import type { DailyGoal } from '@/lib/types';

/** Daily main goal ("What is your main focus today?") with history. */
export const useDaily = createPersisted(
  KEYS.daily,
  { goals: [] as DailyGoal[] },
  (set, get) => ({
    today(): DailyGoal | undefined {
      return get().goals.find((g) => g.date === todayISO());
    },
    setGoal(text: string) {
      const date = todayISO();
      set((s) => {
        const rest = s.goals.filter((g) => g.date !== date);
        return { goals: text.trim() ? [...rest, { date, text: text.trim(), done: false }].slice(-365) : rest };
      });
    },
    toggleGoal() {
      const date = todayISO();
      set((s) => ({ goals: s.goals.map((g) => (g.date === date ? { ...g, done: !g.done } : g)) }));
    },
  }),
);
