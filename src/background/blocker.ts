// Website blocker via declarativeNetRequest dynamic rules.
import { KEYS, getItem } from '@/lib/storage';
import { DEFAULT_BLOCKER, blockingActive } from '@/lib/blocker-core';
import { DEFAULT_FOCUS_SETTINGS, type FocusData } from '@/lib/focus-core';
import type { BlockerState } from '@/lib/types';

const TICK = 'blocker-tick';
let lastSignature = '';
let wasActive = false;

async function evaluate() {
  const b = (await getItem<{ blocker: BlockerState }>(KEYS.blocker))?.blocker ?? DEFAULT_BLOCKER;
  const blocker = { ...DEFAULT_BLOCKER, ...b };
  const focus = await getItem<Partial<FocusData>>(KEYS.focus);
  const status = blockingActive(blocker, focus?.timer, { ...DEFAULT_FOCUS_SETTINGS, ...focus?.settings });

  const signature = JSON.stringify([status.active, status.reason, blocker.sites, blocker.allowlist]);
  if (signature === lastSignature) return;
  lastSignature = signature;

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const rules: chrome.declarativeNetRequest.Rule[] = [];
  if (status.active) {
    let id = 1;
    for (const site of blocker.sites) {
      rules.push({
        id: id++,
        priority: 1,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
          redirect: { extensionPath: `/blocked.html?site=${encodeURIComponent(site)}&reason=${encodeURIComponent(status.reason)}` },
        },
        condition: { requestDomains: [site], resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME] },
      });
    }
    if (blocker.allowlist.length) {
      rules.push({
        id: id++,
        priority: 2,
        action: { type: chrome.declarativeNetRequest.RuleActionType.ALLOW },
        condition: { requestDomains: blocker.allowlist, resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME] },
      });
    }
  }
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existing.map((r) => r.id), addRules: rules });
  } catch (e) {
    console.error('[momento] blocker rules failed', e);
    lastSignature = '';
    return;
  }

  // When blocking switches on, redirect tabs already open on blocked sites.
  if (status.active && !wasActive) {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (!tab.id || !tab.url) continue;
      let host = '';
      try { host = new URL(tab.url).hostname.replace(/^www\./, ''); } catch { continue; }
      const match = (d: string) => host === d || host.endsWith('.' + d);
      const site = blocker.sites.find(match);
      if (site && !blocker.allowlist.some(match)) {
        void chrome.tabs.update(tab.id, {
          url: chrome.runtime.getURL(`blocked.html?site=${encodeURIComponent(site)}&reason=${encodeURIComponent(status.reason)}`),
        });
      }
    }
  }
  wasActive = status.active;
}

export async function init() {
  await chrome.alarms.create(TICK, { periodInMinutes: 1 });
  lastSignature = '';
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  wasActive = rules.length > 0;
  await evaluate();
}

export async function onAlarm(a: chrome.alarms.Alarm) {
  if (a.name !== TICK) return false;
  await evaluate();
  return true;
}

export function onStorage(changes: Record<string, chrome.storage.StorageChange>) {
  if (KEYS.blocker in changes || KEYS.focus in changes) void evaluate();
}

export function onMessage(msg: any) {
  if (msg?.type === 'blocker:evaluate') {
    lastSignature = '';
    return evaluate().then(() => ({ ok: true }));
  }
  return undefined;
}
