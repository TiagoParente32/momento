import { createPersisted } from '@/lib/persist';
import { KEYS } from '@/lib/storage';
import { uid } from '@/lib/utils';
import type { ID, Note, NoteFolder } from '@/lib/types';

const now = () => new Date().toISOString();

const welcome = (): Note => ({
  id: uid(),
  folderId: null,
  title: 'Welcome to Momento Notes',
  html:
    '<p>Capture ideas, meeting notes and plans. Notes <b>autosave</b> as you type.</p>' +
    '<ul><li>Use the toolbar or <code>Ctrl+B</code> / <code>Ctrl+I</code> / <code>Ctrl+U</code></li><li>Pin important notes to keep them on top</li><li>Organise notes into folders</li></ul>',
  pinned: true,
  createdAt: now(),
  updatedAt: now(),
});

export const useNotes = createPersisted(
  KEYS.notes,
  { notes: [] as Note[], folders: [] as NoteFolder[], seeded: false },
  (set, get) => ({
    addNote(partial: Partial<Note> = {}): Note {
      const t = now();
      const note: Note = { id: uid(), folderId: null, title: '', html: '', pinned: false, createdAt: t, updatedAt: t, ...partial };
      set((s) => ({ notes: [note, ...s.notes] }));
      return note;
    },
    updateNote(id: ID, patch: Partial<Note>) {
      set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: now() } : n)) }));
    },
    deleteNote(id: ID) {
      set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
    },
    restoreNote(note: Note) {
      set((s) => ({ notes: [note, ...s.notes.filter((n) => n.id !== note.id)] }));
    },
    togglePin(id: ID) {
      set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)) }));
    },
    addFolder(name: string, color: string): NoteFolder {
      const f: NoteFolder = { id: uid(), name: name.trim() || 'Untitled', color };
      set((s) => ({ folders: [...s.folders, f] }));
      return f;
    },
    renameFolder(id: ID, name: string, color?: string) {
      set((s) => ({ folders: s.folders.map((f) => (f.id === id ? { ...f, name: name.trim() || f.name, color: color ?? f.color } : f)) }));
    },
    deleteFolder(id: ID) {
      set((s) => ({
        folders: s.folders.filter((f) => f.id !== id),
        notes: s.notes.map((n) => (n.folderId === id ? { ...n, folderId: null } : n)),
      }));
    },
    /** Seed the welcome note once. */
    ensureSeed() {
      if (get().seeded) return;
      set((s) => ({ seeded: true, notes: s.notes.length ? s.notes : [welcome()] }));
    },
  }),
);
