import { createPersisted } from '@/lib/persist';
import { KEYS } from '@/lib/storage';
import { todayISO, uid } from '@/lib/utils';
import type { CustomMetric, ISODate, PersonalGoal } from '@/lib/types';

export const METRIC_TEMPLATES: Omit<CustomMetric, 'id' | 'entries'>[] = [
  { name: 'Books read', unit: 'books', color: '#8b5cf6', dailyGoal: null, icon: '📚' },
  { name: 'Workouts', unit: 'workouts', color: '#f97316', dailyGoal: 1, icon: '💪' },
  { name: 'Hours studied', unit: 'h', color: '#0ea5e9', dailyGoal: 2, icon: '🎓' },
  { name: 'Water', unit: 'glasses', color: '#14b8a6', dailyGoal: 8, icon: '💧' },
  { name: 'Projects completed', unit: 'projects', color: '#22c55e', dailyGoal: null, icon: '🚀' },
];

export const useMetrics = createPersisted(
  KEYS.metrics,
  { metrics: [] as CustomMetric[], goals: [] as PersonalGoal[] },
  (set, get) => ({
    addMetric(input: Omit<CustomMetric, 'id' | 'entries'>) {
      const m: CustomMetric = { ...input, id: uid(), entries: {} };
      set((s) => ({ metrics: [...s.metrics, m] }));
      return m;
    },
    updateMetric(id: string, patch: Partial<Omit<CustomMetric, 'id' | 'entries'>>) {
      set((s) => ({ metrics: s.metrics.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
    },
    removeMetric(id: string) {
      set((s) => ({ metrics: s.metrics.filter((m) => m.id !== id) }));
    },
    logValue(id: string, date: ISODate, value: number) {
      set((s) => ({
        metrics: s.metrics.map((m) => {
          if (m.id !== id) return m;
          const entries = { ...m.entries };
          if (!Number.isFinite(value) || value <= 0) delete entries[date];
          else entries[date] = Math.round(value * 100) / 100;
          return { ...m, entries };
        }),
      }));
    },
    increment(id: string, delta: number, date: ISODate = todayISO()) {
      const m = get().metrics.find((x) => x.id === id);
      if (!m) return;
      useMetrics.getState().logValue(id, date, Math.max(0, (m.entries[date] ?? 0) + delta));
    },
    addGoal(input: Omit<PersonalGoal, 'id'>) {
      set((s) => ({ goals: [...s.goals, { ...input, id: uid() }] }));
    },
    updateGoal(id: string, patch: Partial<PersonalGoal>) {
      set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
    },
    removeGoal(id: string) {
      set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }));
    },
    bumpGoal(id: string, delta: number) {
      set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, progress: Math.max(0, Math.round((g.progress + delta) * 100) / 100) } : g)) }));
    },
  }),
);

export const metricTotal = (m: CustomMetric, dates?: ISODate[]) =>
  (dates ?? Object.keys(m.entries)).reduce((sum, d) => sum + (m.entries[d] ?? 0), 0);
