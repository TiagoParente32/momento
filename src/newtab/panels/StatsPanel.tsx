import { useMemo, useState, type ReactNode } from 'react';
import { BarChart3, Flame, Timer, CheckCircle2, Target, Plus, Minus, Trash2, Pencil, TrendingUp } from 'lucide-react';
import { PanelFrame } from '@/components/PanelFrame';
import { Button, ColorPicker, EmptyState, Field, IconButton, Input, Modal, Segmented, confirmDialog, toast } from '@/components/ui';
import { BarChart, Heatmap, LineChart, ProgressBar, Sparkline } from '@/components/charts';
import { useFocus } from '@/stores/focus';
import { useTasks } from '@/stores/tasks';
import { useDaily } from '@/stores/daily';
import { useMetrics, METRIC_TEMPLATES, metricTotal } from '@/stores/metrics';
import { useS } from '@/stores/settings';
import { addDays, cn, formatMinutes, startOfDay, toISODate, todayISO, DAY_NAMES } from '@/lib/utils';
import type { CustomMetric, FocusSession, PersonalGoal, Task } from '@/lib/types';

type Range = 'day' | 'week' | 'month';

const dayKey = (iso: string) => toISODate(new Date(iso));

export function focusByDay(sessions: FocusSession[]) {
  const map: Record<string, number> = {};
  for (const s of sessions) if (s.phase === 'work') map[dayKey(s.startedAt)] = (map[dayKey(s.startedAt)] ?? 0) + s.minutes;
  return map;
}

export function tasksDoneByDay(tasks: Task[]) {
  const map: Record<string, number> = {};
  for (const t of tasks) if (t.done && t.completedAt) map[dayKey(t.completedAt)] = (map[dayKey(t.completedAt)] ?? 0) + 1;
  return map;
}

function streak(active: (d: string) => boolean) {
  let n = 0;
  let d = new Date();
  if (!active(toISODate(d))) d = addDays(d, -1); // today not done yet doesn't break the streak
  while (active(toISODate(d))) { n++; d = addDays(d, -1); }
  return n;
}

