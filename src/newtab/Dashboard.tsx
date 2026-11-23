import { Suspense, useEffect, useState, type DragEvent } from 'react';
import {
  CheckSquare, Timer, StickyNote, Layers, CalendarDays, BarChart3, Hourglass, Quote, Sparkles, Settings2,
  LayoutGrid, Check, EyeOff, GripVertical, ShieldBan, Globe2, Camera, Moon, RefreshCw,
} from 'lucide-react';
import { useSettings, useS, WIDGET_META, ZONE_LABEL } from '@/stores/settings';
import { useUI, type PanelId } from '@/stores/ui';
import { WIDGETS } from './registry';
import { cn } from '@/lib/utils';
import { isDowntime } from '@/lib/balance';
import type { WidgetId, WidgetPlacement, Zone } from '@/lib/types';

const DOCK: { id: PanelId; label: string; icon: typeof CheckSquare }[] = [
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'focus', label: 'Focus', icon: Timer },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'tabs', label: 'Tabs', icon: Layers },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'countdowns', label: 'Countdowns', icon: Hourglass },
  { id: 'inspiration', label: 'Inspiration', icon: Quote },
  { id: 'blocker', label: 'Site blocker', icon: ShieldBan },
  { id: 'clocks', label: 'World clocks', icon: Globe2 },
  { id: 'ai', label: 'Momento AI', icon: Sparkles },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];

const zoneClass: Record<Zone, string> = {
  topLeft: 'items-start',
  topCenter: 'items-center',
  topRight: 'items-end',
  center: 'items-center text-center',
  bottomLeft: 'items-start justify-end',
  bottomCenter: 'items-center justify-end',
  bottomRight: 'items-end justify-end',
};

function useMinuteTick() {
  const [, set] = useState(0);
  useEffect(() => { const t = setInterval(() => set((n) => n + 1), 30_000); return () => clearInterval(t); }, []);
}

