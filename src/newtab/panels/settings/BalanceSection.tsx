import { Input, Toggle } from '@/components/ui';
import { useS, useSettings, WIDGET_META } from '@/stores/settings';
import { isDowntime } from '@/lib/balance';
import type { WidgetId } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DayPicker, Group, Note, NumberInput, Row, Section } from './common';

export function BalanceSection() {
  const s = useS();
  const b = s.balance;
  const set = (patch: Partial<typeof b>) => useSettings.getState().updateNested('balance', patch);
  const setWork = (patch: Partial<typeof b.work>) => set({ work: { ...b.work, ...patch } });
  const toggleHidden = (id: WidgetId) =>
    set({ hiddenInDowntime: b.hiddenInDowntime.includes(id) ? b.hiddenInDowntime.filter((x) => x !== id) : [...b.hiddenInDowntime, id] });
  const downtime = isDowntime(s);

  return (
    <Section title="Balance Mode" description="Separate work time from personal time. Outside working hours, Momento quietly hides work widgets.">
      <Group>
        <Toggle checked={b.enabled} onChange={(enabled) => set({ enabled })} label="Enable Balance Mode" description="Activates automatically on your schedule" />
        {b.enabled && <Note tone={downtime ? 'info' : 'success'}>Right now: <b>{downtime ? 'personal time' : 'working hours'}</b>.</Note>}
      </Group>

      <div className={cn('space-y-6', !b.enabled && 'pointer-events-none opacity-50')}>
        <Group title="Working hours">
          <Row label="Work days"><DayPicker value={b.work.days} onChange={(days) => setWork({ days })} /></Row>
          <Row label="From">
            <input type="time" className="input w-32" value={b.work.start} onChange={(e) => e.target.value && setWork({ start: e.target.value })} />
          </Row>
          <Row label="Until">
            <input type="time" className="input w-32" value={b.work.end} onChange={(e) => e.target.value && setWork({ end: e.target.value })} />
          </Row>
          <p className="text-xs text-muted">Everything outside these hours is personal time. Overnight ranges (e.g. 22:00–06:00) are supported.</p>
        </Group>

        <Group title="During personal time" description="Hide these widgets">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(WIDGET_META) as WidgetId[]).map((id) => {
              const on = b.hiddenInDowntime.includes(id);
              return (
                <button key={id} onClick={() => toggleHidden(id)} aria-pressed={on}
                  className={cn('chip py-1 transition', on ? 'bg-accent text-white' : 'bg-ink/5 text-muted hover:bg-ink/10')}>
                  {WIDGET_META[id].label}
                </button>
              );
            })}
          </div>
          <Toggle checked={b.dimInDowntime} onChange={(dimInDowntime) => set({ dimInDowntime })} label="Soften the dashboard" />
          <label className="block">
            <span className="label">Downtime message</span>
            <Input value={b.downtimeMessage} maxLength={120} onChange={(e) => set({ downtimeMessage: e.target.value })} />
          </label>
        </Group>

        <Group title="Break reminders">
          <Toggle checked={b.breakReminders} onChange={(breakReminders) => set({ breakReminders })} label="Remind me to take breaks" description="Only during working hours, and never in the middle of a focus session" />
          <Row label="Every"><NumberInput value={b.breakEveryMin} min={15} max={240} step={5} onChange={(breakEveryMin) => set({ breakEveryMin })} suffix="min" /></Row>
          <p className="text-xs text-muted">You'll also get a gentle notification when your work day ends. Requires "Balance Mode breaks" in Notifications.</p>
        </Group>
      </div>
    </Section>
  );
}
