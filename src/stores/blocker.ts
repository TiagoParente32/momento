import { createPersisted } from '@/lib/persist';
import { KEYS } from '@/lib/storage';
import { normalizeDomain, uid } from '@/lib/utils';
import { DEFAULT_BLOCKER } from '@/lib/blocker-core';
import type { BlockSchedule, BlockerState } from '@/lib/types';

export { blockingActive, SUGGESTED_SITES, DEFAULT_BLOCKER } from '@/lib/blocker-core';

/** Persisted shape under KEYS.blocker: `{ blocker: BlockerState }`. */
export const useBlocker = createPersisted(
  KEYS.blocker,
  { blocker: DEFAULT_BLOCKER },
  (set, get) => {
    const patch = (p: Partial<BlockerState>) => set((s) => ({ blocker: { ...s.blocker, ...p } }));
    return {
      /** Returns false if the input was not a valid domain. */
      addSite(input: string): boolean {
        const d = normalizeDomain(input);
        if (!d || !d.includes('.')) return false;
        const sites = get().blocker.sites;
        if (!sites.includes(d)) patch({ sites: [...sites, d].sort() });
        return true;
      },
      removeSite(domain: string) { patch({ sites: get().blocker.sites.filter((s) => s !== domain) }); },
      addAllow(input: string): boolean {
        const d = normalizeDomain(input);
        if (!d || !d.includes('.')) return false;
        const list = get().blocker.allowlist;
        if (!list.includes(d)) patch({ allowlist: [...list, d].sort() });
        return true;
      },
      removeAllow(domain: string) { patch({ allowlist: get().blocker.allowlist.filter((s) => s !== domain) }); },
      setAlwaysOn(v: boolean) { patch({ alwaysOn: v }); },
      addSchedule(s?: Partial<BlockSchedule>): BlockSchedule {
        const sched: BlockSchedule = { id: uid(), name: 'Deep work', days: [1, 2, 3, 4, 5], start: '09:00', end: '12:00', enabled: true, ...s };
        patch({ schedules: [...get().blocker.schedules, sched] });
        return sched;
      },
      updateSchedule(id: string, p: Partial<BlockSchedule>) {
        patch({ schedules: get().blocker.schedules.map((s) => (s.id === id ? { ...s, ...p } : s)) });
      },
      removeSchedule(id: string) { patch({ schedules: get().blocker.schedules.filter((s) => s.id !== id) }); },
      snooze(minutes: number) { patch({ snoozeUntil: Date.now() + minutes * 60000 }); },
      clearSnooze() { patch({ snoozeUntil: null }); },
    };
  },
  (stored) => ({ blocker: { ...DEFAULT_BLOCKER, ...stored?.blocker } }),
);
