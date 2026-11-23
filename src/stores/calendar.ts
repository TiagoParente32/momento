import { createPersisted } from '@/lib/persist';
import { KEYS } from '@/lib/storage';
import { uid } from '@/lib/utils';
import type { CalendarEvent, ID } from '@/lib/types';

/**
 * Persisted shape under KEYS.calendar:
 *   { events: CalendarEvent[] (local, editable), external: CalendarEvent[] (read-only, synced), lastExternalSync }
 * The service-worker reminders module reads `events` (and may read `external`).
 */
export const useCalendar = createPersisted(
  KEYS.calendar,
  { events: [] as CalendarEvent[], external: [] as CalendarEvent[], lastExternalSync: null as string | null },
  (set) => ({
    addEvent(input: Omit<CalendarEvent, 'id' | 'source'> & Partial<Pick<CalendarEvent, 'source'>>): CalendarEvent {
      const ev: CalendarEvent = { ...input, id: uid(), source: 'local' };
      set((s) => ({ events: [...s.events, ev] }));
      return ev;
    },
    updateEvent(id: ID, patch: Partial<CalendarEvent>) {
      set((s) => ({ events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
    },
    deleteEvent(id: ID) {
      set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
    },
    restoreEvent(ev: CalendarEvent) {
      set((s) => ({ events: [...s.events.filter((e) => e.id !== ev.id), ev] }));
    },
    setExternal(events: CalendarEvent[]) {
      set({ external: events, lastExternalSync: new Date().toISOString() });
    },
  }),
);
