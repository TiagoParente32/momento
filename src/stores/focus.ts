import { createPersisted } from '@/lib/persist';
import { KEYS, isExtension } from '@/lib/storage';
import {
  DEFAULT_FOCUS, DEFAULT_FOCUS_SETTINGS, completePhase as completePhaseCore, idleTimer, pauseTimer, resetTimer,
  resumeTimer, skipPhase, startTimer, type FocusData, type Transition,
} from '@/lib/focus-core';
import type { FocusPhase, FocusSettings } from '@/lib/types';
import { useTasks } from './tasks';

export { completePhase, focusStats, remainingMs, PHASE_LABEL, phaseMinutes, DEFAULT_FOCUS_SETTINGS } from '@/lib/focus-core';
export type { FocusData } from '@/lib/focus-core';

const credit = (tr: Transition) => {
  if (tr.credit && tr.credit.minutes > 0) useTasks.getState().addFocusMinutes(tr.credit.taskId, tr.credit.minutes);
};

/**
 * Persisted shape under KEYS.focus: `{ timer, sessions, settings }` (see FocusData).
 * When running as an extension the service worker finalises phases (alarm 'focus-end');
 * under `vite dev` the UI calls `tick()` which finalises itself.
 */
export const useFocus = createPersisted(
  KEYS.focus,
  { timer: DEFAULT_FOCUS.timer, sessions: DEFAULT_FOCUS.sessions, settings: DEFAULT_FOCUS.settings },
  (set, get) => {
    const data = (): FocusData => ({ timer: get().timer, sessions: get().sessions, settings: get().settings });
    const apply = (d: FocusData) => set({ timer: d.timer, sessions: d.sessions, settings: d.settings });
    return {
      start(opts?: { minutes?: number; phase?: FocusPhase; taskId?: string | null }) {
        apply(startTimer(data(), Date.now(), opts));
      },
      pause() { apply(pauseTimer(data(), Date.now())); },
      resume() { apply(resumeTimer(data(), Date.now())); },
      reset() { const tr = resetTimer(data(), Date.now()); credit(tr); apply(tr.data); },
      skip() { const tr = skipPhase(data(), Date.now()); credit(tr); apply(tr.data); },
      setTask(id: string | null) { set((s) => ({ timer: { ...s.timer, taskId: id } })); },
      /** Switch phase while idle. */
      setPhase(phase: FocusPhase) {
        const t = get().timer;
        if (t.status !== 'idle') return;
        set({ timer: idleTimer(get().settings, phase, t.taskId, t.cycleCount) });
      },
      /** Set a custom duration for the idle timer. */
      setDuration(minutes: number) {
        const t = get().timer;
        if (t.status !== 'idle') return;
        const ms = Math.max(1, Math.min(600, Math.round(minutes))) * 60000;
        set({ timer: { ...t, durationMs: ms, remainingMs: ms } });
      },
      updateSettings(patch: Partial<FocusSettings>) {
        const settings = { ...get().settings, ...patch };
        const t = get().timer;
        const durChanged = ['workMin', 'shortBreakMin', 'longBreakMin'].some((k) => k in patch);
        set({ settings, timer: t.status === 'idle' && durChanged ? idleTimer(settings, t.phase, t.taskId, t.cycleCount) : t });
      },
      /** Dev-mode fallback finaliser; no-op inside the extension (worker owns it). */
      tick() {
        if (isExtension) return;
        const t = get().timer;
        if (t.status === 'running' && t.endsAt && Date.now() >= t.endsAt) {
          const tr = completePhaseCore(data(), Date.now(), true);
          credit(tr);
          apply(tr.data);
        }
      },
      clearHistory() { set({ sessions: [] }); },
    };
  },
  (stored) => ({
    timer: stored?.timer ?? DEFAULT_FOCUS.timer,
    sessions: Array.isArray(stored?.sessions) ? stored.sessions : [],
    settings: { ...DEFAULT_FOCUS_SETTINGS, ...stored?.settings },
  }),
);
