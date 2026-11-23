// Pure focus-timer state machine shared by the UI store and the service worker.
import type { FocusPhase, FocusSession, FocusSettings, FocusTimerState } from './types';
import { startOfDay, startOfWeek, uid } from './utils';

export interface FocusData {
  timer: FocusTimerState;
  sessions: FocusSession[];
  settings: FocusSettings;
}

export const DEFAULT_FOCUS_SETTINGS: FocusSettings = {
  workMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  longBreakEvery: 4,
  autoStartBreaks: false,
  autoStartWork: false,
  pomodoro: true,
  notify: true,
  sound: 'none',
  volume: 0.5,
  blockDuringFocus: true,
  blockDuringBreaks: false,
};

export const PHASE_LABEL: Record<FocusPhase, string> = { work: 'Focus', shortBreak: 'Short break', longBreak: 'Long break' };

export const phaseMinutes = (s: FocusSettings, p: FocusPhase) => (p === 'work' ? s.workMin : p === 'shortBreak' ? s.shortBreakMin : s.longBreakMin);

export const idleTimer = (s: FocusSettings, phase: FocusPhase = 'work', taskId: string | null = null, cycleCount = 0): FocusTimerState => {
  const ms = phaseMinutes(s, phase) * 60000;
  return { status: 'idle', phase, endsAt: null, remainingMs: ms, durationMs: ms, taskId, cycleCount, startedAt: null };
};

export const DEFAULT_FOCUS: FocusData = {
  timer: idleTimer(DEFAULT_FOCUS_SETTINGS),
  sessions: [],
  settings: DEFAULT_FOCUS_SETTINGS,
};

export const remainingMs = (t: FocusTimerState, now = Date.now()) =>
  t.status === 'running' && t.endsAt ? Math.max(0, t.endsAt - now) : t.remainingMs;

export interface Transition {
  data: FocusData;
  /** minutes to credit to a linked task */
  credit?: { taskId: string; minutes: number };
  /** set when a phase ended naturally */
  finished?: FocusPhase;
}

/** Record the elapsed part of the current phase (work phases ≥1 min, breaks when completed). */
function record(data: FocusData, now: number, completed: boolean): Transition {
  const t = data.timer;
  const elapsed = t.durationMs - remainingMs(t, now);
  const minutes = Math.round((elapsed / 60000) * 10) / 10;
  if (t.status === 'idle' || minutes < (completed ? 0.1 : 1) || (!completed && t.phase !== 'work')) return { data };
  const session: FocusSession = {
    id: uid(),
    phase: t.phase,
    startedAt: new Date(t.startedAt ?? now - elapsed).toISOString(),
    endedAt: new Date(now).toISOString(),
    minutes,
    taskId: t.taskId,
    completed,
  };
  const sessions = [...data.sessions, session].slice(-5000);
  const credit = t.phase === 'work' && t.taskId ? { taskId: t.taskId, minutes: Math.round(minutes) } : undefined;
  return { data: { ...data, sessions }, credit };
}

export function startTimer(data: FocusData, now: number, opts: { minutes?: number; phase?: FocusPhase; taskId?: string | null } = {}): FocusData {
  const t = data.timer;
  if (t.status === 'paused' && opts.minutes == null && opts.phase == null) return resumeTimer(data, now);
  const phase = opts.phase ?? t.phase;
  const durationMs =
    opts.minutes != null ? Math.max(1, opts.minutes) * 60000 : t.status === 'idle' && phase === t.phase ? t.durationMs : phaseMinutes(data.settings, phase) * 60000;
  return {
    ...data,
    timer: {
      ...t,
      status: 'running',
      phase,
      durationMs,
      remainingMs: durationMs,
      endsAt: now + durationMs,
      startedAt: now,
      taskId: opts.taskId !== undefined ? opts.taskId : t.taskId,
    },
  };
}

export function pauseTimer(data: FocusData, now: number): FocusData {
  const t = data.timer;
  if (t.status !== 'running') return data;
  return { ...data, timer: { ...t, status: 'paused', remainingMs: remainingMs(t, now), endsAt: null } };
}

export function resumeTimer(data: FocusData, now: number): FocusData {
  const t = data.timer;
  if (t.status !== 'paused') return data;
  return { ...data, timer: { ...t, status: 'running', endsAt: now + t.remainingMs } };
}

/** Stop the current phase early and return to idle (records partial work). */
export function resetTimer(data: FocusData, now: number): Transition {
  const r = record(data, now, false);
  const t = data.timer;
  return { ...r, data: { ...r.data, timer: idleTimer(data.settings, t.phase, t.taskId, t.cycleCount) } };
}

function nextPhase(data: FocusData, countCycle: boolean): { phase: FocusPhase; cycleCount: number } {
  const t = data.timer;
  if (t.phase !== 'work') return { phase: 'work', cycleCount: t.cycleCount };
  const cycleCount = countCycle ? t.cycleCount + 1 : t.cycleCount;
  if (!data.settings.pomodoro) return { phase: 'work', cycleCount };
  const long = countCycle && cycleCount > 0 && cycleCount % Math.max(1, data.settings.longBreakEvery) === 0;
  return { phase: long ? 'longBreak' : 'shortBreak', cycleCount };
}

/** Skip to the next phase without finishing the current one. */
export function skipPhase(data: FocusData, now: number): Transition {
  const r = record(data, now, false);
  const { phase, cycleCount } = nextPhase(data, false);
  return { ...r, data: { ...r.data, timer: idleTimer(data.settings, phase, data.timer.taskId, cycleCount) } };
}

/**
 * Finalise the current phase (natural end when completed=true). Records the
 * session, advances per pomodoro rules and auto-starts the next phase if configured.
 */
export function completePhase(data: FocusData, now: number, completed = true): Transition {
  const finished = data.timer.phase;
  const r = record(data, now, completed);
  const { phase, cycleCount } = nextPhase(data, completed);
  let next: FocusData = { ...r.data, timer: idleTimer(data.settings, phase, data.timer.taskId, cycleCount) };
  const auto = data.settings.pomodoro && (phase === 'work' ? data.settings.autoStartWork : data.settings.autoStartBreaks);
  if (completed && auto) next = startTimer(next, now, { phase });
  return { data: next, credit: r.credit, finished: completed ? finished : undefined };
}

// ---------- stats helpers ----------
export const workSessions = (sessions: FocusSession[]) => sessions.filter((s) => s.phase === 'work');

export function focusStats(sessions: FocusSession[], weekStartsOn: 0 | 1 = 1, now = new Date()) {
  const dayStart = startOfDay(now).getTime();
  const weekStart = startOfWeek(now, weekStartsOn).getTime();
  let todayMin = 0, todayCount = 0, weekMin = 0, weekCount = 0, totalMin = 0, totalCount = 0;
  for (const s of workSessions(sessions)) {
    const t = new Date(s.endedAt).getTime();
    totalMin += s.minutes;
    if (s.completed) totalCount++;
    if (t >= weekStart) { weekMin += s.minutes; if (s.completed) weekCount++; }
    if (t >= dayStart) { todayMin += s.minutes; if (s.completed) todayCount++; }
  }
  return { todayMin, todayCount, weekMin, weekCount, totalMin, totalCount };
}
