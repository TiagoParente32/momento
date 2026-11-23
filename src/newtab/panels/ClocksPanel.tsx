import { useEffect, useMemo, useState } from 'react';
import { Globe2, Search, Trash2, ChevronUp, ChevronDown, Pencil, Check, GripVertical, Plus } from 'lucide-react';
import { PanelFrame } from '@/components/PanelFrame';
import { Button, EmptyState, IconButton, Input, Segmented, toast } from '@/components/ui';
import { useClocks, zonedTime } from '@/stores/clocks';
import { useS } from '@/stores/settings';
import { searchLocations, locationLabel } from '@/lib/weather';
import { useNow } from '../widgets/core';
import { cn } from '@/lib/utils';
import type { GeoLocation } from '@/lib/types';

const allZones = (): string[] => {
  try { return (Intl as any).supportedValuesOf('timeZone') as string[]; } catch { return ['UTC', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney']; }
};

export default function ClocksPanel() {
  const { clocks, addClock, removeClock, renameClock, moveClock, reorderClock } = useClocks();
  const s = useS();
  const now = useNow(1000);
  const [mode, setMode] = useState<'city' | 'zone'>('city');
  const [q, setQ] = useState('');
  const [cities, setCities] = useState<GeoLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);

  const zones = useMemo(allZones, []);
  const zoneMatches = useMemo(() => {
    const t = q.trim().toLowerCase().replace(/\s+/g, '_');
    return t ? zones.filter((z) => z.toLowerCase().includes(t)).slice(0, 20) : [];
  }, [q, zones]);

  useEffect(() => {
    if (mode !== 'city' || q.trim().length < 2) { setCities([]); setErr(null); return; }
    const t = setTimeout(async () => {
      setSearching(true); setErr(null);
      try {
        const r = await searchLocations(q);
        setCities(r);
        if (!r.length) setErr('No cities found — try searching by time zone.');
      } catch (e) { setErr(e instanceof Error ? e.message : 'Search failed'); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [q, mode]);

  const add = (label: string, tz: string, country?: string) => {
    addClock(label, tz, country);
    setQ(''); setCities([]);
    toast(`Added ${label}`, 'success');
  };

  return (
    <PanelFrame title="World clocks" icon={<Globe2 className="h-4 w-4" />}>
      <div className="space-y-5 p-5">
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={mode === 'city' ? 'Search a city…' : 'Search a time zone (e.g. Tokyo, Europe/)…'} className="pl-9" aria-label="Search clocks" />
            </div>
            <Segmented<'city' | 'zone'> value={mode} onChange={setMode} options={[{ value: 'city', label: 'City' }, { value: 'zone', label: 'Time zone' }]} />
          </div>
          {searching && <p className="text-xs text-muted">Searching…</p>}
          {err && <p className="text-xs text-red-500">{err}</p>}
          {mode === 'city' && cities.length > 0 && (
            <ul className="card divide-y divide-line/10">
              {cities.map((c) => (
                <li key={`${c.latitude},${c.longitude}`}>
                  <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-ink/5" onClick={() => add(c.name, c.timezone, c.country)}>
                    <Plus className="h-4 w-4 text-muted" /> {locationLabel(c)}
                    <span className="ml-auto text-xs text-muted">{zonedTime(now, c.timezone, s.clock24h).time}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {mode === 'zone' && zoneMatches.length > 0 && (
            <ul className="card max-h-64 divide-y divide-line/10 overflow-y-auto scroll-thin">
              {zoneMatches.map((z) => (
                <li key={z}>
                  <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-ink/5" onClick={() => add(z.split('/').pop()!.replace(/_/g, ' '), z)}>
                    <Plus className="h-4 w-4 text-muted" /> {z.replace(/_/g, ' ')}
                    <span className="ml-auto text-xs text-muted">{zonedTime(now, z, s.clock24h).time}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {clocks.length === 0 ? (
          <EmptyState icon={<Globe2 className="h-5 w-5" />} title="No world clocks yet" description="Search for a city to keep track of times around the world. Daylight saving is handled automatically." />
        ) : (
          <ul className="space-y-2">
            {clocks.map((c, i) => {
              const z = zonedTime(now, c.timezone, s.clock24h);
              return (
                <li
                  key={c.id}
                  draggable
                  onDragStart={() => setDragId(c.id)}
                  onDragEnd={() => setDragId(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); if (dragId) reorderClock(dragId, i); setDragId(null); }}
                  className={cn('card flex items-center gap-3 px-4 py-3', dragId === c.id && 'opacity-40')}
                >
                  <GripVertical className="h-4 w-4 cursor-grab text-muted" aria-hidden />
                  <div className="min-w-0 flex-1">
                    {editing === c.id ? (
                      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); renameClock(c.id, draft); setEditing(null); }}>
                        <Input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Clock name" />
                        <IconButton label="Save name" type="submit"><Check className="h-4 w-4" /></IconButton>
                      </form>
                    ) : (
                      <>
                        <p className="truncate font-medium">{c.label}</p>
                        <p className="truncate text-xs text-muted">
                          {c.timezone.replace(/_/g, ' ')} · {z.offsetName}
                          {z.dayOffset !== 0 && ` · ${z.dayOffset > 0 ? 'Tomorrow' : 'Yesterday'}`}
                        </p>
                      </>
                    )}
                  </div>
                  <span className="text-2xl font-semibold tabular-nums">{z.time}</span>
                  <div className="flex">
                    <IconButton label="Move up" disabled={i === 0} onClick={() => moveClock(c.id, -1)}><ChevronUp className="h-4 w-4" /></IconButton>
                    <IconButton label="Move down" disabled={i === clocks.length - 1} onClick={() => moveClock(c.id, 1)}><ChevronDown className="h-4 w-4" /></IconButton>
                    <IconButton label="Rename" onClick={() => { setEditing(c.id); setDraft(c.label); }}><Pencil className="h-4 w-4" /></IconButton>
                    <IconButton label="Remove clock" onClick={() => removeClock(c.id)}><Trash2 className="h-4 w-4" /></IconButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted">Tip: enable the World clocks widget from the dashboard layout editor to show these on your new tab.</p>
        {clocks.length > 0 && <Button size="sm" variant="ghost" onClick={() => toast(`Your local time zone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`)}>What’s my time zone?</Button>}
      </div>
    </PanelFrame>
  );
}
