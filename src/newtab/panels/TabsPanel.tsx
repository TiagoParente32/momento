import { useEffect, useState } from 'react';
import {
  Layers, Archive, FolderOpen, Plus, Trash2, Pencil, ExternalLink, AppWindow, X, RefreshCw, Link2, Download, Group,
} from 'lucide-react';
import { PanelFrame } from '@/components/PanelFrame';
import { Badge, Button, ColorPicker, EmptyState, Field, IconButton, Input, Modal, Spinner, Tabs, Toggle, confirmDialog, toast } from '@/components/ui';
import { useTabs } from '@/stores/tabs';
import {
  getCurrentWindowTabs, getLiveTabGroups, isRestorable, openUrl, restoreCollection, saveLiveGroup, stashTabs,
  type LiveGroup, type LiveTab,
} from '@/lib/tabsApi';
import { isExtension } from '@/lib/storage';
import { cn, faviconFor, normalizeUrl, PALETTE } from '@/lib/utils';
import type { SavedTab, TabCollection } from '@/lib/types';

type Section = 'stash' | 'groups';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function TabsPanel() {
  const [section, setSection] = useState<Section>('stash');
  const collections = useTabs((s) => s.collections);
  const stashes = collections.filter((c) => c.kind === 'stash');
  const groups = collections.filter((c) => c.kind === 'group');

  return (
    <PanelFrame title="Tabs" icon={<Layers className="h-4 w-4" />}>
      <div className="px-5 pt-3">
        <Tabs
          value={section}
          onChange={setSection}
          tabs={[
            { value: 'stash', label: `Tab Stash (${stashes.length})`, icon: <Archive className="h-4 w-4" /> },
            { value: 'groups', label: `Tab Groups (${groups.length})`, icon: <FolderOpen className="h-4 w-4" /> },
          ]}
        />
      </div>
      {!isExtension && (
        <p className="mx-5 mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-300">
          Reading and restoring browser tabs requires Momento to be installed as a Chrome extension. Saved collections still work.
        </p>
      )}
      <div className="p-5">{section === 'stash' ? <StashSection stashes={stashes} /> : <GroupsSection groups={groups} />}</div>
    </PanelFrame>
  );
}

