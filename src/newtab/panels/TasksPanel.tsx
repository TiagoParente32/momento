import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  CheckSquare, CalendarDays, CalendarClock, Inbox, CheckCircle2, Plus, Search, Trash2, X, Flag, Repeat, Bell,
  Timer, Pencil, GripVertical, Tag, ListTodo, ChevronRight, Check,
} from 'lucide-react';
import { PanelFrame } from '@/components/PanelFrame';
import { Badge, Burst, Button, ColorPicker, EmptyState, Field, IconButton, Input, Modal, Select, Textarea, confirmDialog, toast, useCelebrate } from '@/components/ui';
import { useTasks, PRIORITY_META, RECURRENCE_LABEL, formatDue, isOverdue } from '@/stores/tasks';
import { useS } from '@/stores/settings';
import { useUI } from '@/stores/ui';
import { addDays, cn, fromISODate, PALETTE, toISODate, todayISO, uid, pad } from '@/lib/utils';
import type { Priority, Recurrence, Task, TaskList } from '@/lib/types';

type SmartView = 'today' | 'upcoming' | 'all' | 'completed';
type View = { kind: 'smart'; id: SmartView } | { kind: 'list'; id: string };
type SortKey = 'manual' | 'due' | 'priority' | 'created';

const SMART: { id: SmartView; label: string; icon: ReactNode }[] = [
  { id: 'today', label: 'Today', icon: <CalendarDays className="h-4 w-4" /> },
  { id: 'upcoming', label: 'Upcoming', icon: <CalendarClock className="h-4 w-4" /> },
  { id: 'all', label: 'All tasks', icon: <Inbox className="h-4 w-4" /> },
  { id: 'completed', label: 'Completed', icon: <CheckCircle2 className="h-4 w-4" /> },
];

