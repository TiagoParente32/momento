import { useS, useSettings } from '@/stores/settings';
import { useNow } from './core';
import { pad } from '@/lib/utils';
import { RollingDigits } from '@/components/ui';

export default function ClockWidget() {
  const s = useS();
  const update = useSettings((st) => st.update);
  const now = useNow(s.showSeconds ? 1000 : 10_000);
  let h = now.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (!s.clock24h) h = h % 12 || 12;
  const date = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <div className="select-none">
      <button
        className="font-display text-[clamp(4.5rem,12vw,9.5rem)] font-semibold leading-none tracking-tight tabular-nums"
        title="Double-click to toggle 12/24-hour"
        onDoubleClick={() => update({ clock24h: !s.clock24h })}
      >
        <RollingDigits text={`${s.clock24h ? pad(h) : h}:${pad(now.getMinutes())}`} />
        {s.showSeconds && <span className="text-[0.4em] font-medium opacity-80">:<RollingDigits text={pad(now.getSeconds())} /></span>}
        {!s.clock24h && <span className="ml-2 align-top text-[0.18em] font-medium tracking-widest opacity-75">{ampm}</span>}
      </button>
      <p key={date} className="mt-1 text-lg font-medium text-white/85 animate-fade-in">{date}</p>
    </div>
  );
}
