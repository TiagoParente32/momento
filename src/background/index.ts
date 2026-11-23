// Momento background service worker (MV3, ES module).
// Each feature module exports:
//   init(): void | Promise<void>                  – called on every worker start
//   onAlarm?(alarm): boolean | Promise<boolean>   – return true if it handled the alarm
//   onStorage?(changes): void                     – chrome.storage.local changes
//   onMessage?(msg, sender): Promise<any> | undefined – return a promise to respond
import * as focus from './focus';
import * as blocker from './blocker';
import * as reminders from './reminders';
import * as balance from './balance';

type Mod = {
  init?: () => void | Promise<void>;
  onAlarm?: (a: chrome.alarms.Alarm) => boolean | Promise<boolean>;
  onStorage?: (changes: Record<string, chrome.storage.StorageChange>) => void;
  onMessage?: (msg: any, sender: chrome.runtime.MessageSender) => Promise<any> | undefined;
  onNotificationClick?: (id: string) => boolean;
  onNotificationButton?: (id: string, index: number) => boolean;
};
const modules: Mod[] = [focus, blocker, reminders, balance];

const initAll = async () => {
  for (const m of modules) {
    try { await m.init?.(); } catch (e) { console.error('[momento] init failed', e); }
  }
};

chrome.runtime.onInstalled.addListener(() => void initAll());
chrome.runtime.onStartup.addListener(() => void initAll());
void initAll();

chrome.alarms.onAlarm.addListener(async (alarm) => {
  for (const m of modules) {
    try { if (await m.onAlarm?.(alarm)) return; } catch (e) { console.error('[momento] alarm', alarm.name, e); }
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  for (const m of modules) {
    try { m.onStorage?.(changes); } catch (e) { console.error('[momento] storage handler', e); }
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  for (const m of modules) {
    const p = m.onMessage?.(msg, sender);
    if (p) {
      p.then(sendResponse, (e) => sendResponse({ error: String(e?.message ?? e) }));
      return true; // async response
    }
  }
  return false;
});

const openNewtab = (hash = '') => chrome.tabs.create({ url: chrome.runtime.getURL('newtab.html') + hash });

chrome.notifications.onClicked.addListener((id) => {
  for (const m of modules) if (m.onNotificationClick?.(id)) return;
  openNewtab();
  chrome.notifications.clear(id);
});
chrome.notifications.onButtonClicked.addListener((id, index) => {
  for (const m of modules) if (m.onNotificationButton?.(id, index)) return;
});