const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low', 'none'];
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** Parse quick-add tokens: !high #category @list today/tomorrow/mon/next week/YYYY-MM-DD daily/weekly… */
export function parseQuickAdd(input: string, lists: TaskList[]): Partial<Task> & { title: string } {
  const out: Partial<Task> & { title: string } = { title: '' };
  const words: string[] = [];
  const tokens = input.trim().split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    const raw = tokens[i];
    const w = raw.toLowerCase();
    const next = tokens[i + 1]?.toLowerCase();
    const prio: Record<string, Priority> = { '!urgent': 'urgent', '!1': 'urgent', '!high': 'high', '!2': 'high', '!medium': 'medium', '!med': 'medium', '!3': 'medium', '!low': 'low', '!4': 'low' };
    if (prio[w]) { out.priority = prio[w]; continue; }
    if (/^#[\w-]+$/.test(raw)) { out.category = raw.slice(1); continue; }
    if (/^@[\w-]+$/.test(raw)) {
      const l = lists.find((x) => x.name.toLowerCase().replace(/\s+/g, '') === w.slice(1));
      if (l) { out.listId = l.id; continue; }
    }
    if (w === 'today') { out.dueDate = todayISO(); continue; }
    if (w === 'tomorrow' || w === 'tmr') { out.dueDate = toISODate(addDays(new Date(), 1)); continue; }
    if (w === 'next' && next === 'week') { out.dueDate = toISODate(addDays(new Date(), 7)); i++; continue; }
    const wd = WEEKDAYS.findIndex((d) => w === d || w === d + 'day' || (w.length > 3 && (d + 'day').startsWith(w)));
    if (wd >= 0 && w.length >= 3) {
      const diff = (wd - new Date().getDay() + 7) % 7 || 7;
      out.dueDate = toISODate(addDays(new Date(), diff));
      continue;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(w)) { out.dueDate = w; continue; }
    if (/^\d{1,2}:\d{2}$/.test(w)) { const [h, m] = w.split(':'); out.dueTime = `${pad(+h)}:${m}`; if (!out.dueDate) out.dueDate = todayISO(); continue; }
    const rec: Record<string, Recurrence> = { daily: 'daily', weekdays: 'weekdays', weekly: 'weekly', monthly: 'monthly', yearly: 'yearly' };
    if (rec[w]) { out.recurrence = rec[w]; if (!out.dueDate) out.dueDate = todayISO(); continue; }
    if (w === 'every' && next && ['day', 'week', 'month', 'year', 'weekday'].includes(next)) {
      out.recurrence = ({ day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly', weekday: 'weekdays' } as const)[next as 'day'];
      if (!out.dueDate) out.dueDate = todayISO();
      i++;
      continue;
    }
    words.push(raw);
  }
  out.title = words.join(' ');
  return out;
}

const sorters: Record<SortKey, (a: Task, b: Task) => number> = {
  manual: (a, b) => a.order - b.order,
  due: (a, b) => (a.dueDate ? `${a.dueDate}${a.dueTime ?? '99'}` : '~').localeCompare(b.dueDate ? `${b.dueDate}${b.dueTime ?? '99'}` : '~') || a.order - b.order,
  priority: (a, b) => PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank || a.order - b.order,
  created: (a, b) => b.createdAt.localeCompare(a.createdAt),
};

export default function TasksPanel() {
  const { tasks, lists } = useTasks();
  const actions = useTasks.getState();
  const settings = useS();
  const params = useUI((s) => s.params);
  const [view, setView] = useState<View>({ kind: 'smart', id: 'today' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [prioFilter, setPrioFilter] = useState<Priority | 'any'>('any');
  const [catFilter, setCatFilter] = useState('');
  const [sort, setSort] = useState<SortKey>('manual');
  const [showDone, setShowDone] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    if (params.task && tasks.some((t) => t.id === params.task)) {
      setSelectedId(params.task);
      setView({ kind: 'smart', id: 'all' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.task]);

  const categories = useMemo(() => [...new Set(tasks.map((t) => t.category).filter(Boolean))].sort(), [tasks]);
  const today = todayISO();
  const listById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);

  const counts = useMemo(() => {
    const open = tasks.filter((t) => !t.done);
    return {
      today: open.filter((t) => t.dueDate && t.dueDate <= today).length,
      upcoming: open.filter((t) => t.dueDate && t.dueDate > today).length,
      all: open.length,
      completed: tasks.length - open.length,
      lists: Object.fromEntries(lists.map((l) => [l.id, open.filter((t) => t.listId === l.id).length])) as Record<string, number>,
    };
  }, [tasks, lists, today]);

  const visible = useMemo(() => {
    let list = tasks;
    if (view.kind === 'list') list = list.filter((t) => t.listId === view.id && (showDone || !t.done));
    else if (view.id === 'today') list = list.filter((t) => (!t.done && t.dueDate && t.dueDate <= today) || (showDone && t.done && t.completedAt?.slice(0, 10) === today));
    else if (view.id === 'upcoming') list = list.filter((t) => !t.done && t.dueDate && t.dueDate > today);
    else if (view.id === 'all') list = list.filter((t) => showDone || !t.done);
    else list = list.filter((t) => t.done);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || t.subtasks.some((s) => s.title.toLowerCase().includes(q)));
    }
    if (prioFilter !== 'any') list = list.filter((t) => t.priority === prioFilter);
    if (catFilter) list = list.filter((t) => t.category === catFilter);
    const sorted = [...list].sort(view.kind === 'smart' && view.id === 'completed' ? (a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '') : view.kind === 'smart' && view.id === 'upcoming' && sort === 'manual' ? sorters.due : sorters[sort]);
    // keep open tasks above done ones
    return sorted.sort((a, b) => Number(a.done) - Number(b.done));
  }, [tasks, view, query, prioFilter, catFilter, sort, showDone, today]);

  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  const remove = async (t: Task) => {
    if (settings.tasks.confirmDelete && !(await confirmDialog({ title: 'Delete task?', message: `“${t.title}” will be permanently deleted.`, confirmLabel: 'Delete', danger: true }))) return;
    actions.deleteTask(t.id);
    if (selectedId === t.id) setSelectedId(null);
    if (!settings.tasks.confirmDelete) {
      toast('Task deleted', 'info', { label: 'Undo', run: () => { const st = useTasks.getState(); useTasks.replace({ tasks: [...st.tasks, t], lists: st.lists }); } });
    }
  };

  const title = view.kind === 'smart' ? SMART.find((s) => s.id === view.id)!.label : listById.get(view.id)?.name ?? 'List';
  const defaultListId = view.kind === 'list' ? view.id : settings.tasks.defaultListId && listById.has(settings.tasks.defaultListId) ? settings.tasks.defaultListId : lists[0]?.id;
  const defaultDue = view.kind === 'smart' && view.id === 'today' ? today : null;

  // group upcoming by date
  const groups = useMemo(() => {
    if (!(view.kind === 'smart' && view.id === 'upcoming')) return null;
    const m = new Map<string, Task[]>();
    for (const t of visible) { const k = t.dueDate!; if (!m.has(k)) m.set(k, []); m.get(k)!.push(t); }
    return [...m.entries()];
  }, [visible, view]);

  const manualDrag = sort === 'manual' && !(view.kind === 'smart' && (view.id === 'upcoming' || view.id === 'completed'));

  const row = (t: Task) => (
    <TaskRow
      key={t.id}
      task={t}
      list={listById.get(t.listId)}
      selected={t.id === selectedId}
      draggable={manualDrag}
      dragging={dragId === t.id}
      onDragStart={() => setDragId(t.id)}
      onDragEnd={() => setDragId(null)}
      onDropBefore={() => { if (dragId && dragId !== t.id) actions.moveTask(dragId, t.id); setDragId(null); }}
      onSelect={() => setSelectedId(t.id === selectedId ? null : t.id)}
      onToggle={() => actions.toggleTask(t.id)}
    />
  );

  return (
    <PanelFrame
      title="Tasks"
      icon={<CheckSquare className="h-4 w-4" />}
      sidebar={<Sidebar view={view} setView={(v) => { setView(v); setSelectedId(null); }} counts={counts} lists={lists} />}
    >
      <div className="flex h-full min-h-0">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="space-y-3 px-5 pb-3 pt-4">
            <div className="flex items-center gap-2">
              <h3 className="flex-1 text-xl font-semibold tracking-tight">{title}</h3>
              {view.kind === 'smart' && view.id === 'completed' ? (
                counts.completed > 0 && (
                  <Button size="sm" variant="ghost" onClick={async () => { if (await confirmDialog({ title: 'Clear completed tasks?', message: 'All completed tasks will be deleted.', confirmLabel: 'Clear', danger: true })) actions.clearCompleted(); }}>
                    <Trash2 className="h-3.5 w-3.5" /> Clear all
                  </Button>
                )
              ) : (
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show completed
                </label>
              )}
            </div>
            {!(view.kind === 'smart' && view.id === 'completed') && <QuickAdd lists={lists} defaultListId={defaultListId} defaultDue={defaultDue} />}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[10rem] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks" className="pl-9" aria-label="Search tasks" />
              </div>
              <Select value={prioFilter} onChange={(e) => setPrioFilter(e.target.value as Priority | 'any')} className="w-auto" aria-label="Filter by priority">
                <option value="any">Any priority</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
              </Select>
              <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="w-auto" aria-label="Filter by category">
                <option value="">All categories</option>
                {categories.map((c) => <option key={c} value={c}>#{c}</option>)}
              </Select>
              <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-auto" aria-label="Sort tasks">
                <option value="manual">Manual order</option>
                <option value="due">Due date</option>
                <option value="priority">Priority</option>
                <option value="created">Newest first</option>
              </Select>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 scroll-thin" onDragOver={(e) => manualDrag && e.preventDefault()} onDrop={() => { if (dragId) actions.moveTask(dragId, null); setDragId(null); }}>
            {visible.length === 0 ? (
              <EmptyState
                icon={<ListTodo className="h-6 w-6" />}
                title={query || prioFilter !== 'any' || catFilter ? 'No matching tasks' : view.kind === 'smart' && view.id === 'completed' ? 'Nothing completed yet' : 'All clear'}
                description={query || prioFilter !== 'any' || catFilter ? 'Try a different search or filter.' : 'Add a task above. Tip: try “Call mum tomorrow !high #family”.'}
              />
            ) : groups ? (
              groups.map(([date, items]) => (
                <div key={date} className="mb-3">
                  <p className="section-title px-2 pb-1 pt-2">{fromISODate(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                  {items.map(row)}
                </div>
              ))
            ) : (
              visible.map(row)
            )}
          </div>
        </div>
        {selected && <TaskDetail key={selected.id} task={selected} lists={lists} categories={categories} onClose={() => setSelectedId(null)} onDelete={() => remove(selected)} />}
      </div>
    </PanelFrame>
  );
}

function Sidebar({ view, setView, counts, lists }: { view: View; setView: (v: View) => void; counts: { today: number; upcoming: number; all: number; completed: number; lists: Record<string, number> }; lists: TaskList[] }) {
  const actions = useTasks.getState();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[0]);
  const [editList, setEditList] = useState<TaskList | null>(null);

  const item = (active: boolean, onClick: () => void, icon: ReactNode, label: string, count: number, extra?: ReactNode) => (
    <div className={cn('group flex items-center rounded-xl text-sm transition', active ? 'bg-accent/12 text-ink font-medium' : 'text-ink/80 hover:bg-ink/5')}>
      <button className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left" onClick={onClick}>
        {icon}
        <span className="flex-1 truncate">{label}</span>
        {count > 0 && <span className="text-xs text-muted">{count}</span>}
      </button>
      {extra}
    </div>
  );

  return (
    <nav className="space-y-4" aria-label="Task views">
      <div className="space-y-0.5">
        {SMART.map((s) => item(view.kind === 'smart' && view.id === s.id, () => setView({ kind: 'smart', id: s.id }), s.icon, s.label, counts[s.id]))}
      </div>
      <div>
        <div className="flex items-center justify-between px-2.5 pb-1">
          <span className="section-title">Lists</span>
          <IconButton label="New list" className="h-7 w-7" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /></IconButton>
        </div>
        <div className="space-y-0.5">
          {[...lists].sort((a, b) => a.order - b.order).map((l) =>
            item(
              view.kind === 'list' && view.id === l.id,
              () => setView({ kind: 'list', id: l.id }),
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: l.color }} />,
              l.name,
              counts.lists[l.id] ?? 0,
              <button className="mr-1 rounded-lg p-1 text-muted opacity-0 hover:bg-ink/10 hover:text-ink group-hover:opacity-100 focus:opacity-100" aria-label={`Edit list ${l.name}`} onClick={() => setEditList(l)}>
                <Pencil className="h-3.5 w-3.5" />
              </button>,
            ),
          )}
        </div>
        {adding && (
          <form
            className="mt-2 space-y-2 rounded-xl bg-ink/5 p-2"
            onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; const l = actions.addList(name, color); setName(''); setAdding(false); setView({ kind: 'list', id: l.id }); }}
          >
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="List name" onKeyDown={(e) => e.key === 'Escape' && setAdding(false)} />
            <ColorPicker value={color} onChange={setColor} />
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              <Button size="sm" variant="primary" type="submit">Add</Button>
            </div>
          </form>
        )}
      </div>
      <p className="px-2.5 text-[11px] leading-relaxed text-muted">
        Quick add: <code>!high</code> <code>#tag</code> <code>@work</code> <code>tomorrow</code> <code>fri</code> <code>14:30</code> <code>weekly</code>
      </p>
      <EditListModal list={editList} onClose={() => setEditList(null)} onDeleted={(id) => view.kind === 'list' && view.id === id && setView({ kind: 'smart', id: 'all' })} />
    </nav>
  );
}

function EditListModal({ list, onClose, onDeleted }: { list: TaskList | null; onClose: () => void; onDeleted: (id: string) => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[0]);
  useEffect(() => { if (list) { setName(list.name); setColor(list.color); } }, [list]);
  if (!list) return null;
  const save = () => { useTasks.getState().updateList(list.id, { name: name.trim() || list.name, color }); onClose(); };
  const del = async () => {
    if (await confirmDialog({ title: `Delete “${list.name}”?`, message: 'Tasks in this list will move to Personal.', confirmLabel: 'Delete list', danger: true })) {
      useTasks.getState().deleteList(list.id);
      onDeleted(list.id);
      onClose();
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Edit list"
      size="sm"
      footer={
        <>
          {list.id !== 'personal' && <Button variant="ghost" className="mr-auto text-red-500" onClick={del}><Trash2 className="h-4 w-4" /> Delete</Button>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>Save</Button>
        </>
      }
    >
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Colour"><ColorPicker value={color} onChange={setColor} /></Field>
      </form>
    </Modal>
  );
}

function QuickAdd({ lists, defaultListId, defaultDue }: { lists: TaskList[]; defaultListId?: string; defaultDue: string | null }) {
  const [text, setText] = useState('');
  const parsed = useMemo(() => (text.trim() ? parseQuickAdd(text, lists) : null), [text, lists]);
  const submit = () => {
    if (!parsed?.title) return;
    useTasks.getState().addTask({ listId: defaultListId, dueDate: defaultDue, ...parsed });
    setText('');
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="flex items-center gap-2 rounded-xl border border-line/10 bg-ink/5 px-3 focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/20">
        <Plus className="h-4 w-4 text-accent" />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a task…" className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-muted" aria-label="Add a task" />
        {parsed?.title && <Button size="sm" variant="primary" type="submit">Add</Button>}
      </div>
      {parsed && (parsed.priority || parsed.category || parsed.dueDate || parsed.recurrence || parsed.listId) && (
        <div className="mt-1.5 flex flex-wrap gap-1.5 px-1">
          {parsed.priority && <Badge color={PRIORITY_META[parsed.priority].color}><Flag className="h-3 w-3" />{PRIORITY_META[parsed.priority].label}</Badge>}
          {parsed.dueDate && <Badge><CalendarDays className="h-3 w-3" />{formatDue({ dueDate: parsed.dueDate, dueTime: parsed.dueTime ?? null } as Task)}</Badge>}
          {parsed.recurrence && <Badge><Repeat className="h-3 w-3" />{RECURRENCE_LABEL[parsed.recurrence]}</Badge>}
          {parsed.category && <Badge><Tag className="h-3 w-3" />{parsed.category}</Badge>}
          {parsed.listId && <Badge color={lists.find((l) => l.id === parsed.listId)?.color}>{lists.find((l) => l.id === parsed.listId)?.name}</Badge>}
        </div>
      )}
    </form>
  );
}

function Checkbox({ checked, onChange, color, label }: { checked: boolean; onChange: () => void; color?: string; label: string }) {
  const burst = useCelebrate(checked);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className={cn('relative grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition duration-300 ease-spring hover:scale-110 active:scale-90', checked ? 'border-transparent bg-accent text-white' : 'border-line/30')}
      style={!checked && color ? { borderColor: color } : undefined}
    >
      {checked && <Check className="h-3 w-3 animate-pop" strokeWidth={3} />}
      {burst > 0 && <Burst key={burst} count={8} distance={16} colors={['rgb(var(--accent))', '#fbbf24', '#34d399', '#f472b6']} />}
    </button>
  );
}

function TaskRow({ task: t, list, selected, onSelect, onToggle, draggable, dragging, onDragStart, onDragEnd, onDropBefore }: {
  task: Task; list?: TaskList; selected: boolean; onSelect: () => void; onToggle: () => void;
  draggable: boolean; dragging: boolean; onDragStart: () => void; onDragEnd: () => void; onDropBefore: () => void;
}) {
  const subDone = t.subtasks.filter((s) => s.done).length;
  const overdue = isOverdue(t);
  return (
    <div
      className={cn('group flex cursor-pointer items-start gap-3 rounded-xl px-2.5 py-2.5 transition', selected ? 'bg-accent/10' : 'hover:bg-ink/5', dragging && 'opacity-40')}
      onClick={onSelect}
      draggable={draggable}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => draggable && e.preventDefault()}
      onDrop={(e) => { e.stopPropagation(); onDropBefore(); }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect(); if (e.key === ' ') { e.preventDefault(); onToggle(); } }}
    >
      {draggable && <GripVertical className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-muted opacity-0 group-hover:opacity-60" />}
      <span className="mt-px"><Checkbox checked={t.done} onChange={onToggle} color={t.priority !== 'none' ? PRIORITY_META[t.priority].color : undefined} label={t.done ? `Mark “${t.title}” as not done` : `Complete “${t.title}”`} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm"><span className={cn('strike transition-colors duration-300', t.done && 'is-done text-muted')}>{t.title}</span></p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted">
          {t.dueDate && <span className={cn('inline-flex items-center gap-1', overdue && 'font-medium text-red-500')}><CalendarDays className="h-3 w-3" />{formatDue(t)}</span>}
          {t.recurrence !== 'none' && <Repeat className="h-3 w-3" aria-label={RECURRENCE_LABEL[t.recurrence]} />}
          {t.reminderAt && <Bell className="h-3 w-3" aria-label="Has reminder" />}
          {t.subtasks.length > 0 && <span>{subDone}/{t.subtasks.length} subtasks</span>}
          {t.category && <span>#{t.category}</span>}
          {t.focusMinutes > 0 && <span className="inline-flex items-center gap-0.5"><Timer className="h-3 w-3" />{t.focusMinutes}m</span>}
          {list && <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: list.color }} />{list.name}</span>}
        </div>
      </div>
      {t.priority !== 'none' && <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: PRIORITY_META[t.priority].color }} aria-label={`${PRIORITY_META[t.priority].label} priority`} />}
      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted opacity-0 group-hover:opacity-100" />
    </div>
  );
}

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${toISODate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function TaskDetail({ task: t, lists, categories, onClose, onDelete }: { task: Task; lists: TaskList[]; categories: string[]; onClose: () => void; onDelete: () => void }) {
  const { updateTask, toggleTask } = useTasks.getState();
  const openPanel = useUI((s) => s.openPanel);
  const [title, setTitle] = useState(t.title);
  const [desc, setDesc] = useState(t.description);
  const [newSub, setNewSub] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const up = (patch: Partial<Task>) => updateTask(t.id, patch);

  const setSubtasks = (subtasks: Task['subtasks']) => up({ subtasks });

  return (
    <aside className="flex w-[22rem] shrink-0 flex-col border-l border-line/10 animate-slide-in" aria-label="Task details">
      <div className="flex items-center gap-2 border-b border-line/10 px-4 py-2.5">
        <Checkbox checked={t.done} onChange={() => toggleTask(t.id)} label={t.done ? 'Mark not done' : 'Complete task'} />
        <span className="flex-1 text-xs text-muted">{t.done ? `Completed ${t.completedAt ? new Date(t.completedAt).toLocaleString() : ''}` : 'Task details'}</span>
        <IconButton label="Delete task" onClick={onDelete}><Trash2 className="h-4 w-4" /></IconButton>
        <IconButton label="Close details" onClick={onClose}><X className="h-4 w-4" /></IconButton>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4 scroll-thin">
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() ? up({ title: title.trim() }) : setTitle(t.title)}
          onKeyDown={(e) => e.key === 'Enter' && titleRef.current?.blur()}
          className={cn('w-full bg-transparent text-lg font-semibold outline-none', t.done && 'line-through text-muted')}
          aria-label="Task title"
        />
        <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={() => desc !== t.description && up({ description: desc })} placeholder="Add a description…" aria-label="Description" />

        <div className="grid grid-cols-2 gap-3">
          <Field label="List">
            <Select value={t.listId} onChange={(e) => up({ listId: e.target.value })}>
              {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={t.priority} onChange={(e) => up({ priority: e.target.value as Priority })}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
            </Select>
          </Field>
          <Field label="Due date">
            <Input type="date" value={t.dueDate ?? ''} onChange={(e) => up({ dueDate: e.target.value || null, ...(e.target.value ? {} : { dueTime: null }) })} />
          </Field>
          <Field label="Time">
            <Input type="time" value={t.dueTime ?? ''} disabled={!t.dueDate} onChange={(e) => up({ dueTime: e.target.value || null })} />
          </Field>
          <Field label="Repeat" className="col-span-2">
            <Select value={t.recurrence} onChange={(e) => { const r = e.target.value as Recurrence; up({ recurrence: r, ...(r !== 'none' && !t.dueDate ? { dueDate: todayISO() } : {}) }); }}>
              {(Object.keys(RECURRENCE_LABEL) as Recurrence[]).map((r) => <option key={r} value={r}>{RECURRENCE_LABEL[r]}</option>)}
            </Select>
          </Field>
          <Field label="Reminder" className="col-span-2" hint={t.reminderAt && new Date(t.reminderAt) < new Date() ? 'This reminder time has passed.' : 'You’ll get a browser notification.'}>
            <div className="flex gap-2">
              <Input type="datetime-local" value={toLocalInput(t.reminderAt)} onChange={(e) => up({ reminderAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              {t.reminderAt && <IconButton label="Remove reminder" onClick={() => up({ reminderAt: null })}><X className="h-4 w-4" /></IconButton>}
            </div>
          </Field>
          <Field label="Category" className="col-span-2">
            <Input list="task-categories" value={t.category} onChange={(e) => up({ category: e.target.value.replace(/^#/, '') })} placeholder="e.g. errands" />
            <datalist id="task-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
        </div>

        <div>
          <p className="label">Subtasks {t.subtasks.length > 0 && `· ${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}`}</p>
          <div className="space-y-1">
            {t.subtasks.map((s) => (
              <div key={s.id} className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-ink/5">
                <input type="checkbox" checked={s.done} onChange={() => setSubtasks(t.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))} aria-label={`Subtask ${s.title}`} />
                <input
                  defaultValue={s.title}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== s.title && setSubtasks(t.subtasks.map((x) => (x.id === s.id ? { ...x, title: e.target.value.trim() } : x)))}
                  className={cn('flex-1 bg-transparent text-sm outline-none', s.done && 'text-muted line-through')}
                  aria-label="Subtask title"
                />
                <button className="rounded p-0.5 text-muted opacity-0 hover:text-red-500 group-hover:opacity-100" aria-label="Delete subtask" onClick={() => setSubtasks(t.subtasks.filter((x) => x.id !== s.id))}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <form className="mt-1 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!newSub.trim()) return; setSubtasks([...t.subtasks, { id: uid(), title: newSub.trim(), done: false }]); setNewSub(''); }}>
            <Input value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="Add a subtask" className="h-8" />
            <Button size="sm" type="submit" disabled={!newSub.trim()}>Add</Button>
          </form>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-ink/5 px-3 py-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1"><Timer className="h-3.5 w-3.5" /> {t.focusMinutes || 0} min focused</span>
          <span>Created {new Date(t.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
      <div className="border-t border-line/10 p-3">
        <Button variant="primary" className="w-full justify-center" disabled={t.done} onClick={() => openPanel('focus', { task: t.id })}>
          <Timer className="h-4 w-4" /> Focus on this
        </Button>
      </div>
    </aside>
  );
}