export function Dashboard() {
  const s = useS();
  const { editLayout, setEditLayout, openPanel, bgCredit, panel } = useUI();
  const moveWidget = useSettings((st) => st.moveWidget);
  const setWidget = useSettings((st) => st.setWidget);
  useMinuteTick();
  const downtime = isDowntime(s);
  const [dragging, setDragging] = useState<WidgetId | null>(null);
  const [spin, setSpin] = useState(0);

  const visible = (w: WidgetPlacement) => w.visible && !(downtime && s.balance.hiddenInDowntime.includes(w.id));
  const inZone = (z: Zone) => s.widgets.filter((w) => w.zone === z && (editLayout ? w.visible : visible(w))).sort((a, b) => a.order - b.order);

  const onDrop = (zone: Zone, index: number) => (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const id = (e.dataTransfer.getData('text/widget') || dragging) as WidgetId | null;
    if (id) moveWidget(id, zone, index);
    setDragging(null);
  };

  const ZONE_ORDER: Zone[] = ['topLeft', 'topCenter', 'topRight', 'center', 'bottomLeft', 'bottomCenter', 'bottomRight'];
  const renderZone = (zone: Zone, extra?: string) => {
    const items = inZone(zone);
    const zoneDelay = ZONE_ORDER.indexOf(zone) * 70;
    return (
      <div
        className={cn('flex min-h-0 min-w-0 flex-col gap-3', zoneClass[zone], extra, editLayout && 'rounded-2xl border border-dashed border-white/30 p-2 min-h-[64px]')}
        onDragOver={(e) => editLayout && e.preventDefault()}
        onDrop={editLayout ? onDrop(zone, items.length) : undefined}
      >
        {editLayout && <span className="text-[10px] font-semibold uppercase tracking-widest text-white/60">{ZONE_LABEL[zone]}</span>}
        {items.map((w, i) => {
          const W = WIDGETS[w.id];
          return (
            <div
              key={w.id}
              className={cn('enter relative max-w-full transition-transform duration-300', editLayout && 'cursor-grab rounded-2xl ring-1 ring-white/30 hover:scale-[1.02]', dragging === w.id && 'scale-95 opacity-40')}
              style={{ ['--d' as any]: `${zoneDelay + i * 60}ms` }}
              draggable={editLayout}
              onDragStart={(e) => { e.dataTransfer.setData('text/widget', w.id); setDragging(w.id); }}
              onDragEnd={() => setDragging(null)}
              onDragOver={(e) => editLayout && e.preventDefault()}
              onDrop={editLayout ? onDrop(zone, i) : undefined}
            >
              {editLayout && (
                <div className="absolute -top-3 left-2 z-10 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">
                  <GripVertical className="h-3 w-3" /> {WIDGET_META[w.id].label}
                  <button className="ml-1 rounded-full p-0.5 hover:bg-white/20" title="Hide widget" onClick={() => setWidget(w.id, { visible: false })}>
                    <EyeOff className="h-3 w-3" />
                  </button>
                </div>
              )}
              <div className={cn(editLayout && 'pointer-events-none')}>
                <Suspense fallback={<div className="h-8" />}>
                  <W />
                </Suspense>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const hidden = s.widgets.filter((w) => !w.visible);

  const canShuffleBg = s.backgroundMode === 'photo' || (s.backgroundMode === 'custom' && s.customBackgrounds.length > 1);
  const nextBackground = () => {
    // A pinned background would win over the shuffle, so unpin first.
    if (s.pinnedBackground) useSettings.getState().update({ pinnedBackground: null });
    window.dispatchEvent(new Event('momento:next-bg'));
  };

  return (
    <div className={cn('dash-root dash-text relative flex h-full flex-col p-5 md:p-7', !s.blurWidgets && 'no-blur', panel === 'focus' && 'dash-away')}>
      {/* downtime dim: an overlay above the photo (opacity on this container would disable glass blur) */}
      <div className={cn('pointer-events-none fixed inset-0 -z-[5] bg-black/20 transition-opacity duration-1000', downtime && s.balance.dimInDowntime ? 'opacity-100' : 'opacity-0')} aria-hidden />
      {/* top row */}
      <div className="grid grid-cols-3 gap-4">
        {renderZone('topLeft')}
        {renderZone('topCenter')}
        {renderZone('topRight')}
      </div>

      {/* centre */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-4">
        {renderZone('center', 'w-full max-w-3xl')}
        {downtime && <p className="dash-misc mt-4 text-sm text-white/80 animate-fade-in"><Moon className="mr-1 inline h-4 w-4" />{s.balance.downtimeMessage}</p>}
      </div>

      {/* bottom row */}
      <div className="grid grid-cols-[1fr_minmax(0,1.4fr)_1fr] items-end gap-4 pb-14">
        {renderZone('bottomLeft')}
        {renderZone('bottomCenter')}
        {renderZone('bottomRight')}
      </div>

      {/* edit layout tray */}
      {editLayout && (
        <div className="fixed left-1/2 top-4 z-40 max-w-[90vw] -translate-x-1/2">
        <div className="glass flex flex-wrap items-center gap-2 rounded-2xl px-4 py-2 text-sm animate-scale-in">
          <LayoutGrid className="h-4 w-4" />
          <span className="font-medium">Drag widgets between zones.</span>
          {hidden.length > 0 && <span className="text-white/70">Hidden:</span>}
          {hidden.map((w) => (
            <button key={w.id} className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs hover:bg-white/25" onClick={() => setWidget(w.id, { visible: true })}>
              + {WIDGET_META[w.id].label}
            </button>
          ))}
          <button className="ml-2 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-900" onClick={() => setEditLayout(false)}>
            <Check className="h-3.5 w-3.5" /> Done
          </button>
        </div>
        </div>
      )}

      {/* dock */}
      <nav className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2" aria-label="Momento apps">
        <div className="glass enter flex items-center gap-1 rounded-2xl px-2 py-1.5" style={{ ['--d' as any]: '450ms' }}>
          {DOCK.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => openPanel(id)}
              className={cn('dock-btn relative grid h-9 w-9 place-items-center rounded-xl text-white/85 hover:bg-white/15 hover:text-white', panel === id && 'bg-white/15 text-white')}
              aria-label={label}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span className="dock-tip pointer-events-none absolute -top-8 whitespace-nowrap rounded-md bg-black/75 px-2 py-0.5 text-[11px] opacity-0">{label}</span>
              <span className={cn('absolute -bottom-0.5 h-1 w-1 rounded-full bg-white transition-all duration-300 ease-spring', panel === id ? 'scale-100 opacity-100' : 'scale-0 opacity-0')} aria-hidden />
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-white/20" />
          <button
            onClick={() => setEditLayout(!editLayout)}
            className={cn('grid h-9 w-9 place-items-center rounded-xl transition hover:bg-white/15', editLayout ? 'bg-white/25 text-white' : 'text-white/85')}
            aria-label="Customise layout"
            title="Customise layout"
          >
            <LayoutGrid className="h-[18px] w-[18px]" />
          </button>
        </div>
      </nav>

      {(canShuffleBg || bgCredit?.author) && (
        <div className="dash-misc fixed bottom-5 left-5 z-20 flex items-center gap-2 text-[11px] text-white/60">
          {canShuffleBg && (
            <button
              className="group grid h-6 w-6 place-items-center rounded-full transition hover:bg-white/15 hover:text-white active:scale-90"
              aria-label="Next background"
              title="Next background"
              onClick={() => { setSpin((n) => n + 1); nextBackground(); }}
            >
              <RefreshCw className="h-3.5 w-3.5 transition-transform duration-500 ease-out" style={{ transform: `rotate(${spin * 360}deg)` }} />
            </button>
          )}
          {bgCredit?.author && (
            <a href={bgCredit.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-white">
              <Camera className="h-3 w-3" /> {bgCredit.author} · Unsplash
            </a>
          )}
        </div>
      )}
    </div>
  );
}
