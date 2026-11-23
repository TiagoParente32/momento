import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw, Trash2, MapPin, Bell, CheckSquare, Lock, Clock } from 'lucide-react';
import { PanelFrame } from '@/components/PanelFrame';
import { Button, ColorPicker, EmptyState, Field, IconButton, Input, Modal, Segmented, Select, Textarea, Toggle, confirmDialog, toast } from '@/components/ui';
import { useCalendar } from '@/stores/calendar';
import { useCalendarItems } from '../useCalendarItems';
import { useS } from '@/stores/settings';
import { useUI } from '@/stores/ui';
import { hasCalendarConnection, syncExternalCalendars } from '@/lib/integrations';
import { type CalItem, combine, dateOf, fmtTime, itemsOnDay, timeOf } from '@/lib/calendarUtils';
import { addDays, cn, DAY_NAMES, MONTH_NAMES, PALETTE, sameDay, startOfDay, startOfWeek, toISODate } from '@/lib/utils';
import type { CalendarEvent } from '@/lib/types';

type View = 'month' | 'week' | 'day' | 'upcoming';
const HOUR_PX = 48;

interface Draft { id?: string; title: string; description: string; location: string; allDay: boolean; startDate: string; startTime: string; endDate: string; endTime: string; color: string; reminderMin: number | null; }

const draftFrom = (start: Date, allDay = false): Draft => {
  const s = new Date(start);
  if (!allDay && s.getHours() === 0 && s.getMinutes() === 0) {
    const now = new Date();
    s.setHours(Math.min(23, now.getHours() + 1), 0, 0, 0);
  }
  const e = new Date(s.getTime() + 3600000);
  return {
    title: '', description: '', location: '', allDay,
    startDate: toISODate(s), startTime: timeOf(s.toISOString()), endDate: toISODate(e), endTime: timeOf(e.toISOString()),
    color: PALETTE[0], reminderMin: 10,
  };
};
const draftFromEvent = (ev: CalendarEvent): Draft => ({
  id: ev.id, title: ev.title, description: ev.description, location: ev.location ?? '', allDay: ev.allDay,
  startDate: dateOf(ev.start), startTime: timeOf(ev.start),
  endDate: ev.allDay ? toISODate(addDays(new Date(ev.end), -1)) : dateOf(ev.end), endTime: timeOf(ev.end),
  color: ev.color, reminderMin: ev.reminderMin,
});

