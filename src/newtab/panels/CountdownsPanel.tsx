import { useState } from 'react';
import { Hourglass, Plus, Pencil, Trash2, Pin, PinOff, Repeat } from 'lucide-react';
import { PanelFrame } from '@/components/PanelFrame';
import { Button, ColorPicker, EmptyState, Field, IconButton, Input, Modal, Select, Toggle, confirmDialog, toast } from '@/components/ui';
import { useCountdowns, daysUntil, nextOccurrence, formatDays, kindMeta, COUNTDOWN_KINDS, emptyCountdown, type CountdownInput } from '@/stores/countdowns';
import { cn } from '@/lib/utils';
import type { Countdown, CountdownKind } from '@/lib/types';

export default function CountdownsPanel() {
  const { countdowns, addCountdown, updateCountdown, removeCountdown, togglePin } = useCountdowns();
  const [editing, setEditing] = useState<{ id: string | null; data: CountdownInput } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const withDays = countdowns.map((c) => ({ c, d: daysUntil(c) }));
  const upcoming = withDays.filter((x) => x.d >= 0).sort((a, b) => a.d - b.d);
  const past = withDays.filter((x) => x.d < 0).sort((a, b) => b.d - a.d);

  const save = () => {
    if (!editing) return;
    if (!editing.data.title.trim()) { setErr('Give your countdown a title'); return; }
    if (!editing.data.date) { setErr('Pick a date'); return; }
    const data = { ...editing.data, title: editing.data.title.trim() };
    if (editing.id) { updateCountdown(editing.id, data); toast('Countdown updated', 'success'); }
    else { addCountdown(data); toast('Countdown created', 'success'); }
    setEditing(null);
  };
  const remove = async (c: Countdown) => {
    if (await confirmDialog({ title: `Delete “${c.title}”?`, danger: true, confirmLabel: 'Delete' })) removeCountdown(c.id);
  };

  const row = ({ c, d }: { c: Countdown; d: number }) => (
    <li key={c.id} className={cn('card flex items-center gap-4 p-4', d < 0 && 'opacity-70')}>
      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white" style={{ background: c.color }}>
        <span className="text-lg font-bold leading-none tabular-nums">{d < 0 ? Math.abs(d) : d === 0 ? '🎉' : d}</span>
        {d !== 0 && <span className="text-[10px] uppercase tracking-wide opacity-90">{Math.abs(d) === 1 ? 'day' : 'days'}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{kindMeta(c.kind).emoji} {c.title}</p>
        <p className="text-xs text-muted">
          {nextOccurrence(c).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })} · {formatDays(d)}
          {c.repeatYearly && <> · <Repeat className="inline h-3 w-3" /> yearly</>}
        </p>
      </div>
      <IconButton label={c.pinned ? 'Unpin from dashboard' : 'Pin to dashboard'} onClick={() => togglePin(c.id)}>
        {c.pinned ? <Pin className="h-4 w-4 fill-current text-accent" /> : <PinOff className="h-4 w-4" />}
      </IconButton>
      <IconButton label="Edit countdown" onClick={() => { setErr(null); const { id, ...rest } = c; setEditing({ id, data: rest }); }}><Pencil className="h-4 w-4" /></IconButton>
      <IconButton label="Delete countdown" onClick={() => remove(c)}><Trash2 className="h-4 w-4" /></IconButton>
    </li>
  );

  return (
    <PanelFrame
      title="Countdowns"
      icon={<Hourglass className="h-4 w-4" />}
      actions={<Button variant="primary" size="sm" onClick={() => { setErr(null); setEditing({ id: null, data: emptyCountdown() }); }}><Plus className="h-4 w-4" /> New</Button>}
    >
      <div className="space-y-6 p-5">
        {countdowns.length === 0 ? (
          <EmptyState
            icon={<Hourglass className="h-5 w-5" />}
            title="Count down to what matters"
            description="Birthdays, exams, holidays, vacations, deadlines and milestones."
            action={<Button variant="primary" onClick={() => setEditing({ id: null, data: emptyCountdown() })}><Plus className="h-4 w-4" /> Create countdown</Button>}
          />
        ) : (
          <>
            <section>
              <p className="section-title mb-2">Upcoming</p>
              {upcoming.length ? <ul className="space-y-2">{upcoming.map(row)}</ul> : <p className="text-sm text-muted">Nothing upcoming.</p>}
            </section>
            {past.length > 0 && (
              <section>
                <p className="section-title mb-2">Past</p>
                <ul className="space-y-2">{past.map(row)}</ul>
              </section>
            )}
          </>
        )}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit countdown' : 'New countdown'}
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}
      >
        {editing && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <Field label="Title" error={err}>
              <Input value={editing.data.title} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, title: e.target.value } })} placeholder="Summer vacation" maxLength={60} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <Input type="date" value={editing.data.date} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, date: e.target.value } })} required />
              </Field>
              <Field label="Type">
                <Select
                  value={editing.data.kind}
                  onChange={(e) => {
                    const kind = e.target.value as CountdownKind;
                    setEditing({ ...editing, data: { ...editing.data, kind, repeatYearly: kind === 'birthday' ? true : editing.data.repeatYearly } });
                  }}
                >
                  {COUNTDOWN_KINDS.map((k) => <option key={k.value} value={k.value}>{k.emoji} {k.label}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Colour">
              <ColorPicker value={editing.data.color} onChange={(color) => setEditing({ ...editing, data: { ...editing.data, color } })} />
            </Field>
            <Toggle label="Repeat every year" description="Great for birthdays and anniversaries" checked={editing.data.repeatYearly} onChange={(v) => setEditing({ ...editing, data: { ...editing.data, repeatYearly: v } })} />
            <Toggle label="Show on dashboard" checked={editing.data.pinned} onChange={(v) => setEditing({ ...editing, data: { ...editing.data, pinned: v } })} />
            <button type="submit" hidden />
          </form>
        )}
      </Modal>
    </PanelFrame>
  );
}
