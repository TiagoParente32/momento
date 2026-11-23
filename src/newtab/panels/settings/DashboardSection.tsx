import { LayoutGrid, RotateCcw } from 'lucide-react';
import { Button, Select, Toggle, confirmDialog, toast } from '@/components/ui';
import { useS, useSettings, WIDGET_META, ZONES, ZONE_LABEL } from '@/stores/settings';
import { useUI } from '@/stores/ui';
import type { Zone } from '@/lib/types';
import { Group, Note, Section } from './common';

export function DashboardSection() {
  const s = useS();
  const { setWidget, moveWidget, resetLayout } = useSettings.getState();
  const widgets = [...s.widgets].sort((a, b) => ZONES.indexOf(a.zone) - ZONES.indexOf(b.zone) || a.order - b.order);

  return (
    <Section title="Dashboard & widgets" description="Choose what appears on your new tab and where.">
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => { useUI.getState().closePanel(); useUI.getState().setEditLayout(true); }}>
          <LayoutGrid className="h-4 w-4" /> Edit layout on dashboard
        </Button>
        <Button variant="ghost" onClick={async () => {
          if (await confirmDialog({ title: 'Reset layout?', message: 'Restore the default widget positions and visibility.', confirmLabel: 'Reset' })) { resetLayout(); toast('Layout reset', 'success'); }
        }}>
          <RotateCcw className="h-4 w-4" /> Reset layout
        </Button>
      </div>
      <Note>Tip: in edit mode you can drag widgets between zones and hide them. Press the grid icon in the dock to toggle edit mode.</Note>

      <Group title="Widgets">
        <ul className="divide-y divide-line/10">
          {widgets.map((w) => (
            <li key={w.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <Toggle checked={w.visible} onChange={(visible) => setWidget(w.id, { visible })} label={WIDGET_META[w.id].label} description={WIDGET_META[w.id].description} />
              </div>
              <Select value={w.zone} onChange={(e) => moveWidget(w.id, e.target.value as Zone, 999)} className="w-36 py-1.5 text-xs" aria-label={`${WIDGET_META[w.id].label} position`}>
                {ZONES.map((z) => <option key={z} value={z}>{ZONE_LABEL[z]}</option>)}
              </Select>
            </li>
          ))}
        </ul>
      </Group>
    </Section>
  );
}
