import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  StickyNote, Plus, Search, Pin, PinOff, Trash2, Folder, FolderPlus, Bold, Italic, Underline, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered, Quote, Code, Link2, Minus, RemoveFormatting, Download,
  Check, Loader2, Pencil, Inbox, MoreHorizontal,
} from 'lucide-react';
import { PanelFrame } from '@/components/PanelFrame';
import { Button, ColorPicker, EmptyState, Field, IconButton, Input, Modal, Select, confirmDialog, toast } from '@/components/ui';
import { useNotes } from '@/stores/notes';
import { sanitizeHtml, htmlToText, htmlToMarkdown } from '@/lib/sanitize';
import { cn, download, PALETTE } from '@/lib/utils';
import type { Note, NoteFolder } from '@/lib/types';

type View = { kind: 'all' } | { kind: 'pinned' } | { kind: 'unfiled' } | { kind: 'folder'; id: string };

export function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 45) return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function NotesPanel() {
  const { notes, folders, hydrated } = useNotes();
  const api = useNotes.getState();
  const [view, setView] = useState<View>({ kind: 'all' });
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [folderModal, setFolderModal] = useState<{ folder: NoteFolder | null } | null>(null);

  useEffect(() => { if (hydrated) api.ensureSeed(); }, [hydrated, api]);

  const textCache = useMemo(() => new Map(notes.map((n) => [n.id, htmlToText(n.html)])), [notes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes
      .filter((n) => {
        if (view.kind === 'pinned' && !n.pinned) return false;
        if (view.kind === 'unfiled' && n.folderId) return false;
        if (view.kind === 'folder' && n.folderId !== view.id) return false;
        if (!q) return true;
        return n.title.toLowerCase().includes(q) || (textCache.get(n.id) ?? '').toLowerCase().includes(q);
      })
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  }, [notes, view, query, textCache]);

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected && filtered.length) setSelectedId(filtered[0].id);
  }, [selected, filtered]);

  const createNote = () => {
    const n = api.addNote({ folderId: view.kind === 'folder' ? view.id : null, pinned: view.kind === 'pinned' });
    setQuery('');
    setSelectedId(n.id);
    setTimeout(() => document.getElementById('note-title')?.focus(), 50);
  };

  const removeNote = async (n: Note) => {
    const ok = await confirmDialog({ title: 'Delete note?', message: `“${n.title || 'Untitled'}” will be deleted.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    api.deleteNote(n.id);
    setSelectedId(null);
    toast('Note deleted', 'info', { label: 'Undo', run: () => api.restoreNote(n) });
  };

  const removeFolder = async (f: NoteFolder) => {
    const ok = await confirmDialog({ title: `Delete folder “${f.name}”?`, message: 'Notes in this folder will be kept and moved to “Unfiled”.', confirmLabel: 'Delete folder', danger: true });
    if (!ok) return;
    api.deleteFolder(f.id);
    if (view.kind === 'folder' && view.id === f.id) setView({ kind: 'all' });
  };

  const count = (pred: (n: Note) => boolean) => notes.filter(pred).length;
  const navItem = (active: boolean, onClick: () => void, icon: ReactNode, label: string, n: number, extra?: ReactNode) => (
    <div className={cn('group flex items-center rounded-xl text-sm transition', active ? 'bg-accent/12 text-ink' : 'text-muted hover:bg-ink/5 hover:text-ink')}>
      <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5 text-left">
        {icon}
        <span className="flex-1 truncate">{label}</span>
        <span className="text-xs opacity-60">{n}</span>
      </button>
      {extra}
    </div>
  );

  const sidebar = (
    <div className="space-y-4">
      <Button variant="primary" className="w-full justify-center" onClick={createNote}>
        <Plus className="h-4 w-4" /> New note
      </Button>
      <div className="space-y-0.5">
        {navItem(view.kind === 'all', () => setView({ kind: 'all' }), <StickyNote className="h-4 w-4" />, 'All notes', notes.length)}
        {navItem(view.kind === 'pinned', () => setView({ kind: 'pinned' }), <Pin className="h-4 w-4" />, 'Pinned', count((n) => n.pinned))}
        {navItem(view.kind === 'unfiled', () => setView({ kind: 'unfiled' }), <Inbox className="h-4 w-4" />, 'Unfiled', count((n) => !n.folderId))}
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="section-title">Folders</span>
          <IconButton label="New folder" className="h-7 w-7" onClick={() => setFolderModal({ folder: null })}>
            <FolderPlus className="h-3.5 w-3.5" />
          </IconButton>
        </div>
        <div className="space-y-0.5">
          {folders.map((f) =>
            navItem(
              view.kind === 'folder' && view.id === f.id,
              () => setView({ kind: 'folder', id: f.id }),
              <Folder className="h-4 w-4" style={{ color: f.color }} />,
              f.name,
              count((n) => n.folderId === f.id),
              <span className="hidden pr-1 group-hover:flex">
                <button className="rounded p-1 hover:bg-ink/10" aria-label={`Edit folder ${f.name}`} onClick={() => setFolderModal({ folder: f })}><Pencil className="h-3 w-3" /></button>
                <button className="rounded p-1 hover:bg-ink/10" aria-label={`Delete folder ${f.name}`} onClick={() => removeFolder(f)}><Trash2 className="h-3 w-3" /></button>
              </span>,
            ),
          )}
          {!folders.length && <p className="px-2 text-xs text-muted">No folders yet.</p>}
        </div>
      </div>
    </div>
  );

  return (
    <PanelFrame title="Notes" icon={<StickyNote className="h-4 w-4" />} sidebar={sidebar}>
      <div className="flex h-full min-h-0">
        {/* list */}
        <div className="flex w-72 shrink-0 flex-col border-r border-line/10">
          <div className="p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes" className="pl-9" aria-label="Search notes" />
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 scroll-thin">
            {filtered.map((n) => {
              const text = textCache.get(n.id) ?? '';
              const folder = folders.find((f) => f.id === n.folderId);
              return (
                <li key={n.id}>
                  <button
                    onClick={() => setSelectedId(n.id)}
                    className={cn('mb-1 w-full rounded-xl px-3 py-2.5 text-left transition', n.id === selectedId ? 'bg-accent/12' : 'hover:bg-ink/5')}
                  >
                    <div className="flex items-center gap-1.5">
                      {n.pinned && <Pin className="h-3 w-3 shrink-0 text-accent" />}
                      <span className="flex-1 truncate text-sm font-medium">{n.title || 'Untitled'}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">{text || 'No content'}</p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted/80">
                      <span>{relativeTime(n.updatedAt)}</span>
                      {folder && <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: folder.color }} />{folder.name}</span>}
                    </div>
                  </button>
                </li>
              );
            })}
            {!filtered.length && (
              <EmptyState
                icon={<StickyNote className="h-5 w-5" />}
                title={query ? 'No matching notes' : 'No notes here'}
                description={query ? 'Try another search.' : 'Create a note to get started.'}
                action={!query && <Button size="sm" variant="primary" onClick={createNote}><Plus className="h-3.5 w-3.5" /> New note</Button>}
              />
            )}
          </ul>
        </div>

        {/* editor */}
        <div className="min-w-0 flex-1">
          {selected ? (
            <NoteEditor key={selected.id} note={selected} folders={folders} onDelete={() => removeNote(selected)} />
          ) : (
            <EmptyState icon={<StickyNote className="h-5 w-5" />} title="Select or create a note" action={<Button variant="primary" size="sm" onClick={createNote}><Plus className="h-3.5 w-3.5" /> New note</Button>} />
          )}
        </div>
      </div>

      <FolderModal state={folderModal} onClose={() => setFolderModal(null)} />
    </PanelFrame>
  );
}

function FolderModal({ state, onClose }: { state: { folder: NoteFolder | null } | null; onClose: () => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[0]);
  useEffect(() => {
    if (state) { setName(state.folder?.name ?? ''); setColor(state.folder?.color ?? PALETTE[Math.floor(Math.random() * PALETTE.length)]); }
  }, [state]);
  const save = () => {
    if (!name.trim()) return;
    const api = useNotes.getState();
    if (state?.folder) api.renameFolder(state.folder.id, name, color);
    else api.addFolder(name, color);
    onClose();
  };
  return (
    <Modal
      open={!!state}
      onClose={onClose}
      title={state?.folder ? 'Edit folder' : 'New folder'}
      size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={!name.trim()}>Save</Button></>}
    >
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Meeting notes" maxLength={40} /></Field>
        <Field label="Colour"><ColorPicker value={color} onChange={setColor} /></Field>
      </form>
    </Modal>
  );
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function NoteEditor({ note, folders, onDelete }: { note: Note; folders: NoteFolder[]; onDelete: () => void }) {
  const api = useNotes.getState();
  const editorRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(note.title);
  const [status, setStatus] = useState<'saved' | 'saving'>('saved');
  const [menu, setMenu] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ title?: string; html?: string }>({});

  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = sanitizeHtml(note.html);
    // only on mount (component is keyed by note id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flush = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const p = pending.current;
    if (p.title === undefined && p.html === undefined) return;
    const patch: Partial<Note> = {};
    if (p.title !== undefined) patch.title = p.title;
    if (p.html !== undefined) patch.html = sanitizeHtml(p.html);
    pending.current = {};
    api.updateNote(note.id, patch);
    setStatus('saved');
  };
  const schedule = (patch: { title?: string; html?: string }) => {
    pending.current = { ...pending.current, ...patch };
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  };
  // save on unmount / note switch
  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const onInput = () => schedule({ html: editorRef.current?.innerHTML ?? '' });

  const exec = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    onInput();
  };
  const formatBlock = (tag: string) => {
    const current = (document.queryCommandValue('formatBlock') || '').toLowerCase();
    exec('formatBlock', current === tag ? 'p' : tag);
  };
  const inlineCode = () => {
    const sel = window.getSelection();
    const text = sel?.toString() ?? '';
    if (!text) return exec('formatBlock', 'pre');
    exec('insertHTML', `<code>${escapeHtml(text)}</code>&nbsp;`);
  };
  const link = () => {
    const sel = window.getSelection();
    const range = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    const url = window.prompt('Link URL', 'https://');
    if (!url || url === 'https://') return;
    const href = /^(https?:|mailto:)/i.test(url) ? url : `https://${url}`;
    editorRef.current?.focus();
    if (range) { sel!.removeAllRanges(); sel!.addRange(range); }
    if (range && !range.collapsed) exec('createLink', href);
    else exec('insertHTML', `<a href="${escapeHtml(href)}">${escapeHtml(href)}</a>&nbsp;`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === 'k') { e.preventDefault(); link(); }
    else if (e.altKey && ['1', '2', '3'].includes(k)) { e.preventDefault(); formatBlock(`h${k}`); }
    else if (e.shiftKey && k === 'x') { e.preventDefault(); exec('strikeThrough'); }
    else if (e.shiftKey && k === '8') { e.preventDefault(); exec('insertUnorderedList'); }
    else if (e.shiftKey && k === '7') { e.preventDefault(); exec('insertOrderedList'); }
    else if (k === 's') { e.preventDefault(); flush(); }
    // Ctrl+B/I/U handled natively by contentEditable; capture input via onInput
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const html = e.clipboardData.getData('text/html');
    if (html) {
      e.preventDefault();
      document.execCommand('insertHTML', false, sanitizeHtml(html));
      onInput();
    }
  };

  const exportAs = (fmt: 'md' | 'txt') => {
    flush();
    const latest = useNotes.getState().notes.find((n) => n.id === note.id) ?? note;
    const name = (latest.title || 'note').replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'note';
    const body = fmt === 'md' ? `# ${latest.title || 'Untitled'}\n\n${htmlToMarkdown(latest.html)}` : `${latest.title || 'Untitled'}\n\n${htmlToText(latest.html)}\n`;
    download(`${name}.${fmt}`, body, fmt === 'md' ? 'text/markdown' : 'text/plain');
    setMenu(false);
  };

  const tools: { label: string; icon: ReactNode; run: () => void; sep?: boolean }[] = [
    { label: 'Bold (Ctrl+B)', icon: <Bold className="h-4 w-4" />, run: () => exec('bold') },
    { label: 'Italic (Ctrl+I)', icon: <Italic className="h-4 w-4" />, run: () => exec('italic') },
    { label: 'Underline (Ctrl+U)', icon: <Underline className="h-4 w-4" />, run: () => exec('underline') },
    { label: 'Strikethrough (Ctrl+Shift+X)', icon: <Strikethrough className="h-4 w-4" />, run: () => exec('strikeThrough'), sep: true },
    { label: 'Heading 1 (Ctrl+Alt+1)', icon: <Heading1 className="h-4 w-4" />, run: () => formatBlock('h1') },
    { label: 'Heading 2 (Ctrl+Alt+2)', icon: <Heading2 className="h-4 w-4" />, run: () => formatBlock('h2') },
    { label: 'Heading 3 (Ctrl+Alt+3)', icon: <Heading3 className="h-4 w-4" />, run: () => formatBlock('h3'), sep: true },
    { label: 'Bulleted list (Ctrl+Shift+8)', icon: <List className="h-4 w-4" />, run: () => exec('insertUnorderedList') },
    { label: 'Numbered list (Ctrl+Shift+7)', icon: <ListOrdered className="h-4 w-4" />, run: () => exec('insertOrderedList') },
    { label: 'Quote', icon: <Quote className="h-4 w-4" />, run: () => formatBlock('blockquote') },
    { label: 'Code', icon: <Code className="h-4 w-4" />, run: inlineCode, sep: true },
    { label: 'Link (Ctrl+K)', icon: <Link2 className="h-4 w-4" />, run: link },
    { label: 'Divider', icon: <Minus className="h-4 w-4" />, run: () => exec('insertHorizontalRule') },
    { label: 'Clear formatting', icon: <RemoveFormatting className="h-4 w-4" />, run: () => { exec('removeFormat'); exec('formatBlock', 'p'); } },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-line/10 px-3 py-1.5" role="toolbar" aria-label="Formatting">
        {tools.map((t) => (
          <span key={t.label} className="flex items-center">
            <button
              type="button"
              title={t.label}
              aria-label={t.label}
              onMouseDown={(e) => { e.preventDefault(); t.run(); }}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-ink/5 hover:text-ink"
            >
              {t.icon}
            </button>
            {t.sep && <span className="mx-1 h-5 w-px bg-line/10" />}
          </span>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 flex items-center gap-1 text-xs text-muted" aria-live="polite">
            {status === 'saving' ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</> : <><Check className="h-3 w-3" /> Saved</>}
          </span>
          <IconButton label={note.pinned ? 'Unpin note' : 'Pin note'} onClick={() => api.togglePin(note.id)}>
            {note.pinned ? <PinOff className="h-4 w-4 text-accent" /> : <Pin className="h-4 w-4" />}
          </IconButton>
          <div className="relative">
            <IconButton label="More actions" onClick={() => setMenu((m) => !m)}><MoreHorizontal className="h-4 w-4" /></IconButton>
            {menu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                <div className="panel absolute right-0 top-10 z-20 w-48 rounded-xl p-1 shadow-xl animate-scale-in">
                  <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-ink/5" onClick={() => exportAs('md')}><Download className="h-4 w-4" /> Export as Markdown</button>
                  <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-ink/5" onClick={() => exportAs('txt')}><Download className="h-4 w-4" /> Export as text</button>
                  <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-500/10" onClick={() => { setMenu(false); onDelete(); }}><Trash2 className="h-4 w-4" /> Delete note</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6 scroll-thin">
        <input
          id="note-title"
          value={title}
          onChange={(e) => { setTitle(e.target.value); schedule({ title: e.target.value }); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); editorRef.current?.focus(); } }}
          placeholder="Untitled"
          aria-label="Note title"
          className="w-full bg-transparent font-display text-2xl font-semibold tracking-tight outline-none placeholder:text-muted/60"
          maxLength={200}
        />
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
          <span title={new Date(note.createdAt).toLocaleString()}>Created {new Date(note.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          <span title={new Date(note.updatedAt).toLocaleString()}>Edited {relativeTime(note.updatedAt)}</span>
          <label className="flex items-center gap-1">
            <Folder className="h-3.5 w-3.5" />
            <Select
              aria-label="Move to folder"
              value={note.folderId ?? ''}
              onChange={(e) => api.updateNote(note.id, { folderId: e.target.value || null })}
              className="h-7 w-auto border-none bg-transparent py-0 pl-1 text-xs"
            >
              <option value="">Unfiled</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Select>
          </label>
        </div>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Note content"
          data-placeholder="Start writing…"
          onInput={onInput}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={flush}
          className="prose-note mt-4 min-h-[50vh] outline-none"
        />
      </div>
    </div>
  );
}
