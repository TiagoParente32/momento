import type { Settings } from './types';
import { inTimeWindow } from './utils';

/** True when Balance Mode is on and we are outside configured working hours. */
export function isDowntime(s: Settings, now = new Date()) {
  if (!s.balance.enabled) return false;
  const { days, start, end } = s.balance.work;
  return !inTimeWindow(now, days, start, end);
}
