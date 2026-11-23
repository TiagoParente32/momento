import { create, type StateCreator, type StoreApi, type UseBoundStore } from 'zustand';
import { getItem, onKeyChange, setItem } from './storage';

/**
 * Creates a zustand store whose *data* fields are persisted under a single
 * chrome.storage key and kept live across all extension pages.
 *
 *   export const useThing = createPersisted(KEYS.thing, { items: [] as Item[] }, (set, get) => ({
 *     add(item: Item) { set((s) => ({ items: [...s.items, item] })); },
 *   }));
 *
 * - `defaults` is the persisted shape (plain JSON only). Only those keys are saved.
 * - actions receive `set(patch | fn)` which updates state AND persists (debounced 120ms).
 * - `useThing.getState().hydrated` becomes true once storage has loaded; `await useThing.ready`.
 * - Changes from other tabs/popup/service worker are applied live.
 */
export type PersistedStore<D, A> = UseBoundStore<StoreApi<D & A & { hydrated: boolean }>> & {
  ready: Promise<void>;
  /** Replace data wholesale (import / cloud sync) and persist immediately. */
  replace: (data: Partial<D>) => void;
  /** Persist current state immediately (skips debounce). */
  flush: () => Promise<void>;
};

export function createPersisted<D extends object, A extends object>(
  key: string,
  defaults: D,
  actions: (set: (patch: Partial<D> | ((s: D) => Partial<D>)) => void, get: () => D) => A,
  migrate?: (stored: any) => Partial<D>,
): PersistedStore<D, A> {
  let lastWritten = '';
  let applyingRemote = false;
  const dataKeys = Object.keys(defaults) as (keyof D)[];
  const pick = (s: any): D => {
    const out = {} as D;
    for (const k of dataKeys) out[k] = s[k];
    return out;
  };

  let timer: ReturnType<typeof setTimeout> | null = null;
  let apiRef: StoreApi<any> | null = null;

  const write = async () => {
    if (!apiRef) return;
    const data = pick(apiRef.getState());
    lastWritten = JSON.stringify(data);
    await setItem(key, data);
  };

  const schedulePersist = () => {
    if (applyingRemote) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void write(); }, 120);
  };

  const creator: StateCreator<any> = (zset, zget, api) => {
    apiRef = api;
    const set = (patch: any) => {
      zset((s: any) => (typeof patch === 'function' ? patch(s) : patch));
      schedulePersist();
    };
    return { ...defaults, hydrated: false, ...actions(set, zget as any) };
  };

  const store = create(creator) as unknown as PersistedStore<D, A>;

  store.ready = (async () => {
    try {
      const stored = await getItem<any>(key);
      const data = stored ? (migrate ? migrate(stored) : stored) : {};
      store.setState({ ...data, hydrated: true });
    } catch (e) {
      console.error('[momento] hydrate failed', key, e);
      store.setState({ hydrated: true } as any);
    }
  })();

  onKeyChange(key, (value) => {
    if (value == null) return;
    if (JSON.stringify(value) === lastWritten) return; // our own write echoing back
    applyingRemote = true;
    store.setState({ ...(migrate ? migrate(value) : (value as object)) });
    applyingRemote = false;
  });

  store.replace = (data) => {
    store.setState({ ...defaults, ...data });
    void write();
  };
  store.flush = async () => {
    if (timer) { clearTimeout(timer); timer = null; }
    await write();
  };

  // make sure pending writes land before the page goes away
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => { if (timer) { clearTimeout(timer); timer = null; void write(); } });
  }

  return store;
}
