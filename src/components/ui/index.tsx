import { forwardRef, useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { X, Loader2, Check } from 'lucide-react';
import { create } from 'zustand';
import { cn, PALETTE, uid } from '@/lib/utils';

// ---------------- Button ----------------
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'glass';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:brightness-110 shadow-sm shadow-accent/30',
  secondary: 'bg-ink/5 text-ink hover:bg-ink/10 border border-line/10',
  ghost: 'text-ink/80 hover:bg-ink/5 hover:text-ink',
  danger: 'bg-red-500/90 text-white hover:bg-red-500',
  glass: 'glass text-white hover:bg-white/15',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-9 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-11 px-5 text-sm gap-2 rounded-xl',
  icon: 'h-9 w-9 rounded-xl justify-center',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center font-medium transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});

export function IconButton({ label, className, children, ...rest }: ButtonProps & { label: string }) {
  return (
    <Button size="icon" variant="ghost" aria-label={label} title={label} className={className} {...rest}>
      {children}
    </Button>
  );
}

// ---------------- Inputs ----------------
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn('input', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn('input min-h-[80px] resize-y', className)} {...rest} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn('input cursor-pointer appearance-none pr-8', className)} {...rest}>
      {children}
    </select>
  );
}

export function Field({ label, hint, error, children, className }: { label?: string; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      {label && <span className="label">{label}</span>}
      {children}
      {error ? <span className="mt-1 block text-xs text-red-500">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; description?: ReactNode; disabled?: boolean }) {
  return (
    <label className={cn('flex cursor-pointer items-center justify-between gap-4 py-2', disabled && 'cursor-not-allowed opacity-50')}>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm font-medium">{label}</span>}
          {description && <span className="block text-xs text-muted">{description}</span>}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('group/sw relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300', checked ? 'bg-accent' : 'bg-ink/15')}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-300 ease-spring group-active/sw:w-6',
            checked ? 'left-[22px] group-active/sw:left-[18px]' : 'left-0.5',
          )}
        />
      </button>
    </label>
  );
}

/** Measures the selected child of a container so a pill/underline can slide to it. */
export function useSlider(value: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const sel = el.querySelector<HTMLElement>('[aria-selected="true"]');
      setBox(sel ? { left: sel.offsetLeft, width: sel.offsetWidth } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value]);
  return { ref, box };
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  const { ref, box } = useSlider(value);
  return (
    <div ref={ref} className={cn('relative inline-flex rounded-xl bg-ink/5 p-1', className)} role="tablist">
      {box && <span className="slider-pill bottom-1 top-1 rounded-lg bg-surface shadow-sm" style={{ left: box.left, width: box.width }} aria-hidden />}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('relative rounded-lg px-3 py-1.5 text-xs font-medium transition-colors', value === o.value ? 'text-ink' : 'text-muted hover:text-ink', !box && value === o.value && 'bg-surface shadow-sm')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Text whose characters roll in individually when they change (clock, timers).
 * Each char is keyed by position + value, so only changed digits re-mount and animate.
 */
export function RollingDigits({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn('inline-flex', className)} aria-label={text}>
      {text.split('').map((ch, i) => (
        <span key={`${i}-${ch}`} className={cn('inline-block', /\d/.test(ch) && 'animate-digit-in')} aria-hidden>{ch}</span>
      ))}
    </span>
  );
}

/** Small confetti-dot burst; render with a changing `key` to replay. */
export function Burst({ count = 10, distance = 22, colors = ['#fff', '#fde68a', '#a5b4fc', '#6ee7b7', '#f9a8d4'] }: { count?: number; distance?: number; colors?: string[] }) {
  return (
    <span className="burst" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <i
          key={i}
          style={{
            ['--a' as any]: `${(360 / count) * i + (i % 2) * 12}deg`,
            ['--d' as any]: `${distance * (0.75 + (i % 3) * 0.2)}px`,
            ['--c' as any]: colors[i % colors.length],
            animationDelay: `${(i % 3) * 25}ms`,
          }}
        />
      ))}
    </span>
  );
}

/** Returns a counter that bumps when `trigger` flips from false → true (for one-shot animations). */
export function useCelebrate(trigger: boolean, resetKey?: unknown) {
  const [n, setN] = useState(0);
  const prev = useRef({ trigger, resetKey });
  useEffect(() => {
    // Switching to a different item (resetKey) that is already "on" isn't a celebration.
    if (trigger && !prev.current.trigger && prev.current.resetKey === resetKey) setN((x) => x + 1);
    prev.current = { trigger, resetKey };
  }, [trigger, resetKey]);
  return n;
}

