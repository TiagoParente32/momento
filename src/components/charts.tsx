// Lightweight SVG charts (no library). Single-series by design: the panel title
// names the series, marks use the accent colour, text stays in ink tokens, grid
// and axes are recessive, and every mark has a hover/focus tooltip.
import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface Datum { label: string; value: number; /** long label for tooltip */ title?: string }

const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
};

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return;
    setW(Math.max(120, ref.current.clientWidth));
    const ro = new ResizeObserver((e) => setW(Math.max(120, e[0].contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function Tooltip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line/10 bg-surface px-2.5 py-1.5 text-xs text-ink shadow-lg"
      style={{ left: x, top: y - 8 }}
      role="status"
    >
      {children}
    </div>
  );
}

/** Vertical bar chart. */
export function BarChart({ data, height = 180, format = (v) => String(v), color = 'rgb(var(--accent))', ariaLabel }: { data: Datum[]; height?: number; format?: (v: number) => string; color?: string; ariaLabel: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 36, padB = 22, padT = 8;
  const innerW = width - padL;
  const innerH = height - padB - padT;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const slot = innerW / Math.max(1, data.length);
  const gap = Math.max(2, Math.min(8, slot * 0.25));
  const barW = Math.max(2, slot - gap);
  const ticks = [0, max / 2, max];
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(innerW / 44)));
  const r = Math.min(4, barW / 2);

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setHover(null)}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
        {ticks.map((t) => {
          const y = padT + innerH - (t / max) * innerH;
          return (
            <g key={t}>
              <line x1={padL} x2={width} y1={y} y2={y} stroke="rgb(var(--line) / 0.08)" strokeWidth={1} />
              <text x={padL - 6} y={y} dy="0.32em" textAnchor="end" fontSize={10} fill="rgb(var(--muted))">{format(t)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.value / max) * innerH;
          const x = padL + i * slot + gap / 2;
          const y = padT + innerH - h;
          const active = hover === i;
          return (
            <g key={i}>
              {h > 0 && (
                <path
                  d={`M${x},${padT + innerH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${padT + innerH} Z`}
                  fill={color}
                  opacity={hover == null || active ? 1 : 0.45}
                />
              )}
              {/* oversized hit target */}
              <rect
                x={padL + i * slot}
                y={padT}
                width={slot}
                height={innerH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${d.title ?? d.label}: ${format(d.value)}`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="outline-none"
              />
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={height - 6} textAnchor="middle" fontSize={10} fill="rgb(var(--muted))">{d.label}</text>
              )}
            </g>
          );
        })}
        <line x1={padL} x2={width} y1={padT + innerH} y2={padT + innerH} stroke="rgb(var(--line) / 0.2)" strokeWidth={1} />
      </svg>
      {hover != null && data[hover] && (
        <Tooltip x={padL + hover * slot + slot / 2} y={padT + innerH - (data[hover].value / max) * innerH}>
          <span className="text-muted">{data[hover].title ?? data[hover].label}</span> <span className="font-semibold">{format(data[hover].value)}</span>
        </Tooltip>
      )}
    </div>
  );
}

/** Line / area chart with crosshair tooltip. */
export function LineChart({ data, height = 160, format = (v) => String(v), area = true, color = 'rgb(var(--accent))', ariaLabel }: { data: Datum[]; height?: number; format?: (v: number) => string; area?: boolean; color?: string; ariaLabel: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/:/g, '');
  const padL = 36, padB = 22, padT = 8, padR = 8;
  const innerW = width - padL - padR;
  const innerH = height - padB - padT;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const xAt = (i: number) => padL + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const yAt = (v: number) => padT + innerH - (v / max) * innerH;
  const pts = data.map((d, i) => [xAt(i), yAt(d.value)] as const);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(innerW / 48)));

  const onMove = (e: MouseEvent<SVGRectElement>) => {
    const rect = (e.target as SVGRectElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const i = data.length <= 1 ? 0 : Math.round((x / innerW) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  return (
    <div ref={ref} className="relative w-full">
      <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
        <defs>
          <linearGradient id={`g${gid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={yAt(t)} y2={yAt(t)} stroke="rgb(var(--line) / 0.08)" />
            <text x={padL - 6} y={yAt(t)} dy="0.32em" textAnchor="end" fontSize={10} fill="rgb(var(--muted))">{format(t)}</text>
          </g>
        ))}
        {area && pts.length > 1 && <path d={`${line} L${pts[pts.length - 1][0]},${padT + innerH} L${pts[0][0]},${padT + innerH} Z`} fill={`url(#g${gid})`} />}
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => i % labelEvery === 0 && (
          <text key={i} x={xAt(i)} y={height - 6} textAnchor="middle" fontSize={10} fill="rgb(var(--muted))">{d.label}</text>
        ))}
        {hover != null && (
          <g>
            <line x1={pts[hover][0]} x2={pts[hover][0]} y1={padT} y2={padT + innerH} stroke="rgb(var(--line) / 0.25)" strokeDasharray="3 3" />
            <circle cx={pts[hover][0]} cy={pts[hover][1]} r={5} fill={color} stroke="rgb(var(--surface))" strokeWidth={2} />
          </g>
        )}
        <rect x={padL} y={padT} width={innerW} height={innerH} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      </svg>
      {hover != null && data[hover] && (
        <Tooltip x={pts[hover][0]} y={pts[hover][1]}>
          <span className="text-muted">{data[hover].title ?? data[hover].label}</span> <span className="font-semibold">{format(data[hover].value)}</span>
        </Tooltip>
      )}
      {/* screen-reader table */}
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <tbody>{data.map((d, i) => <tr key={i}><th>{d.title ?? d.label}</th><td>{format(d.value)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

/** Calendar heatmap: columns are weeks, rows weekdays. `values` keyed by ISO date. */
export function Heatmap({ days, values, format = (v) => String(v), ariaLabel, weekStartsOn = 1 }: { days: { date: string; label: string }[]; values: Record<string, number>; format?: (v: number) => string; ariaLabel: string; weekStartsOn?: 0 | 1 }) {
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);
  const max = Math.max(1, ...days.map((d) => values[d.date] ?? 0));
  const cell = 13, gap = 3;
  // sequential, one hue (accent), light → dark via opacity steps
  const level = (v: number) => (v <= 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)));
  const fills = ['rgb(var(--line) / 0.07)', 'rgb(var(--accent) / 0.3)', 'rgb(var(--accent) / 0.5)', 'rgb(var(--accent) / 0.75)', 'rgb(var(--accent) / 1)'];
  const first = days.length ? new Date(days[0].date + 'T00:00') : new Date();
  const offset = (first.getDay() - weekStartsOn + 7) % 7;
  const cols = Math.ceil((days.length + offset) / 7);
  const width = cols * (cell + gap);
  const height = 7 * (cell + gap);

  return (
    <div className="relative">
      <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block max-w-full overflow-visible">
        {days.map((d, i) => {
          const idx = i + offset;
          const x = Math.floor(idx / 7) * (cell + gap);
          const y = (idx % 7) * (cell + gap);
          const v = values[d.date] ?? 0;
          return (
            <rect
              key={d.date}
              x={x}
              y={y}
              width={cell}
              height={cell}
              rx={3}
              fill={fills[level(v)]}
              tabIndex={-1}
              onMouseEnter={() => setHover({ x: x + cell / 2, y, text: `${d.label}: ${format(v)}` })}
              onMouseLeave={() => setHover(null)}
            >
              <title>{`${d.label}: ${format(v)}`}</title>
            </rect>
          );
        })}
      </svg>
      {hover && <Tooltip x={hover.x} y={hover.y}>{hover.text}</Tooltip>}
      <div className="mt-2 flex items-center gap-1 text-[10px] text-muted" aria-hidden>
        Less {fills.map((f, i) => <span key={i} className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: f }} />)} More
      </div>
    </div>
  );
}

/** Tiny inline trend line. */
export function Sparkline({ values, width = 80, height = 24, color = 'rgb(var(--accent))', className }: { values: number[]; width?: number; height?: number; color?: string; className?: string }) {
  if (values.length < 2) return <svg width={width} height={height} className={className} aria-hidden />;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (width - 4) + 2},${height - 2 - (v / max) * (height - 4)}`);
  return (
    <svg width={width} height={height} className={cn('overflow-visible', className)} aria-hidden>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Horizontal labelled progress bar. */
export function ProgressBar({ value, color = 'rgb(var(--accent))', label }: { value: number; color?: string; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={label}>
      <div className="h-full rounded-full transition-all" style={{ width: `${v * 100}%`, background: color }} />
    </div>
  );
}
