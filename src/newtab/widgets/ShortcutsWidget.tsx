import { useState } from 'react';
import { Plus, X, Pencil } from 'lucide-react';
import { useS, useSettings } from '@/stores/settings';
import { Button, Field, Input, Modal, toast } from '@/components/ui';
import { faviconFor, normalizeUrl, uid } from '@/lib/utils';
import type { Shortcut } from '@/lib/types';

export default function ShortcutsWidget() {
  const s = useS();
  const update = useSettings((st) => st.update);
  const [edit, setEdit] = useState<Shortcut | null>(null);
  const [form, setForm] = useState({ title: '', url: '' });
  const [err, setErr] = useState<string | null>(null);

  const open = (sc?: Shortcut) => {
    setEdit(sc ?? { id: '', title: '', url: '' });
    setForm({ title: sc?.title ?? '', url: sc?.url ?? '' });
    setErr(null);
  };
  const save = () => {
    const url = normalizeUrl(form.url);
    try { new URL(url); } catch { setErr('Enter a valid URL'); return; }
    const title = form.title.trim() || new URL(url).hostname.replace(/^www\./, '');
    if (edit?.id) update({ shortcuts: s.shortcuts.map((x) => (x.id === edit.id ? { ...x, title, url } : x)) });
    else update({ shortcuts: [...s.shortcuts, { id: uid(), title, url }] });
    setEdit(null);
  };
  const remove = (sc: Shortcut) => {
    const prev = s.shortcuts;
    update({ shortcuts: s.shortcuts.filter((x) => x.id !== sc.id) });
    toast(`Removed ${sc.title}`, 'info', { label: 'Undo', run: () => update({ shortcuts: prev }) });
  };

  return (
    <div className="flex max-w-[36rem] flex-wrap gap-2">
      {s.shortcuts.map((sc) => (
        <div key={sc.id} className="group relative">
          <a href={sc.url} className="glass flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm transition hover:bg-white/15" title={sc.url}>
            <img src={faviconFor(sc.url, 32)} alt="" className="h-4 w-4 rounded" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
            <span className="max-w-[9rem] truncate">{sc.title}</span>
          </a>
          <div className="absolute -right-1.5 -top-1.5 hidden gap-0.5 group-hover:flex">
            <button className="rounded-full bg-black/70 p-0.5 hover:bg-black" aria-label={`Edit ${sc.title}`} onClick={() => open(sc)}><Pencil className="h-3 w-3" /></button>
            <button className="rounded-full bg-black/70 p-0.5 hover:bg-black" aria-label={`Remove ${sc.title}`} onClick={() => remove(sc)}><X className="h-3 w-3" /></button>
          </div>
        </div>
      ))}
      <button onClick={() => open()} className="glass grid h-8 w-8 place-items-center rounded-xl hover:bg-white/15" aria-label="Add shortcut" title="Add shortcut">
        <Plus className="h-4 w-4" />
      </button>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? 'Edit shortcut' : 'Add shortcut'}
        size="sm"
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}
      >
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <Field label="URL" error={err}><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="example.com" /></Field>
          <Field label="Name"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Optional" /></Field>
          <button type="submit" hidden />
        </form>
      </Modal>
    </div>
  );
}