export default function StatsPanel() {
  const sessions = useFocus((s) => s.sessions);
  const { tasks, lists } = useTasks();
  const goals = useDaily((s) => s.goals);
  const settings = useS();
  const [range, setRange] = useState<Range>('week');

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const nDays = range === 'day' ? 1 : range === 'week' ? 7 : 30;
    const days = Array.from({ length: nDays }, (_, i) => addDays(today, i - nDays + 1));
    const dayISOs = days.map(toISODate);
    const inRange = (iso: string) => dayISOs.includes(dayKey(iso));

    const work = sessions.filter((s) => s.phase === 'work' && inRange(s.startedAt));
    const focusMin = work.reduce((a, s) => a + s.minutes, 0);
    const completedSessions = work.filter((s) => s.completed).length;
    const done = tasks.filter((t) => t.done && t.completedAt && inRange(t.completedAt));
    const created = tasks.filter((t) => inRange(t.createdAt));
    const dueInRange = tasks.filter((t) => t.dueDate && dayISOs.includes(t.dueDate));
    const completionRate = dueInRange.length ? dueInRange.filter((t) => t.done).length / dueInRange.length : created.length ? created.filter((t) => t.done).length / created.length : 0;
    const goalDays = goals.filter((g) => dayISOs.includes(g.date));

    const fbd = focusByDay(sessions);
    const tbd = tasksDoneByDay(tasks);

    let focusSeries, taskSeries;
    if (range === 'day') {
      const hours = Array.from({ length: 24 }, (_, h) => h);
      const fh = hours.map(() => 0), th = hours.map(() => 0);
      work.forEach((s) => (fh[new Date(s.startedAt).getHours()] += s.minutes));
      done.forEach((t) => (th[new Date(t.completedAt!).getHours()] += 1));
      const lbl = (h: number) => (settings.clock24h ? `${h}` : `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`);
      focusSeries = hours.map((h) => ({ label: lbl(h), value: fh[h], title: `${lbl(h)}:00` }));
      taskSeries = hours.map((h) => ({ label: lbl(h), value: th[h], title: `${lbl(h)}:00` }));
    } else {
      const lbl = (d: Date) => (range === 'week' ? DAY_NAMES[d.getDay()] : `${d.getDate()}`);
      const title = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      focusSeries = days.map((d) => ({ label: lbl(d), value: fbd[toISODate(d)] ?? 0, title: title(d) }));
      taskSeries = days.map((d) => ({ label: lbl(d), value: tbd[toISODate(d)] ?? 0, title: title(d) }));
    }

    const byList = lists.map((l) => ({ list: l, count: done.filter((t) => t.listId === l.id).length, open: tasks.filter((t) => t.listId === l.id && !t.done).length }));

    // 16-week heatmap
    const hmDays = Array.from({ length: 16 * 7 }, (_, i) => addDays(today, i - 16 * 7 + 1)).map((d) => ({
      date: toISODate(d),
      label: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    }));

    return {
      focusMin, completedSessions, done: done.length, completionRate, goalDays, focusSeries, taskSeries, byList, hmDays, fbd,
      focusStreak: streak((d) => (fbd[d] ?? 0) > 0),
      taskStreak: streak((d) => (tbd[d] ?? 0) > 0),
      allTimeFocus: sessions.filter((s) => s.phase === 'work').reduce((a, s) => a + s.minutes, 0),
      allTimeSessions: sessions.filter((s) => s.phase === 'work' && s.completed).length,
    };
  }, [sessions, tasks, lists, goals, range, settings.clock24h]);

  const goalsMet = stats.goalDays.filter((g) => g.done).length;

  return (
    <PanelFrame
      title="Productivity"
      icon={<BarChart3 className="h-4 w-4" />}
      actions={<Segmented<Range> value={range} onChange={setRange} options={[{ value: 'day', label: 'Today' }, { value: 'week', label: '7 days' }, { value: 'month', label: '30 days' }]} />}
    >
      <div className="space-y-6 p-5">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={<Timer className="h-4 w-4" />} label="Focus time" value={formatMinutes(stats.focusMin)} sub={`${formatMinutes(stats.allTimeFocus)} all time`} />
          <Kpi icon={<Target className="h-4 w-4" />} label="Sessions completed" value={String(stats.completedSessions)} sub={`${stats.allTimeSessions} all time`} />
          <Kpi icon={<CheckCircle2 className="h-4 w-4" />} label="Tasks completed" value={String(stats.done)} sub={`${Math.round(stats.completionRate * 100)}% completion rate`} />
          <Kpi icon={<Flame className="h-4 w-4" />} label="Focus streak" value={`${stats.focusStreak} ${stats.focusStreak === 1 ? 'day' : 'days'}`} sub={`Task streak: ${stats.taskStreak}d`} />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="card p-4">
            <p className="text-sm font-semibold">Focus minutes</p>
            <p className="mb-3 text-xs text-muted">{range === 'day' ? 'By hour, today' : `Per day, last ${range === 'week' ? 7 : 30} days`}</p>
            <BarChart data={stats.focusSeries} ariaLabel="Focus minutes chart" format={(v) => (v >= 60 ? formatMinutes(v) : `${Math.round(v)}m`)} />
          </div>
          <div className="card p-4">
            <p className="text-sm font-semibold">Tasks completed</p>
            <p className="mb-3 text-xs text-muted">{range === 'day' ? 'By hour, today' : `Per day, last ${range === 'week' ? 7 : 30} days`}</p>
            <LineChart data={stats.taskSeries} ariaLabel="Tasks completed chart" format={(v) => String(Math.round(v * 10) / 10)} />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[auto_1fr]">
          <div className="card overflow-x-auto p-4">
            <p className="mb-3 text-sm font-semibold">Focus activity · last 16 weeks</p>
            <Heatmap days={stats.hmDays} values={stats.fbd} format={(v) => (v ? formatMinutes(v) : 'no focus')} ariaLabel="Focus heatmap, last 16 weeks" weekStartsOn={settings.weekStartsOn} />
          </div>
          <div className="card space-y-3 p-4">
            <p className="text-sm font-semibold">By list</p>
            {stats.byList.map(({ list, count, open }) => {
              const max = Math.max(1, ...stats.byList.map((x) => x.count));
              return (
                <div key={list.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: list.color }} />{list.name}</span>
                    <span className="text-muted">{count} done · {open} open</span>
                  </div>
                  <ProgressBar value={count / max} color={list.color} label={`${list.name}: ${count} completed`} />
                </div>
              );
            })}
            <div className="border-t border-line/10 pt-3 text-xs text-muted">
              Daily goal met on <span className="font-semibold text-ink">{goalsMet}</span> of {stats.goalDays.length} {stats.goalDays.length === 1 ? 'day' : 'days'} with a goal set.
            </div>
          </div>
        </section>

        <MetricsSection />
        <GoalsSection />
      </div>
    </PanelFrame>
  );
}

