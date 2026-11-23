import { Select, Toggle } from '@/components/ui';
import { useFocus } from '@/stores/focus';
import { useTasks } from '@/stores/tasks';
import { useS, useSettings } from '@/stores/settings';
import type { AmbientSound, FocusSettings } from '@/lib/types';
import { Group, NumberInput, Row, Section } from './common';

const SOUNDS: { value: AmbientSound; label: string }[] = [
  { value: 'none', label: 'None' }, { value: 'rain', label: 'Rain' }, { value: 'ocean', label: 'Ocean waves' },
  { value: 'forest', label: 'Forest' }, { value: 'fire', label: 'Fireplace' }, { value: 'cafe', label: 'Café' },
  { value: 'white', label: 'White noise' }, { value: 'brown', label: 'Brown noise' },
];

export function FocusSection() {
  const fs = useFocus((s) => s.settings) as FocusSettings;
  const set = (patch: Partial<FocusSettings>) => useFocus.getState().updateSettings(patch);

  return (
    <Section title="Focus" description="Pomodoro intervals, sounds and blocking. Defaults: 25 / 5 / 15 minutes.">
      <Group title="Timer">
        <Toggle checked={fs.pomodoro} onChange={(pomodoro) => set({ pomodoro })} label="Pomodoro cycles" description="Alternate work sessions with short and long breaks" />
        <Row label="Work session"><NumberInput value={fs.workMin} min={1} max={240} onChange={(workMin) => set({ workMin })} suffix="min" /></Row>
        <Row label="Short break"><NumberInput value={fs.shortBreakMin} min={1} max={60} onChange={(shortBreakMin) => set({ shortBreakMin })} suffix="min" /></Row>
        <Row label="Long break"><NumberInput value={fs.longBreakMin} min={1} max={120} onChange={(longBreakMin) => set({ longBreakMin })} suffix="min" /></Row>
        <Row label="Long break every"><NumberInput value={fs.longBreakEvery} min={2} max={12} onChange={(longBreakEvery) => set({ longBreakEvery })} suffix="sessions" /></Row>
        <Toggle checked={fs.autoStartBreaks} onChange={(autoStartBreaks) => set({ autoStartBreaks })} label="Auto-start breaks" />
        <Toggle checked={fs.autoStartWork} onChange={(autoStartWork) => set({ autoStartWork })} label="Auto-start next work session" />
      </Group>
      <Group title="Ambience & alerts">
        <Row label="Ambient sound" description="Plays while Focus Mode is open">
          <Select value={fs.sound} onChange={(e) => set({ sound: e.target.value as AmbientSound })} className="w-40">
            {SOUNDS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </Row>
        <Row label="Volume">
          <input type="range" min={0} max={1} step={0.05} value={fs.volume} onChange={(e) => set({ volume: Number(e.target.value) })} className="w-40" aria-label="Ambient volume" />
        </Row>
        <Toggle checked={fs.notify} onChange={(notify) => set({ notify })} label="Notify when a session ends" />
        <Toggle checked={fs.blockDuringFocus} onChange={(blockDuringFocus) => set({ blockDuringFocus })} label="Block distracting sites during focus" description="Uses your Site blocker list" />
      </Group>
    </Section>
  );
}

export function TasksSection() {
  const s = useS();
  const lists = useTasks((t) => t.lists);
  const set = (patch: Partial<typeof s.tasks>) => useSettings.getState().updateNested('tasks', patch);
  return (
    <Section title="Tasks" description="Defaults for creating and showing tasks.">
      <Group>
        <Row label="Default list" description="Where quick-added tasks go">
          <Select value={s.tasks.defaultListId ?? ''} onChange={(e) => set({ defaultListId: e.target.value || null })} className="w-44">
            <option value="">First list</option>
            {[...lists].sort((a, b) => a.order - b.order).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
        </Row>
        <Toggle checked={s.tasks.showCompletedOnDashboard} onChange={(showCompletedOnDashboard) => set({ showCompletedOnDashboard })} label="Show completed tasks on the dashboard" />
        <Toggle checked={s.tasks.confirmDelete} onChange={(confirmDelete) => set({ confirmDelete })} label="Confirm before deleting tasks" />
      </Group>
    </Section>
  );
}
