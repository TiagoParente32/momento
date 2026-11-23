import { createPersisted } from '@/lib/persist';
import { KEYS } from '@/lib/storage';
import type { IntegrationConnection, IntegrationId } from '@/lib/types';

/**
 * Integration connections and user-supplied OAuth client IDs.
 * Stored under KEYS.integrations: local to this device, excluded from cloud sync and export.
 */
export const useIntegrations = createPersisted(
  KEYS.integrations,
  {
    connections: {} as Partial<Record<IntegrationId, IntegrationConnection>>,
    clientIds: { google: '', microsoft: '' } as { google: string; microsoft: string },
  },
  (set, get) => ({
    get(id: IntegrationId): IntegrationConnection | undefined { return get().connections[id]; },
    setConnection(id: IntegrationId, patch: Partial<IntegrationConnection>) {
      set((s) => ({ connections: { ...s.connections, [id]: { id, connected: false, ...s.connections[id], ...patch } } }));
    },
    removeConnection(id: IntegrationId) {
      set((s) => {
        const next = { ...s.connections };
        delete next[id];
        return { connections: next };
      });
    },
    setClientId(provider: 'google' | 'microsoft', value: string) {
      set((s) => ({ clientIds: { ...s.clientIds, [provider]: value.trim() } }));
    },
    clearAll() { set({ connections: {} }); },
  }),
);
