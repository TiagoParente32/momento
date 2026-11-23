import { Globe2, Moon } from 'lucide-react';
import { useClocks, zonedTime } from '@/stores/clocks';
import { useS } from '@/stores/settings';
import { useUI } from '@/stores/ui';
import { useNow } from './core';

export default function WorldClocksWidget() {
  const clocks = useClocks((s) => s.clocks);
  const s = useS();
  const openPanel = useUI((u) => u.openPanel);
  const now = useNow(15_000);

  if (!clocks.length) {
    return (
      <button onClick={() => openPanel('clocks')} className="glass flex items-center gap-2 rounded-2xl px-4 py-2 text-sm hover:bg-white/15">
        <Globe2 className="h-4 w-4" /> Add world clocks
      </button>
    );
  }
  return (
    <button onClick={() => openPanel('clocks')} className="glass block w-56 rounded-2xl px-4 py-3 text-left transition hover:bg-white/15" aria-label="Open world clocks">
      <ul className="space-y-1.5">
        {clocks.slice(0, 5).map((c) => {
          const z = zonedTime(now, c.timezone, s.clock24h);
          return (
            <li key={c.id} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-1 truncate text-white/85">
                {z.isNight && <Moon className="h-3 w-3 shrink-0 opacity-70" aria-label="Night" />}
                {c.label}
              </span>
              <span className="shrink-0 font-medium tabular-nums">
                {z.time}
                {z.dayOffset !== 0 && <sup className="ml-0.5 text-[10px] text-white/70">{z.dayOffset > 0 ? '+1' : '−1'}</sup>}
              </span>
            </li>
          );
        })}
      </ul>
      {clocks.length > 5 && <p className="mt-1 text-[11px] text-white/60">+{clocks.length - 5} more</p>}
    </button>
  );
}
