import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-2xl px-6 py-6 animate-fade-in">
      <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-5 space-y-6">{children}</div>
    </section>
  );
}

export function Group({ title, description, children, className }: { title?: string; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('card p-4', className)}>
      {title && <p className="text-sm font-semibold">{title}</p>}
      {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      <div className={cn(title || description ? 'mt-3' : '', 'space-y-3')}>{children}</div>
    </div>
  );
}

export function Row({ label, description, children }: { label: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-1">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function Note({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'danger' | 'success' }) {
  const cls = {
    info: 'border-accent/25 bg-accent/5',
    warn: 'border-amber-500/30 bg-amber-500/10',
    danger: 'border-red-500/30 bg-red-500/10',
    success: 'border-emerald-500/30 bg-emerald-500/10',
  }[tone];
  return <div className={cn('rounded-xl border px-3 py-2.5 text-xs leading-relaxed', cls)}>{children}</div>;
}

export function DayPicker({ value, onChange }: { value: number[]; onChange: (d: number[]) => void }) {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const full = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return (
    <div className="flex gap-1">
      {days.map((d, i) => {
        const on = value.includes(i);
        return (
          <button key={i} type="button" aria-pressed={on} aria-label={full[i]} title={full[i]}
            onClick={() => onChange(on ? value.filter((x) => x !== i) : [...value, i].sort())}
            className={cn('h-8 w-8 rounded-lg text-xs font-semibold transition', on ? 'bg-accent text-white' : 'bg-ink/5 text-muted hover:bg-ink/10')}>
            {d}
          </button>
        );
      })}
    </div>
  );
}

/** Number input that commits clamped integers. */
export function NumberInput({ value, onChange, min, max, step = 1, suffix, className }: { value: number; onChange: (n: number) => void; min: number; max: number; step?: number; suffix?: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <input
        type="number"
        className="input w-20 text-center"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, Math.round(n))));
        }}
      />
      {suffix && <span className="text-xs text-muted">{suffix}</span>}
    </span>
  );
}
