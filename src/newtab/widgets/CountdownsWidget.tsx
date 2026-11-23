import { Hourglass } from 'lucide-react';
import { useCountdowns, daysUntil, kindMeta } from '@/stores/countdowns';
import { useUI } from '@/stores/ui';
import { useNow } from './core';
import { fromISODate } from '@/lib/utils';

export default function CountdownsWidget() {
  const countdowns = useCountdowns((s) => s.countdowns);
  const openPanel = useUI((u) => u.openPanel);
  const now = useNow(60_000);
  const pinned = countdowns
    .filter((c) => c.pinned)
    .map((c) => ({ c, d: daysUntil(c, now) }))
    .filter((x) => x.d >= 0)
    .sort((a, b) => a.d - b.d)
    .slice(0, 4);

  if (!pinned.length) {
    return (
      <button onClick={() => openPanel('countdowns')} className="glass flex items-center gap-2 rounded-2xl px-3 py-2 text-sm text-white/85 hover:bg-white/15">
        <Hourglass className="h-4 w-4" /> Add a countdown
      </button>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {pinned.map(({ c, d }) => (
        <button
          key={c.id}
          onClick={() => openPanel('countdowns')}
          className="glass flex items-center gap-2 rounded-2xl py-1.5 pl-1.5 pr-3 text-sm transition hover:bg-white/15"
          title={`${c.title} – ${fromISODate(c.date).toLocaleDateString()}`}
        >
          <span className="grid h-8 min-w-8 place-items-center rounded-xl px-1.5 text-sm font-semibold tabular-nums" style={{ background: c.color }}>
            {d === 0 ? '🎉' : d}
          </span>
          <span className="text-left leading-tight">
            <span className="block max-w-[10rem] truncate font-medium">{c.title}</span>
            <span className="block text-[11px] text-white/70">{d === 0 ? 'Today' : d === 1 ? '1 day' : `${d} days`} · {kindMeta(c.kind).label}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
