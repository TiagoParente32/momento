// Pure blocker helpers shared by UI and service worker.
import type { BlockerState, FocusSettings, FocusTimerState } from './types';
import { inTimeWindow } from './utils';

export const DEFAULT_BLOCKER: BlockerState = {
  sites: [],
  allowlist: [],
  alwaysOn: false,
  schedules: [],
  snoozeUntil: null,
};

export const SUGGESTED_SITES = [
  'youtube.com', 'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'reddit.com', 'tiktok.com',
  'netflix.com', 'twitch.tv', 'linkedin.com', 'news.ycombinator.com', 'pinterest.com',
];

export function blockingActive(
  blocker: BlockerState,
  focusTimer: FocusTimerState | null | undefined,
  focusSettings: FocusSettings | null | undefined,
  now: Date = new Date(),
): { active: boolean; reason: string } {
  if (!blocker.sites.length) return { active: false, reason: 'No sites in your blocklist' };
  if (blocker.snoozeUntil && blocker.snoozeUntil > now.getTime()) {
    return { active: false, reason: `Snoozed until ${new Date(blocker.snoozeUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` };
  }
  if (blocker.alwaysOn) return { active: true, reason: 'Always on' };
  if (focusSettings?.blockDuringFocus && focusTimer?.status === 'running') {
    if (focusTimer.phase === 'work') return { active: true, reason: 'Focus session in progress' };
    if (focusSettings.blockDuringBreaks) return { active: true, reason: 'Break in progress – keep the momentum' };
  }
  const sched = blocker.schedules.find((s) => s.enabled && inTimeWindow(now, s.days, s.start, s.end));
  if (sched) return { active: true, reason: `Scheduled: ${sched.name}` };
  return { active: false, reason: 'Not blocking right now' };
}
