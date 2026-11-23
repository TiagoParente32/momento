import { createPersisted } from '@/lib/persist';
import { KEYS } from '@/lib/storage';
import { PALETTE, uid } from '@/lib/utils';
import type { ID, SavedTab, TabCollection } from '@/lib/types';

const now = () => new Date().toISOString();

export const useTabs = createPersisted(
  KEYS.tabs,
  { collections: [] as TabCollection[] },
  (set) => ({
    addCollection(input: Partial<TabCollection> & { name: string; kind: TabCollection['kind'] }): TabCollection {
      const t = now();
      const c: TabCollection = { id: uid(), color: PALETTE[0], tabs: [], createdAt: t, updatedAt: t, ...input };
      set((s) => ({ collections: [c, ...s.collections] }));
      return c;
    },
    updateCollection(id: ID, patch: Partial<TabCollection>) {
      set((s) => ({ collections: s.collections.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: now() } : c)) }));
    },
    renameCollection(id: ID, name: string) {
      set((s) => ({ collections: s.collections.map((c) => (c.id === id ? { ...c, name: name.trim() || c.name, updatedAt: now() } : c)) }));
    },
    recolourCollection(id: ID, color: string) {
      set((s) => ({ collections: s.collections.map((c) => (c.id === id ? { ...c, color, updatedAt: now() } : c)) }));
    },
    deleteCollection(id: ID) {
      set((s) => ({ collections: s.collections.filter((c) => c.id !== id) }));
    },
    restoreDeleted(c: TabCollection) {
      set((s) => ({ collections: [c, ...s.collections.filter((x) => x.id !== c.id)] }));
    },
    addTabs(id: ID, tabs: SavedTab[]) {
      set((s) => ({
        collections: s.collections.map((c) => {
          if (c.id !== id) return c;
          const existing = new Set(c.tabs.map((t) => t.url));
          return { ...c, tabs: [...c.tabs, ...tabs.filter((t) => !existing.has(t.url))], updatedAt: now() };
        }),
      }));
    },
    removeTab(id: ID, index: number) {
      set((s) => ({
        collections: s.collections.map((c) => (c.id === id ? { ...c, tabs: c.tabs.filter((_, i) => i !== index), updatedAt: now() } : c)),
      }));
    },
  }),
);