// ---------------------------------------------------------------- Stash
function StashSection({ stashes }: { stashes: TabCollection[] }) {
  const [closeAfter, setCloseAfter] = useState(true);
  const [busy, setBusy] = useState(false);

  const stash = async () => {
    setBusy(true);
    try {
      const c = await stashTabs(closeAfter);
      toast(`Stashed ${c.tabs.length} tab${c.tabs.length === 1 ? '' : 's'}${closeAfter ? ' and closed them' : ''}`, 'success');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Stash this window</p>
          <p className="text-xs text-muted">Save every open tab in the current window to restore later.</p>
        </div>
        <Toggle checked={closeAfter} onChange={setCloseAfter} label={<span className="text-xs">Close tabs after stashing</span>} />
        <Button variant="primary" onClick={stash} loading={busy}><Archive className="h-4 w-4" /> Stash tabs</Button>
      </div>
      {stashes.length ? (
        stashes.map((c) => <CollectionCard key={c.id} c={c} />)
      ) : (
        <EmptyState icon={<Archive className="h-5 w-5" />} title="No stashes yet" description="Stash your tabs to clear your window without losing anything." />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Groups
function GroupsSection({ groups }: { groups: TabCollection[] }) {
  const api = useTabs.getState();
  const [creating, setCreating] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New group</Button>
        <Button onClick={() => setLiveOpen(true)}><Download className="h-4 w-4" /> Import a Chrome tab group</Button>
      </div>
      {groups.length ? (
        groups.map((c) => <CollectionCard key={c.id} c={c} isGroup />)
      ) : (
        <EmptyState icon={<FolderOpen className="h-5 w-5" />} title="No groups yet" description="Create groups for projects or topics and open them all at once." />
      )}
      <EditCollectionModal
        open={creating}
        onClose={() => setCreating(false)}
        initial={{ name: '', color: PALETTE[groups.length % PALETTE.length] }}
        title="New tab group"
        onSave={(name, color) => { api.addCollection({ name, color, kind: 'group' }); toast('Group created', 'success'); }}
      />
      <LiveGroupsModal open={liveOpen} onClose={() => setLiveOpen(false)} />
    </div>
  );
}

// ---------------------------------------------------------------- Collection card
function CollectionCard({ c, isGroup }: { c: TabCollection; isGroup?: boolean }) {
  const api = useTabs.getState();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [asGroup, setAsGroup] = useState(true);
  const [expanded, setExpanded] = useState(true);

  const restore = async (newWindow: boolean) => {
    try {
      const { opened, skipped } = await restoreCollection(c, { newWindow, asTabGroup: isGroup && asGroup });
      toast(`Opened ${opened} tab${opened === 1 ? '' : 's'}${skipped ? ` · ${skipped} browser page${skipped === 1 ? '' : 's'} skipped` : ''}`, 'success');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };
  const remove = async () => {
    const ok = await confirmDialog({ title: `Delete “${c.name}”?`, message: `${c.tabs.length} saved tab${c.tabs.length === 1 ? '' : 's'} will be removed.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    api.deleteCollection(c.id);
    toast('Deleted', 'info', { label: 'Undo', run: () => api.restoreDeleted(c) });
  };

  return (
    <article className="card overflow-hidden">
      <header className="flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c.color }} />
        <button className="min-w-0 flex-1 text-left" onClick={() => setExpanded((x) => !x)} aria-expanded={expanded}>
          <h3 className="truncate text-sm font-semibold">{c.name}</h3>
          <p className="text-xs text-muted">{c.tabs.length} tab{c.tabs.length === 1 ? '' : 's'} · {new Date(c.updatedAt).toLocaleDateString()}</p>
        </button>
        {isGroup && (
          <label className="flex items-center gap-1.5 text-xs text-muted" title="Open as a native Chrome tab group">
            <input type="checkbox" checked={asGroup} onChange={(e) => setAsGroup(e.target.checked)} /> <Group className="h-3.5 w-3.5" /> As tab group
          </label>
        )}
        <Button size="sm" variant="primary" onClick={() => restore(false)} disabled={!c.tabs.length}><ExternalLink className="h-3.5 w-3.5" /> {isGroup ? 'Open all' : 'Restore'}</Button>
        <IconButton label="Open in new window" onClick={() => restore(true)} disabled={!c.tabs.length}><AppWindow className="h-4 w-4" /></IconButton>
        {isGroup && <IconButton label="Add tabs" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /></IconButton>}
        <IconButton label="Rename" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /></IconButton>
        <IconButton label="Delete" onClick={remove}><Trash2 className="h-4 w-4" /></IconButton>
      </header>
      {expanded && c.tabs.length > 0 && (
        <ul className="border-t border-line/10 px-2 py-1">
          {c.tabs.map((t, i) => (
            <li key={t.url + i} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-ink/5">
              <img src={t.favIconUrl || faviconFor(t.url, 32)} alt="" className="h-4 w-4 shrink-0 rounded" onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')} />
              <button
                className={cn('min-w-0 flex-1 truncate text-left text-sm', !isRestorable(t.url) && 'text-muted')}
                title={isRestorable(t.url) ? t.url : `${t.url} (browser pages can't be reopened by extensions)`}
                onClick={() => isRestorable(t.url) ? openUrl(t.url, true).catch((e) => toast(errMsg(e), 'error')) : toast("Browser-internal pages can't be reopened by extensions", 'error')}
              >
                {t.title}
              </button>
              <span className="hidden max-w-[12rem] truncate text-xs text-muted md:inline">{safeHost(t.url)}</span>
              <button className="rounded p-1 opacity-0 transition hover:bg-ink/10 group-hover:opacity-100" aria-label={`Remove ${t.title}`} onClick={() => api.removeTab(c.id, i)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {expanded && !c.tabs.length && <p className="border-t border-line/10 px-4 py-3 text-xs text-muted">No tabs yet{isGroup ? ' — add some with +.' : '.'}</p>}

      <EditCollectionModal
        open={editing}
        onClose={() => setEditing(false)}
        initial={{ name: c.name, color: c.color }}
        title="Edit collection"
        onSave={(name, color) => api.updateCollection(c.id, { name, color })}
      />
      {isGroup && <AddTabsModal open={adding} onClose={() => setAdding(false)} collection={c} />}
    </article>
  );
}

const safeHost = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

function EditCollectionModal({ open, onClose, initial, title, onSave }: { open: boolean; onClose: () => void; initial: { name: string; color: string }; title: string; onSave: (name: string, color: string) => void }) {
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);
  useEffect(() => { if (open) { setName(initial.name); setColor(initial.color); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = () => { if (!name.trim()) return; onSave(name.trim(), color); onClose(); };
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={!name.trim()}>Save</Button></>}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Research project" maxLength={60} /></Field>
        <Field label="Colour"><ColorPicker value={color} onChange={setColor} /></Field>
      </form>
    </Modal>
  );
}

function AddTabsModal({ open, onClose, collection }: { open: boolean; onClose: () => void; collection: TabCollection }) {
  const [live, setLive] = useState<LiveTab[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [url, setUrl] = useState('');
  const [urlTitle, setUrlTitle] = useState('');
  const [urlErr, setUrlErr] = useState<string | null>(null);

  const load = async () => {
    setLive(null); setError(null);
    try { setLive(await getCurrentWindowTabs()); } catch (e) { setError(errMsg(e)); setLive([]); }
  };
  useEffect(() => { if (open) { setPicked(new Set()); setUrl(''); setUrlTitle(''); setUrlErr(null); void load(); } }, [open]);

  const existing = new Set(collection.tabs.map((t) => t.url));
  const addPicked = () => {
    const tabs: SavedTab[] = (live ?? []).filter((t) => picked.has(t.tabId)).map(({ tabId, groupId, ...t }) => t);
    let manual: SavedTab | null = null;
    if (url.trim()) {
      const u = normalizeUrl(url);
      try { new URL(u); } catch { setUrlErr('Enter a valid URL'); return; }
      manual = { url: u, title: urlTitle.trim() || safeHost(u) };
    }
    const all = manual ? [...tabs, manual] : tabs;
    if (!all.length) return;
    useTabs.getState().addTabs(collection.id, all);
    toast(`Added ${all.length} tab${all.length === 1 ? '' : 's'}`, 'success');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Add tabs to “${collection.name}”`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={addPicked} disabled={!picked.size && !url.trim()}>Add</Button></>}
    >
      <div className="space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="label mb-0">Open tabs in this window</span>
            <div className="flex gap-1">
              {live && live.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setPicked(picked.size === live.length ? new Set() : new Set(live.map((t) => t.tabId)))}>
                  {picked.size === live.length ? 'Select none' : 'Select all'}
                </Button>
              )}
              <IconButton label="Refresh" className="h-8 w-8" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></IconButton>
            </div>
          </div>
          {live === null ? (
            <div className="grid place-items-center py-6"><Spinner /></div>
          ) : error ? (
            <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-300">{error}</p>
          ) : !live.length ? (
            <p className="text-xs text-muted">No other tabs open.</p>
          ) : (
            <ul className="max-h-64 space-y-0.5 overflow-y-auto scroll-thin">
              {live.map((t) => (
                <li key={t.tabId}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-ink/5">
                    <input
                      type="checkbox"
                      checked={picked.has(t.tabId)}
                      onChange={(e) => { const n = new Set(picked); e.target.checked ? n.add(t.tabId) : n.delete(t.tabId); setPicked(n); }}
                    />
                    <img src={t.favIconUrl || faviconFor(t.url, 32)} alt="" className="h-4 w-4 rounded" onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')} />
                    <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                    {existing.has(t.url) && <Badge>saved</Badge>}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-2">
          <span className="label flex items-center gap-1"><Link2 className="h-3 w-3" /> Or add a URL</span>
          <Field error={urlErr}><Input value={url} onChange={(e) => { setUrl(e.target.value); setUrlErr(null); }} placeholder="https://example.com" /></Field>
          <Input value={urlTitle} onChange={(e) => setUrlTitle(e.target.value)} placeholder="Title (optional)" aria-label="Title" />
        </div>
      </div>
    </Modal>
  );
}

function LiveGroupsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [groups, setGroups] = useState<LiveGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setGroups(null); setError(null);
    try { setGroups(await getLiveTabGroups()); } catch (e) { setError(errMsg(e)); setGroups([]); }
  };
  useEffect(() => { if (open) void load(); }, [open]);

  const save = async (g: LiveGroup) => {
    try {
      const fresh = await saveLiveGroup(g.id);
      useTabs.getState().addCollection({ name: fresh.title, color: fresh.color, kind: 'group', tabs: fresh.tabs });
      toast(`Saved “${fresh.title}”`, 'success');
      onClose();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Save a Chrome tab group" footer={<Button variant="ghost" onClick={onClose}>Close</Button>}>
      {groups === null ? (
        <div className="grid place-items-center py-6"><Spinner /></div>
      ) : error ? (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-300">{error}</p>
      ) : !groups.length ? (
        <EmptyState icon={<Group className="h-5 w-5" />} title="No open tab groups" description="Group tabs in Chrome (right-click a tab → Add tab to group), then save them here." action={<Button size="sm" onClick={load}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>} />
      ) : (
        <ul className="space-y-2">
          {groups.map((g) => (
            <li key={g.id} className="card flex items-center gap-3 p-3">
              <span className="h-3 w-3 rounded-full" style={{ background: g.color }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{g.title}</p>
                <p className="text-xs text-muted">{g.tabs.length} tab{g.tabs.length === 1 ? '' : 's'}</p>
              </div>
              <Button size="sm" variant="primary" onClick={() => save(g)}>Save</Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