export function ColorPicker({ value, onChange, colors = PALETTE }: { value: string; onChange: (c: string) => void; colors?: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Colour ${c}`}
          onClick={() => onChange(c)}
          className={cn('grid h-7 w-7 place-items-center rounded-full ring-offset-2 ring-offset-surface transition hover:scale-110', value === c && 'ring-2 ring-ink/40')}
          style={{ background: c }}
        >
          {value === c && <Check className="h-3.5 w-3.5 text-white" />}
        </button>
      ))}
      <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border border-line/20" title="Custom colour" style={{ background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
    </div>
  );
}

// ---------------- Modal ----------------
export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  const ref = useRef<HTMLDivElement>(null);
  // Keep the latest onClose in a ref so callers can pass inline arrows without
  // re-running the focus effect on every render (that stole focus mid-typing).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), onCloseRef.current());
    window.addEventListener('keydown', onKey, true);
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const root = ref.current;
      if (!root || root.contains(document.activeElement)) return;
      (root.querySelector<HTMLElement>('input,textarea,select') ?? root.querySelector<HTMLElement>('button'))?.focus();
    }, 30);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey, true); prev?.focus?.(); };
  }, [open]);
  if (!open) return null;
  const w = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-3xl' : 'max-w-lg';
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      {/* scrim is a sibling, not a parent: fading a parent would disable the dialog's own blur */}
      <div className="scrim bg-black/40 animate-fade-soft" onMouseDown={() => onCloseRef.current()} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" className={cn('panel relative w-full rounded-2xl text-ink shadow-2xl animate-scale-in', w)}>
        {title && (
          <div className="flex items-center justify-between px-5 pb-2 pt-4">
            <h2 className="text-base font-semibold">{title}</h2>
            <IconButton label="Close" onClick={onClose} size="icon">
              <X className="h-4 w-4" />
            </IconButton>
          </div>
        )}
        <div className="max-h-[70vh] overflow-y-auto px-5 pb-4 scroll-thin">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line/10 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------- Confirm (promise-based) ----------------
interface ConfirmState {
  req: { id: string; title: string; message?: string; confirmLabel?: string; danger?: boolean; resolve: (v: boolean) => void } | null;
}
const useConfirmStore = create<ConfirmState>(() => ({ req: null }));

export function confirmDialog(opts: { title: string; message?: string; confirmLabel?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => useConfirmStore.setState({ req: { id: uid(), ...opts, resolve } }));
}

export function ConfirmHost() {
  const req = useConfirmStore((s) => s.req);
  const close = (v: boolean) => { req?.resolve(v); useConfirmStore.setState({ req: null }); };
  return (
    <Modal
      open={!!req}
      onClose={() => close(false)}
      title={req?.title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)}>Cancel</Button>
          <Button variant={req?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{req?.confirmLabel ?? 'Confirm'}</Button>
        </>
      }
    >
      {req?.message && <p className="text-sm text-muted">{req.message}</p>}
    </Modal>
  );
}

// ---------------- Toasts ----------------
interface Toast { id: string; message: string; kind: 'info' | 'success' | 'error'; action?: { label: string; run: () => void } }
const useToastStore = create<{ toasts: Toast[] }>(() => ({ toasts: [] }));

export function toast(message: string, kind: Toast['kind'] = 'info', action?: Toast['action']) {
  const t: Toast = { id: uid(), message, kind, action };
  useToastStore.setState((s) => ({ toasts: [...s.toasts, t] }));
  setTimeout(() => useToastStore.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) })), action ? 6000 : 3500);
}

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[200] flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-white shadow-xl animate-toast-in',
            t.kind === 'error' ? 'bg-red-600/95' : t.kind === 'success' ? 'bg-emerald-600/95' : 'bg-zinc-900/90',
          )}
        >
          <span>{t.message}</span>
          {t.action && (
            <button
              className="font-semibold underline-offset-2 hover:underline"
              onClick={() => { t.action!.run(); useToastStore.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) })); }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------- Misc ----------------
export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="mb-1 grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent">{icon}</div>}
      <p className="text-sm font-semibold">{title}</p>
      {description && <p className="max-w-xs text-xs text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-muted', className)} />;
}

export function Badge({ children, color, className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span className={cn('chip', !color && 'bg-ink/5 text-muted', className)} style={color ? { background: color + '22', color } : undefined}>
      {children}
    </span>
  );
}

export function ProgressRing({ value, size = 48, stroke = 5, color = 'rgb(var(--accent))', track = 'rgb(var(--line) / 0.1)', children }: { value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset .5s ease' }} />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center">{children}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode; icon?: ReactNode }[] }) {
  const { ref, box } = useSlider(value);
  return (
    <div ref={ref} className="relative flex gap-1 border-b border-line/10" role="tablist">
      {box && <span className="slider-pill -bottom-px h-0.5 rounded-full bg-accent" style={{ left: box.left, width: box.width }} aria-hidden />}
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn('-mb-px flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm font-medium transition-colors', value === t.value ? 'text-ink' : 'text-muted hover:text-ink', !box && value === t.value && 'border-accent')}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}
