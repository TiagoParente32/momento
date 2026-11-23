// Wrappers over chrome.tabs / chrome.tabGroups / chrome.windows.
import { isExtension } from './storage';
import { hexToRgb, PALETTE } from './utils';
import type { SavedTab, TabCollection } from './types';
import { useTabs } from '@/stores/tabs';

type GroupColor = `${chrome.tabGroups.Color}`;

export class TabsUnavailableError extends Error {
  constructor() { super('Tab management needs Momento to run as an installed Chrome extension.'); }
}
const ensure = () => {
  if (!isExtension || !chrome.tabs) throw new TabsUnavailableError();
};

const ownUrl = () => (isExtension ? chrome.runtime.getURL('') : '');
/** chrome://, edge://, file:// and similar pages cannot be opened by extensions reliably. */
export const isRestorable = (url: string) => /^(https?|ftp):\/\//i.test(url);
const isOwnPage = (url: string) => !!ownUrl() && url.startsWith(ownUrl());

const toSaved = (t: chrome.tabs.Tab): SavedTab => ({
  url: t.url || t.pendingUrl || '',
  title: t.title || t.url || 'Untitled',
  favIconUrl: t.favIconUrl && !t.favIconUrl.startsWith('chrome://') ? t.favIconUrl : undefined,
  pinned: t.pinned,
});

export interface LiveTab extends SavedTab { tabId: number; groupId: number; }

/** Tabs in the current window, excluding Momento's own pages and blank new tabs. */
export async function getCurrentWindowTabs(): Promise<LiveTab[]> {
  ensure();
  const tabs = await chrome.tabs.query({ currentWindow: true });
  return tabs
    .filter((t) => {
      const u = t.url || t.pendingUrl || '';
      return u && !isOwnPage(u) && u !== 'chrome://newtab/';
    })
    .map((t) => ({ ...toSaved(t), tabId: t.id!, groupId: t.groupId ?? -1 }));
}

/** Snapshot current window's tabs (optionally closing them, keeping a Momento tab open). */
export async function snapshotTabs(close: boolean): Promise<SavedTab[]> {
  const live = await getCurrentWindowTabs();
  const saved = live.map(({ tabId, groupId, ...t }) => t);
  if (close && live.length) {
    const ids = live.map((t) => t.tabId);
    const all = await chrome.tabs.query({ currentWindow: true });
    if (all.length <= ids.length) await chrome.tabs.create({ url: chrome.runtime.getURL('newtab.html'), active: true });
    await chrome.tabs.remove(ids);
  }
  return saved;
}

/**
 * Stash the current window into a new Tab Stash collection (persisted in useTabs).
 * Returns the created collection; throws when there is nothing to stash.
 */
export async function stashTabs(close: boolean): Promise<TabCollection> {
  const tabs = await snapshotTabs(close);
  if (!tabs.length) throw new Error('No tabs to stash in this window.');
  await useTabs.ready;
  const n = useTabs.getState().collections.filter((c) => c.kind === 'stash').length;
  const name = `Stash · ${new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
  const c = useTabs.getState().addCollection({ name, kind: 'stash', tabs, color: PALETTE[n % PALETTE.length] });
  await useTabs.flush();
  return c;
}

const GROUP_COLORS: Record<GroupColor, string> = {
  grey: '#5f6368', blue: '#1a73e8', red: '#d93025', yellow: '#f9ab00', green: '#188038',
  pink: '#d01884', purple: '#a142f4', cyan: '#007b83', orange: '#fa903e',
} as Record<GroupColor, string>;

export function nearestGroupColor(hex: string): GroupColor {
  const [r, g, b] = hexToRgb(hex);
  let best: GroupColor = 'blue' as GroupColor;
  let bestD = Infinity;
  for (const [name, h] of Object.entries(GROUP_COLORS)) {
    const [R, G, B] = hexToRgb(h);
    const d = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2;
    if (d < bestD) { bestD = d; best = name as GroupColor; }
  }
  return best;
}
export const groupColorHex = (c: string) => GROUP_COLORS[c as GroupColor] ?? '#64748b';

/** Open a single URL in a new tab (falls back to window.open outside the extension). */
export async function openUrl(url: string, active = false) {
  if (!isExtension) { window.open(url, '_blank', 'noopener'); return; }
  await chrome.tabs.create({ url, active });
}

/** Open every restorable tab in a collection. Returns how many were opened / skipped. */
export async function restoreCollection(c: TabCollection, opts: { newWindow?: boolean; asTabGroup?: boolean } = {}) {
  ensure();
  const urls = c.tabs.filter((t) => isRestorable(t.url));
  const skipped = c.tabs.length - urls.length;
  if (!urls.length) return { opened: 0, skipped };
  let windowId: number | undefined;
  const ids: number[] = [];
  if (opts.newWindow) {
    const w = await chrome.windows.create({ url: urls[0].url, focused: true });
    windowId = w?.id;
    const first = w?.tabs?.[0]?.id;
    if (first != null) ids.push(first);
    for (const t of urls.slice(1)) {
      const tab = await chrome.tabs.create({ url: t.url, windowId, active: false, pinned: t.pinned });
      if (tab.id != null) ids.push(tab.id);
    }
  } else {
    for (const t of urls) {
      const tab = await chrome.tabs.create({ url: t.url, active: false, pinned: t.pinned });
      if (tab.id != null) ids.push(tab.id);
    }
  }
  if (opts.asTabGroup && chrome.tabGroups && ids.length) {
    const unpinned = [];
    for (const id of ids) {
      const t = await chrome.tabs.get(id);
      if (!t.pinned) unpinned.push(id);
    }
    if (unpinned.length) {
      const groupId = await chrome.tabs.group({ tabIds: unpinned as [number, ...number[]], ...(windowId != null ? { createProperties: { windowId } } : {}) });
      await chrome.tabGroups.update(groupId, { title: c.name, color: nearestGroupColor(c.color) });
    }
  }
  return { opened: ids.length, skipped };
}

export interface LiveGroup { id: number; title: string; color: string; tabs: SavedTab[]; }

/** Native Chrome tab groups across all windows. */
export async function getLiveTabGroups(): Promise<LiveGroup[]> {
  ensure();
  if (!chrome.tabGroups) return [];
  const groups = await chrome.tabGroups.query({});
  const out: LiveGroup[] = [];
  for (const g of groups) {
    const tabs = await chrome.tabs.query({ groupId: g.id });
    out.push({ id: g.id, title: g.title || 'Untitled group', color: groupColorHex(g.color), tabs: tabs.map(toSaved) });
  }
  return out;
}

export async function saveLiveGroup(groupId: number): Promise<LiveGroup> {
  const groups = await getLiveTabGroups();
  const g = groups.find((x) => x.id === groupId);
  if (!g) throw new Error('That tab group no longer exists.');
  return g;
}
