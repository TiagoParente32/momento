import { KEYS, getItem } from '@/lib/storage';
import type { Settings } from '@/lib/types';

export type NotifyKind = 'focus' | 'reminders' | 'events' | 'breaks';

/** Respect Settings.notifications (defaults to enabled when settings are missing). */
export async function notificationsAllowed(kind: NotifyKind): Promise<boolean> {
  const stored = await getItem<{ settings?: Settings }>(KEYS.settings);
  const n = stored?.settings?.notifications;
  if (!n) return true;
  return n.enabled !== false && n[kind] !== false;
}

export async function notify(id: string, kind: NotifyKind, opts: { title: string; message: string; buttons?: string[]; requireInteraction?: boolean }) {
  if (!(await notificationsAllowed(kind))) return;
  try {
    await chrome.notifications.clear(id);
    await chrome.notifications.create(id, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
      title: opts.title,
      message: opts.message,
      buttons: opts.buttons?.map((title) => ({ title })),
      requireInteraction: opts.requireInteraction ?? false,
      priority: 2,
    });
  } catch (e) {
    console.warn('[momento] notification failed', e);
  }
}

export const openNewtab = (hash = '') => chrome.tabs.create({ url: chrome.runtime.getURL('newtab.html') + hash });