export default function CalendarPanel() {
  const s = useS();
  const params = useUI((st) => st.params);
  const openPanel = useUI((st) => st.openPanel);
  const { lastExternalSync, setExternal } = useCalendar();
  const items = useCalendarItems();
  const [view, setView] = useState<View>((params.view as View) || 'month');
  const [cursor, setCursor] = useState(() => (params.date ? new Date(params.date) : new Date()));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [viewing, setViewing] = useState<CalItem | null>(null);
  const [syncing, setSyncing] = useState(false);
  const connected = safeHasConnection();

  const sync = async (silent = false) => {
    setSyncing(true);
    try {
      const from = addDays(startOfDay(new Date()), -31);
      const to = addDays(startOfDay(new Date()), 90);
      const evs = await syncExternalCalendars(from, to);
      setExternal(evs);
      if (!silent) toast(`Synced ${evs.length} event${evs.length === 1 ? '' : 's'}`, 'success');
    } catch (e) {
      if (!silent) toast(e instanceof Error ? e.message : 'Calendar sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  };
  useEffect(() => {
    if (connected && (!lastExternalSync || Date.now() - new Date(lastExternalSync).getTime() > 15 * 60000)) void sync(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const move = (dir: -1 | 1) => {
    const d = new Date(cursor);
    if (view === 'month') d.setMonth(d.getMonth() + dir, 1);
    else if (view === 'week') d.setDate(d.getDate() + 7 * dir);
    else d.setDate(d.getDate() + dir);
    setCursor(d);
  };

  const heading = (() => {
    if (view === 'month' || view === 'upcoming') return `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`;
    if (view === 'week') {
      const ws = startOfWeek(cursor, s.weekStartsOn);
      const we = addDays(ws, 6);
      return `${ws.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${we.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return cursor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  })();

  const onItemClick = (it: CalItem) => {
    if (it.kind === 'event' && !it.readOnly && it.event) setDraft(draftFromEvent(it.event));
    else setViewing(it);
  };

  return (
    <PanelFrame
      title="Calendar"
      icon={<CalendarDays className="h-4 w-4" />}
      actions={
        <div className="flex items-center gap-2">
          {connected ? (
            <Button size="sm" variant="ghost" onClick={() => sync(false)} loading={syncing} title={lastExternalSync ? `Last synced ${new Date(lastExternalSync).toLocaleString()}` : 'Not synced yet'}>
              {!syncing && <RefreshCw className="h-3.5 w-3.5" />} Sync
              {lastExternalSync && <span className="hidden text-muted lg:inline">· {new Date(lastExternalSync).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>}
            </Button>
          ) : (
            <button className="hidden text-xs text-muted underline-offset-2 hover:text-ink hover:underline md:inline" onClick={() => openPanel('settings', { section: 'integrations' })}>
              Connect Google Calendar / Outlook in Settings
            </button>
          )}
          <Button size="sm" variant="primary" onClick={() => setDraft(draftFrom(view === 'month' || view === 'upcoming' ? new Date() : cursor))}>
            <Plus className="h-3.5 w-3.5" /> Event
          </Button>
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex flex-wrap items-center gap-2 px-5 py-3">
          <Button size="sm" onClick={() => setCursor(new Date())}>Today</Button>
          <IconButton label="Previous" onClick={() => move(-1)}><ChevronLeft className="h-4 w-4" /></IconButton>
          <IconButton label="Next" onClick={() => move(1)}><ChevronRight className="h-4 w-4" /></IconButton>
          <h3 className="min-w-0 flex-1 truncate text-base font-semibold">{heading}</h3>
          <Segmented<View>
            value={view}
            onChange={setView}
            options={[{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }, { value: 'day', label: 'Day' }, { value: 'upcoming', label: 'Upcoming' }]}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-hidden px-5 pb-5">
          {view === 'month' && (
            <MonthView
              cursor={cursor} items={items} weekStartsOn={s.weekStartsOn} h24={s.clock24h}
              onDay={(d) => { setCursor(d); setView('day'); }}
              onCreate={(d) => setDraft(draftFrom(d, true))}
              onItem={onItemClick}
            />
          )}
          {view === 'week' && <TimeGrid days={Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor, s.weekStartsOn), i))} items={items} h24={s.clock24h} onSlot={(d) => setDraft(draftFrom(d))} onItem={onItemClick} />}
          {view === 'day' && <TimeGrid days={[startOfDay(cursor)]} items={items} h24={s.clock24h} onSlot={(d) => setDraft(draftFrom(d))} onItem={onItemClick} />}
          {view === 'upcoming' && <Upcoming items={items} h24={s.clock24h} onItem={onItemClick} onCreate={() => setDraft(draftFrom(new Date()))} />}
        </div>
      </div>

      <EventModal draft={draft} onClose={() => setDraft(null)} />
      <ItemDetails item={viewing} onClose={() => setViewing(null)} h24={s.clock24h} />
    </PanelFrame>
  );
}

function safeHasConnection() {
  try { return hasCalendarConnection(); } catch { return false; }
}

// ---------------------------------------------------------------- Month
function MonthView({ cursor, items, weekStartsOn, h24, onDay, onCreate, onItem }: { cursor: Date; items: CalItem[]; weekStartsOn: 0 | 1; h24: boolean; onDay: (d: Date) => void; onCreate: (d: Date) => void; onItem: (i: CalItem) => void }) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = startOfWeek(first, weekStartsOn);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = new Date();
  const dayNames = Array.from({ length: 7 }, (_, i) => DAY_NAMES[(i + weekStartsOn) % 7]);
  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-7 pb-1">
        {dayNames.map((d) => <div key={d} className="px-2 text-xs font-semibold uppercase tracking-wide text-muted">{d}</div>)}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 overflow-hidden rounded-2xl border border-line/10">
        {days.map((d) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const dayItems = itemsOnDay(items, d);
          const isToday = sameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              className={cn('group relative flex min-h-0 cursor-pointer flex-col gap-0.5 overflow-hidden border-b border-r border-line/10 p-1.5 transition hover:bg-ink/[0.03]', !inMonth && 'bg-ink/[0.02] text-muted/60')}
              onDoubleClick={() => onCreate(d)}
              onClick={(e) => e.target === e.currentTarget && onDay(d)}
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => onDay(d)}
                  className={cn('grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs font-medium', isToday ? 'bg-accent text-white' : 'hover:bg-ink/10')}
                  aria-label={d.toDateString()}
                >
                  {d.getDate()}
                </button>
                <button className="rounded p-0.5 text-muted opacity-0 hover:bg-ink/10 group-hover:opacity-100" aria-label={`Add event on ${d.toDateString()}`} onClick={() => onCreate(d)}>
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              {dayItems.slice(0, 3).map((it) => (
                <ItemChip key={it.key} it={it} h24={h24} onClick={() => onItem(it)} />
              ))}
              {dayItems.length > 3 && <button className="text-left text-[11px] text-muted hover:text-ink" onClick={() => onDay(d)}>+{dayItems.length - 3} more</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ItemChip({ it, h24, onClick }: { it: CalItem; h24: boolean; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn('flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight', it.kind === 'task' && 'opacity-80')}
      style={{ background: it.allDay ? it.color + '2e' : 'transparent', color: 'inherit' }}
      title={it.title}
    >
      {it.kind === 'task' ? <CheckSquare className="h-3 w-3 shrink-0" style={{ color: it.color }} /> : !it.allDay && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: it.color }} />}
      {!it.allDay && <span className="shrink-0 text-muted">{fmtTime(it.start, h24)}</span>}
      <span className="truncate">{it.title}</span>
    </button>
  );
}

// ---------------------------------------------------------------- Week / Day time grid
function TimeGrid({ days, items, h24, onSlot, onItem }: { days: Date[]; items: CalItem[]; h24: boolean; onSlot: (d: Date) => void; onItem: (i: CalItem) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = HOUR_PX * 7; }, []);
  const cols = `3.5rem repeat(${days.length}, minmax(0, 1fr))`;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-line/10">
      {/* header + all-day */}
      <div className="grid border-b border-line/10" style={{ gridTemplateColumns: cols }}>
        <div className="p-1 text-[10px] text-muted">all-day</div>
        {days.map((d) => {
          const allDay = itemsOnDay(items, d).filter((i) => i.allDay);
          return (
            <div key={d.toISOString()} className="min-w-0 border-l border-line/10 p-1">
              <div className={cn('mb-1 text-center text-xs font-medium', sameDay(d, now) ? 'text-accent' : 'text-muted')}>
                {DAY_NAMES[d.getDay()]} <span className={cn('ml-0.5 inline-grid h-6 min-w-6 place-items-center rounded-full px-1', sameDay(d, now) && 'bg-accent text-white')}>{d.getDate()}</span>
              </div>
              <div className="space-y-0.5">{allDay.map((it) => <ItemChip key={it.key} it={it} h24={h24} onClick={() => onItem(it)} />)}</div>
            </div>
          );
        })}
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto scroll-thin">
        <div className="relative grid" style={{ gridTemplateColumns: cols, height: HOUR_PX * 24 }}>
          <div className="relative">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="absolute right-1 -translate-y-1/2 text-[10px] text-muted" style={{ top: h * HOUR_PX }}>
                {h === 0 ? '' : fmtTime(new Date(2000, 0, 1, h), h24).replace(':00', '')}
              </div>
            ))}
          </div>
          {days.map((d) => {
            const timed = layoutColumns(itemsOnDay(items, d).filter((i) => !i.allDay));
            const dayStart = startOfDay(d).getTime();
            return (
              <div
                key={d.toISOString()}
                className="relative border-l border-line/10"
                onClick={(e) => {
                  if (e.target !== e.currentTarget) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const mins = Math.floor(((e.clientY - rect.top) / HOUR_PX) * 2) * 30;
                  const slot = new Date(dayStart); slot.setMinutes(mins);
                  onSlot(slot);
                }}
              >
                {Array.from({ length: 24 }, (_, h) => <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-line/[0.07]" style={{ top: h * HOUR_PX }} />)}
                {sameDay(d, now) && (
                  <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-red-500" style={{ top: ((now.getTime() - dayStart) / 3600000) * HOUR_PX }}>
                    <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-red-500" />
                  </div>
                )}
                {timed.map(({ it, col, cols: n }) => {
                  const s = Math.max(it.start.getTime(), dayStart);
                  const e = Math.min(it.end.getTime(), dayStart + 86400000);
                  const top = ((s - dayStart) / 3600000) * HOUR_PX;
                  const height = Math.max(20, ((e - s) / 3600000) * HOUR_PX - 2);
                  return (
                    <button
                      key={it.key}
                      onClick={() => onItem(it)}
                      className="absolute overflow-hidden rounded-lg px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm transition hover:brightness-110"
                      style={{ top, height, left: `calc(${(col / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)`, background: it.color + (it.kind === 'task' ? '55' : 'dd'), color: '#fff' }}
                      title={it.title}
                    >
                      <span className="block truncate font-semibold">{it.kind === 'task' && '☐ '}{it.title}</span>
                      {height > 30 && <span className="block truncate opacity-90">{fmtTime(it.start, h24)} – {fmtTime(it.end, h24)}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Greedy column assignment for overlapping timed items. */
function layoutColumns(items: CalItem[]) {
  const out: { it: CalItem; col: number; cols: number }[] = [];
  let cluster: { it: CalItem; col: number }[] = [];
  let clusterEnd = 0;
  const flush = () => {
    const n = Math.max(1, ...cluster.map((c) => c.col + 1));
    cluster.forEach((c) => out.push({ ...c, cols: n }));
    cluster = [];
  };
  for (const it of [...items].sort((a, b) => a.start.getTime() - b.start.getTime())) {
    if (cluster.length && it.start.getTime() >= clusterEnd) flush();
    const used = new Set(cluster.filter((c) => c.it.end.getTime() > it.start.getTime()).map((c) => c.col));
    let col = 0; while (used.has(col)) col++;
    cluster.push({ it, col });
    clusterEnd = Math.max(clusterEnd, it.end.getTime());
  }
  flush();
  return out;
}

// ---------------------------------------------------------------- Upcoming
function Upcoming({ items, h24, onItem, onCreate }: { items: CalItem[]; h24: boolean; onItem: (i: CalItem) => void; onCreate: () => void }) {
  const start = startOfDay(new Date());
  const days = Array.from({ length: 30 }, (_, i) => addDays(start, i)).map((d) => ({ d, items: itemsOnDay(items, d) })).filter((x) => x.items.length);
  if (!days.length) return <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="Nothing in the next 30 days" description="Enjoy the space — or plan something." action={<Button size="sm" variant="primary" onClick={onCreate}><Plus className="h-3.5 w-3.5" /> New event</Button>} />;
  return (
    <div className="h-full space-y-4 overflow-y-auto pr-1 scroll-thin">
      {days.map(({ d, items: its }) => (
        <section key={d.toISOString()}>
          <h4 className="section-title mb-1.5">{sameDay(d, new Date()) ? 'Today' : sameDay(d, addDays(new Date(), 1)) ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</h4>
          <ul className="space-y-1">
            {its.map((it) => (
              <li key={it.key}>
                <button onClick={() => onItem(it)} className="card flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-ink/5">
                  <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: it.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{it.kind === 'task' && <CheckSquare className="mr-1 inline h-3.5 w-3.5 text-muted" />}{it.title}</p>
                    <p className="text-xs text-muted">{it.allDay ? 'All day' : `${fmtTime(it.start, h24)} – ${fmtTime(it.end, h24)}`}{it.event?.location ? ` · ${it.event.location}` : ''}</p>
                  </div>
                  {it.readOnly && it.kind === 'event' && <span className="text-[10px] uppercase text-muted">{it.event?.source}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Event modal
const REMINDERS: { value: string; label: string }[] = [
  { value: '', label: 'No reminder' }, { value: '0', label: 'At start time' }, { value: '5', label: '5 minutes before' },
  { value: '10', label: '10 minutes before' }, { value: '15', label: '15 minutes before' }, { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' }, { value: '1440', label: '1 day before' },
];

function EventModal({ draft, onClose }: { draft: Draft | null; onClose: () => void }) {
  const [d, setD] = useState<Draft | null>(draft);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setD(draft); setErr(null); }, [draft]);
  if (!d) return <Modal open={false} onClose={onClose}>{null}</Modal>;
  const up = (p: Partial<Draft>) => setD({ ...d, ...p });

  const save = () => {
    if (!d.title.trim()) { setErr('Give your event a title'); return; }
    const start = d.allDay ? combine(d.startDate, '00:00') : combine(d.startDate, d.startTime);
    const end = d.allDay ? combine(toISODate(addDays(new Date(combine(d.endDate || d.startDate, '00:00')), 1)), '00:00') : combine(d.endDate || d.startDate, d.endTime);
    if (new Date(end) <= new Date(start)) { setErr('End must be after start'); return; }
    const data = { title: d.title.trim(), description: d.description, location: d.location.trim() || undefined, allDay: d.allDay, start, end, color: d.color, reminderMin: d.reminderMin };
    const api = useCalendar.getState();
    if (d.id) api.updateEvent(d.id, data);
    else api.addEvent(data);
    toast(d.id ? 'Event updated' : 'Event created', 'success');
    onClose();
  };
  const remove = async () => {
    if (!d.id) return;
    const ok = await confirmDialog({ title: 'Delete event?', message: `“${d.title}” will be removed.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    const api = useCalendar.getState();
    const ev = api.events.find((e) => e.id === d.id);
    api.deleteEvent(d.id);
    onClose();
    if (ev) toast('Event deleted', 'info', { label: 'Undo', run: () => useCalendar.getState().restoreEvent(ev) });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={d.id ? 'Edit event' : 'New event'}
      footer={
        <>
          {d.id && <Button variant="ghost" className="mr-auto text-red-500" onClick={remove}><Trash2 className="h-4 w-4" /> Delete</Button>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>Save</Button>
        </>
      }
    >
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Title" error={err}><Input value={d.title} onChange={(e) => { up({ title: e.target.value }); setErr(null); }} placeholder="Add a title" maxLength={200} /></Field>
        <Toggle checked={d.allDay} onChange={(v) => up({ allDay: v })} label="All day" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts">
            <div className="flex gap-2">
              <Input type="date" value={d.startDate} onChange={(e) => up({ startDate: e.target.value, endDate: d.endDate < e.target.value ? e.target.value : d.endDate })} required />
              {!d.allDay && <Input type="time" value={d.startTime} onChange={(e) => up({ startTime: e.target.value })} className="w-28" />}
            </div>
          </Field>
          <Field label="Ends">
            <div className="flex gap-2">
              <Input type="date" value={d.endDate} min={d.startDate} onChange={(e) => up({ endDate: e.target.value })} />
              {!d.allDay && <Input type="time" value={d.endTime} onChange={(e) => up({ endTime: e.target.value })} className="w-28" />}
            </div>
          </Field>
        </div>
        <Field label="Location"><Input value={d.location} onChange={(e) => up({ location: e.target.value })} placeholder="Optional" /></Field>
        <Field label="Description"><Textarea value={d.description} onChange={(e) => up({ description: e.target.value })} placeholder="Optional" rows={3} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Reminder">
            <Select value={d.reminderMin == null ? '' : String(d.reminderMin)} onChange={(e) => up({ reminderMin: e.target.value === '' ? null : Number(e.target.value) })}>
              {REMINDERS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
          </Field>
          <Field label="Colour"><ColorPicker value={d.color} onChange={(c) => up({ color: c })} colors={PALETTE.slice(0, 8)} /></Field>
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function ItemDetails({ item, onClose, h24 }: { item: CalItem | null; onClose: () => void; h24: boolean }) {
  const openPanel = useUI((s) => s.openPanel);
  if (!item) return null;
  const when = item.allDay
    ? item.start.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
    : `${item.start.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} · ${fmtTime(item.start, h24)} – ${fmtTime(item.end, h24)}`;
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={<span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: item.color }} />{item.title}</span>}
      footer={item.kind === 'task' ? <Button variant="primary" onClick={() => { onClose(); openPanel('tasks', { taskId: item.task?.id }); }}>Open in Tasks</Button> : <Button onClick={onClose}>Close</Button>}
    >
      <div className="space-y-2 text-sm">
        <p className="flex items-center gap-2 text-muted"><Clock className="h-4 w-4" /> {item.kind === 'task' ? `Due ${when}` : when}</p>
        {item.event?.location && <p className="flex items-center gap-2 text-muted"><MapPin className="h-4 w-4" /> {item.event.location}</p>}
        {item.event?.reminderMin != null && <p className="flex items-center gap-2 text-muted"><Bell className="h-4 w-4" /> {item.event.reminderMin} min before</p>}
        {item.event?.description && <p className="whitespace-pre-wrap">{item.event.description}</p>}
        {item.task?.description && <p className="whitespace-pre-wrap">{item.task.description}</p>}
        {item.kind === 'event' && item.readOnly && (
          <p className="flex items-center gap-2 text-xs text-muted"><Lock className="h-3.5 w-3.5" /> Synced from {item.event?.source === 'google' ? 'Google Calendar' : 'Outlook'} · edit it there</p>
        )}
      </div>
    </Modal>
  );
}