function Kpi({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted"><span className="text-accent">{icon}</span>{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

// ---------------- Custom metrics ----------------
type MetricForm = { id: string | null; name: string; unit: string; color: string; icon: string; dailyGoal: string };
const blankMetric = (): MetricForm => ({ id: null, name: '', unit: '', color: '#6366f1', icon: '📈', dailyGoal: '' });

function MetricsSection() {
  const { metrics, addMetric, updateMetric, removeMetric, logValue, increment } = useMetrics();
  const [form, setForm] = useState<MetricForm | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const today = todayISO();
  const last14 = Array.from({ length: 14 }, (_, i) => toISODate(addDays(new Date(), i - 13)));

  const save = () => {
    if (!form) return;
    if (!form.name.trim()) { setErr('Name is required'); return; }
    const goal = form.dailyGoal.trim() ? Number(form.dailyGoal) : null;
    if (goal != null && (!Number.isFinite(goal) || goal <= 0)) { setErr('Daily goal must be a positive number'); return; }
    const data = { name: form.name.trim(), unit: form.unit.trim(), color: form.color, icon: form.icon || '📈', dailyGoal: goal };
    if (form.id) updateMetric(form.id, data); else addMetric(data);
    setForm(null);
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <p className="section-title">Custom metrics</p>
        <Button size="sm" onClick={() => { setErr(null); setForm(blankMetric()); }}><Plus className="h-4 w-4" /> Metric</Button>
      </div>
      {metrics.length === 0 ? (
        <div className="card p-4">
          <p className="text-sm text-muted">Track anything that matters to you. Start from a template:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {METRIC_TEMPLATES.map((t) => (
              <Button key={t.name} size="sm" onClick={() => { addMetric(t); toast(`Tracking ${t.name}`, 'success'); }}>{t.icon} {t.name}</Button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {metrics.map((m) => <MetricCard key={m.id} m={m} today={today} last14={last14} onEdit={() => { setErr(null); setForm({ id: m.id, name: m.name, unit: m.unit, color: m.color, icon: m.icon, dailyGoal: m.dailyGoal ? String(m.dailyGoal) : '' }); }} onDelete={async () => { if (await confirmDialog({ title: `Delete “${m.name}”?`, message: 'All logged values will be removed.', danger: true, confirmLabel: 'Delete' })) removeMetric(m.id); }} onLog={(v) => logValue(m.id, today, v)} onInc={(d) => increment(m.id, d)} />)}
        </div>
      )}
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit metric' : 'New metric'} footer={<><Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
        {form && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <div className="grid grid-cols-[4rem_1fr] gap-3">
              <Field label="Icon"><Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value.slice(0, 4) })} aria-label="Emoji icon" /></Field>
              <Field label="Name" error={err}><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Pages read" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Unit"><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pages" /></Field>
              <Field label="Daily goal" hint="Optional"><Input type="number" min={0} step="any" value={form.dailyGoal} onChange={(e) => setForm({ ...form, dailyGoal: e.target.value })} /></Field>
            </div>
            <Field label="Colour"><ColorPicker value={form.color} onChange={(color) => setForm({ ...form, color })} /></Field>
            <button type="submit" hidden />
          </form>
        )}
      </Modal>
    </section>
  );
}

function MetricCard({ m, today, last14, onEdit, onDelete, onLog, onInc }: { m: CustomMetric; today: string; last14: string[]; onEdit: () => void; onDelete: () => void; onLog: (v: number) => void; onInc: (d: number) => void }) {
  const v = m.entries[today] ?? 0;
  const [draft, setDraft] = useState('');
  const week = metricTotal(m, last14.slice(-7));
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2">
        <span className="text-xl" aria-hidden>{m.icon}</span>
        <p className="flex-1 truncate font-medium">{m.name}</p>
        <IconButton label={`Edit ${m.name}`} onClick={onEdit}><Pencil className="h-4 w-4" /></IconButton>
        <IconButton label={`Delete ${m.name}`} onClick={onDelete}><Trash2 className="h-4 w-4" /></IconButton>
      </div>
      <div className="mt-2 flex items-end gap-3">
        <div className="flex-1">
          <p className="text-2xl font-semibold tabular-nums">{v}<span className="ml-1 text-sm font-normal text-muted">{m.unit} today</span></p>
          <p className="text-xs text-muted">{Math.round(week * 100) / 100} {m.unit} this week · {Math.round(metricTotal(m) * 100) / 100} total</p>
        </div>
        <Sparkline values={last14.map((d) => m.entries[d] ?? 0)} color={m.color} />
      </div>
      {m.dailyGoal ? <div className="mt-2"><ProgressBar value={v / m.dailyGoal} color={m.color} label={`${m.name} daily goal progress`} /><p className="mt-1 text-[11px] text-muted">{v} / {m.dailyGoal} daily goal</p></div> : null}
      <div className="mt-3 flex items-center gap-2">
        <IconButton label={`Decrease ${m.name}`} onClick={() => onInc(-1)} disabled={v <= 0}><Minus className="h-4 w-4" /></IconButton>
        <IconButton label={`Increase ${m.name}`} onClick={() => onInc(1)}><Plus className="h-4 w-4" /></IconButton>
        <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); const n = Number(draft); if (draft.trim() && Number.isFinite(n) && n >= 0) { onLog(n); setDraft(''); toast(`Logged ${n} ${m.unit}`, 'success'); } }}>
          <Input type="number" min={0} step="any" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Set today’s value" aria-label={`Set today's ${m.name}`} className="h-8 py-1" />
          <Button size="sm" type="submit">Log</Button>
        </form>
      </div>
    </div>
  );
}

// ---------------- Personal goals ----------------
type GoalForm = { id: string | null; title: string; target: string; progress: string; unit: string; deadline: string; color: string };

function GoalsSection() {
  const { goals, addGoal, updateGoal, removeGoal, bumpGoal } = useMetrics();
  const [form, setForm] = useState<GoalForm | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const save = () => {
    if (!form) return;
    const target = Number(form.target), progress = Number(form.progress || 0);
    if (!form.title.trim()) { setErr('Title is required'); return; }
    if (!Number.isFinite(target) || target <= 0) { setErr('Target must be a positive number'); return; }
    const data: Omit<PersonalGoal, 'id'> = { title: form.title.trim(), target, progress: Math.max(0, progress || 0), unit: form.unit.trim(), deadline: form.deadline || null, color: form.color };
    if (form.id) updateGoal(form.id, data); else addGoal(data);
    setForm(null);
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <p className="section-title">Personal goals</p>
        <Button size="sm" onClick={() => { setErr(null); setForm({ id: null, title: '', target: '', progress: '0', unit: '', deadline: '', color: '#22c55e' }); }}><Plus className="h-4 w-4" /> Goal</Button>
      </div>
      {goals.length === 0 ? (
        <EmptyState icon={<TrendingUp className="h-5 w-5" />} title="No goals yet" description="Set a measurable goal like “Read 24 books this year” and track progress." />
      ) : (
        <ul className="space-y-2">
          {goals.map((g) => {
            const pct = g.progress / g.target;
            const done = pct >= 1;
            return (
              <li key={g.id} className="card p-4">
                <div className="flex items-center gap-2">
                  <p className={cn('flex-1 truncate font-medium', done && 'text-emerald-600 dark:text-emerald-400')}>{done && '✓ '}{g.title}</p>
                  <span className="text-xs text-muted tabular-nums">{g.progress} / {g.target} {g.unit}</span>
                  <IconButton label="Decrease progress" onClick={() => bumpGoal(g.id, -1)}><Minus className="h-4 w-4" /></IconButton>
                  <IconButton label="Increase progress" onClick={() => { bumpGoal(g.id, 1); if (g.progress + 1 >= g.target && !done) toast(`Goal reached: ${g.title} 🎉`, 'success'); }}><Plus className="h-4 w-4" /></IconButton>
                  <IconButton label="Edit goal" onClick={() => { setErr(null); setForm({ id: g.id, title: g.title, target: String(g.target), progress: String(g.progress), unit: g.unit, deadline: g.deadline ?? '', color: g.color }); }}><Pencil className="h-4 w-4" /></IconButton>
                  <IconButton label="Delete goal" onClick={async () => { if (await confirmDialog({ title: `Delete “${g.title}”?`, danger: true, confirmLabel: 'Delete' })) removeGoal(g.id); }}><Trash2 className="h-4 w-4" /></IconButton>
                </div>
                <div className="mt-2"><ProgressBar value={pct} color={g.color} label={`${g.title} progress`} /></div>
                <p className="mt-1 text-[11px] text-muted">{Math.min(100, Math.round(pct * 100))}%{g.deadline && ` · due ${new Date(g.deadline + 'T00:00').toLocaleDateString()}`}</p>
              </li>
            );
          })}
        </ul>
      )}
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit goal' : 'New goal'} footer={<><Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
        {form && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <Field label="Goal" error={err}><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Read 24 books" /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Target"><Input type="number" min={0} step="any" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} /></Field>
              <Field label="Progress"><Input type="number" min={0} step="any" value={form.progress} onChange={(e) => setForm({ ...form, progress: e.target.value })} /></Field>
              <Field label="Unit"><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="books" /></Field>
            </div>
            <Field label="Deadline" hint="Optional"><Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></Field>
            <Field label="Colour"><ColorPicker value={form.color} onChange={(color) => setForm({ ...form, color })} /></Field>
            <button type="submit" hidden />
          </form>
        )}
      </Modal>
    </section>
  );
}
