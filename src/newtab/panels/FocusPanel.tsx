import { useEffect, useRef, useState } from 'react';
import { X, Play, Pause, RotateCcw, SkipForward, Volume2, VolumeX, ShieldBan, Settings2, Timer, Flame } from 'lucide-react';
import { useFocus, focusStats, remainingMs, PHASE_LABEL } from '@/stores/focus';
import { useTasks } from '@/stores/tasks';
import { useS } from '@/stores/settings';
import { useUI } from '@/stores/ui';
import { useBlocker, blockingActive } from '@/stores/blocker';
import { AMBIENT_OPTIONS, playAmbient, playChime, setAmbientVolume, stopAmbient } from '@/lib/ambient';
import { cn, formatMinutes, formatMs } from '@/lib/utils';
import type { FocusPhase } from '@/lib/types';
import { useNow } from '../widgets/core';
import { RollingDigits, useSlider } from '@/components/ui';

const PRESETS = [15, 25, 45, 60, 90];

/** Ring + halo colour per phase: calm white for focus, soft green/blue for breaks. */
const PHASE_TINT: Record<FocusPhase, { ring: string; halo: string }> = {
  work: { ring: '#ffffff', halo: 'rgba(255,255,255,.22)' },
  shortBreak: { ring: '#6ee7b7', halo: 'rgba(110,231,183,.25)' },
  longBreak: { ring: '#7dd3fc', halo: 'rgba(125,211,252,.25)' },
};

export default function FocusPanel() {
  const { timer, settings: fs, sessions } = useFocus();
  const f = useFocus.getState();
  const tasks = useTasks((s) => s.tasks);
  const s = useS();
  const params = useUI((st) => st.params);
  const close = useUI((st) => st.closePanel);
  const openPanel = useUI((st) => st.openPanel);
  const blocker = useBlocker((st) => st.blocker);
  const now = useNow(250);
  const [showSettings, setShowSettings] = useState(false);
  const [custom, setCustom] = useState('');
  const phaseSlider = useSlider(timer.phase);

  const remaining = remainingMs(timer, now.getTime());
  const progress = timer.durationMs ? 1 - remaining / timer.durationMs : 0;
  const stats = focusStats(sessions, s.weekStartsOn, now);
  const block = blockingActive(blocker, timer, fs, now);

  // dev-mode finaliser + title
  useEffect(() => { f.tick(); }, [now, f]);
  useEffect(() => {
    const prev = document.title;
    return () => { document.title = prev; };
  }, []);
  useEffect(() => {
    document.title = timer.status === 'idle' ? 'Focus – Momento' : `${formatMs(remaining)} · ${PHASE_LABEL[timer.phase]}`;
  }, [remaining, timer.status, timer.phase]);

  // Esc closes the settings popover first, then (via App) the focus view
  useEffect(() => {
    if (!showSettings) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setShowSettings(false); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [showSettings]);

  // link task from params (e.g. "Focus on this")
  useEffect(() => {
    if (params.task && tasks.some((t) => t.id === params.task) && timer.status === 'idle') f.setTask(params.task);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.task]);

  // chime when a session finishes while this view is open
  const sessionCount = useRef(sessions.length);
  const [ripple, setRipple] = useState(0);
  useEffect(() => {
    if (sessions.length > sessionCount.current && sessions[sessions.length - 1]?.completed) {
      playChime(fs.volume);
      setRipple((n) => n + 1);
    }
    sessionCount.current = sessions.length;
  }, [sessions, fs.volume]);

  // ambient sound follows the running state
  const previewing = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.status === 'running' && timer.phase === 'work' && fs.sound !== 'none') playAmbient(fs.sound, fs.volume);
    else if (!previewing.current) stopAmbient();
  }, [timer.status, timer.phase, fs.sound, fs.volume]);
  useEffect(() => () => { stopAmbient(); if (previewing.current) clearTimeout(previewing.current); }, []);

  const chooseSound = (sound: typeof fs.sound) => {
    f.updateSettings({ sound });
    if (timer.status !== 'running' || timer.phase !== 'work') {
      if (previewing.current) clearTimeout(previewing.current);
      if (sound === 'none') { previewing.current = null; stopAmbient(); return; }
      playAmbient(sound, fs.volume);
      previewing.current = setTimeout(() => { previewing.current = null; stopAmbient(); }, 5000);
    }
  };

  const idle = timer.status === 'idle';
  const tint = PHASE_TINT[timer.phase];
  const size = 300;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div className="focus-root dash-text relative flex h-full flex-col overflow-y-auto scroll-thin" role="dialog" aria-label="Focus mode">
      {/* dim + blur live on their own layer so they fade smoothly (see .focus-scrim) */}
      <div className="focus-scrim" aria-hidden />
      {/* top bar */}
      <header className="enter flex shrink-0 items-center gap-3 px-6 py-4">
        <Timer className="h-5 w-5" />
        <span className="font-semibold tracking-wide">Focus mode</span>
        <span className={cn('ml-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs', block.active ? 'bg-emerald-500/25 text-emerald-100' : 'bg-white/10 text-white/70')}>
          <ShieldBan className="h-3 w-3" /> {block.active ? `Blocking ${blocker.sites.length} site${blocker.sites.length === 1 ? '' : 's'}` : 'Site blocker off'}
        </span>
        <div className="flex-1" />
        <button className="rounded-xl p-2 hover:bg-white/15" aria-label="Focus settings" aria-expanded={showSettings} onClick={() => setShowSettings((v) => !v)}><Settings2 className="h-5 w-5" /></button>
        <button className="rounded-xl p-2 hover:bg-white/15" aria-label="Exit focus mode (Esc)" onClick={close}><X className="h-5 w-5" /></button>
      </header>

      <main className="focus-enter flex flex-1 shrink-0 flex-col items-center justify-center gap-4 px-6 py-2">
        {/* phase selector */}
        <div ref={phaseSlider.ref} className="glass relative flex rounded-full p-1" role="tablist" aria-label="Session type">
          {phaseSlider.box && <span className="slider-pill bottom-1 top-1 rounded-full bg-white shadow" style={{ left: phaseSlider.box.left, width: phaseSlider.box.width }} aria-hidden />}
          {(['work', 'shortBreak', 'longBreak'] as FocusPhase[]).map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={timer.phase === p}
              disabled={!idle}
              onClick={() => f.setPhase(p)}
              className={cn('relative rounded-full px-4 py-1.5 text-sm transition-colors duration-300 disabled:cursor-not-allowed', timer.phase === p ? 'font-medium text-zinc-900 [text-shadow:none]' : 'text-white/80 hover:text-white disabled:opacity-50')}
            >
              {PHASE_LABEL[p]}
            </button>
          ))}
        </div>

        {/* ring */}
        <div
          className="relative shrink-0"
          style={{ width: 'min(300px, 36vh)', height: 'min(300px, 36vh)', minWidth: 180, minHeight: 180, ['--halo' as any]: tint.halo, ['--halo-solid' as any]: tint.ring }}
        >
          <div className={cn('focus-halo', timer.status === 'running' && 'is-running')} aria-hidden />
          {ripple > 0 && (
            <div key={ripple} aria-hidden>
              <div className="focus-ripple" />
              <div className="focus-ripple delay" />
            </div>
          )}
          <svg viewBox={`0 0 ${size} ${size}`} className="relative h-full w-full -rotate-90" aria-hidden>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth={stroke} />
            <circle className="focus-ring-progress" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tint.ring} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - progress)} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span key={timer.phase} className="focus-digits font-display font-semibold tabular-nums tracking-tight" style={{ fontSize: 'clamp(2.5rem, 8vh, 4.5rem)', lineHeight: 1 }} aria-live="off"><RollingDigits text={formatMs(remaining)} /></span>
            <span className="mt-1 text-sm uppercase tracking-[0.25em] text-white/75">{timer.status === 'paused' ? 'Paused' : PHASE_LABEL[timer.phase]}</span>
            {fs.pomodoro && (
              <div className="mt-3 flex gap-1.5" aria-label={`${timer.cycleCount % fs.longBreakEvery} of ${fs.longBreakEvery} sessions until long break`}>
                {Array.from({ length: fs.longBreakEvery }).map((_, i) => (
                  <span key={i} className={cn('h-1.5 w-1.5 rounded-full', i < timer.cycleCount % fs.longBreakEvery ? 'bg-white' : 'bg-white/30')} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* controls */}
        <div className="flex items-center gap-3">
          <button className="glass grid h-12 w-12 place-items-center rounded-full transition duration-300 ease-spring hover:-rotate-45 hover:bg-white/15 active:scale-90" aria-label="Reset" onClick={() => f.reset()} disabled={idle && remaining === timer.durationMs}>
            <RotateCcw className="h-5 w-5" />
          </button>
          {timer.status === 'running' ? (
            <button key="pause" className="grid h-16 w-16 place-items-center rounded-full bg-white text-zinc-900 shadow-xl transition duration-300 ease-spring hover:scale-110 active:scale-95" aria-label="Pause" onClick={() => f.pause()}>
              <Pause className="h-7 w-7 animate-pop" />
            </button>
          ) : (
            <button key="play" className="grid h-16 w-16 place-items-center rounded-full bg-white text-zinc-900 shadow-xl transition duration-300 ease-spring hover:scale-110 active:scale-95" aria-label={timer.status === 'paused' ? 'Resume' : 'Start'} onClick={() => (timer.status === 'paused' ? f.resume() : f.start())}>
              <Play className="ml-1 h-7 w-7 animate-pop" />
            </button>
          )}
          <button className="glass grid h-12 w-12 place-items-center rounded-full transition duration-300 ease-spring hover:translate-x-0.5 hover:bg-white/15 active:scale-90" aria-label="Skip to next phase" onClick={() => f.skip()}>
            <SkipForward className="h-5 w-5" />
          </button>
        </div>

        {/* duration presets */}
        {idle && (
          <div className="flex flex-wrap items-center justify-center gap-2 animate-fade-in">
            {PRESETS.map((m) => (
              <button key={m} onClick={() => f.setDuration(m)} className={cn('rounded-full px-3 py-1 text-sm transition', timer.durationMs === m * 60000 ? 'bg-white/30' : 'bg-white/10 hover:bg-white/20')}>
                {m}m
              </button>
            ))}
            <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); const n = Number(custom); if (n > 0) { f.setDuration(n); setCustom(''); } }}>
              <input value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))} placeholder="Custom" className="w-20 rounded-full bg-white/10 px-3 py-1 text-sm outline-none placeholder:text-white/50 focus:bg-white/20" aria-label="Custom minutes" maxLength={3} />
              {custom && <button type="submit" className="rounded-full bg-white/20 px-2 py-1 text-xs">Set</button>}
            </form>
          </div>
        )}

      </main>

      {/* bottom: sounds + stats */}
      <footer className="enter grid shrink-0 gap-4 px-6 pb-6 pt-4 md:grid-cols-[1fr_auto]" style={{ ['--d' as any]: '600ms' }}>
        <div className="glass flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3">
          {fs.sound === 'none' ? <VolumeX className="h-4 w-4 text-white/70" /> : <Volume2 className="h-4 w-4" />}
          <span className="mr-1 text-sm font-medium">Ambience</span>
          {AMBIENT_OPTIONS.map((o) => (
            <button key={o.value} onClick={() => chooseSound(o.value)} aria-pressed={fs.sound === o.value} className={cn('rounded-full px-2.5 py-1 text-xs transition', fs.sound === o.value ? 'bg-white text-zinc-900' : 'bg-white/10 hover:bg-white/20')}>
              <span aria-hidden>{o.emoji}</span> {o.label}
            </button>
          ))}
          <input
            type="range" min={0} max={1} step={0.05} value={fs.volume}
            onChange={(e) => { const v = Number(e.target.value); f.updateSettings({ volume: v }); setAmbientVolume(v); }}
            className="ml-2 w-28" aria-label="Ambient volume"
          />
        </div>
        <div className="glass flex items-center gap-5 rounded-2xl px-5 py-3 text-sm">
          <Stat label="Today" value={formatMinutes(stats.todayMin)} sub={`${stats.todayCount} sessions`} />
          <Stat label="This week" value={formatMinutes(stats.weekMin)} sub={`${stats.weekCount} sessions`} />
          <Stat label="All time" value={formatMinutes(stats.totalMin)} sub={<span className="inline-flex items-center gap-0.5"><Flame className="h-3 w-3" />{stats.totalCount}</span>} />
        </div>
      </footer>

      {showSettings && (
        <div className="glass absolute right-6 top-16 z-10 w-80 space-y-3 rounded-2xl p-4 text-sm animate-scale-in" role="dialog" aria-label="Focus settings">
          <p className="font-semibold">Timer settings</p>
          <div className="grid grid-cols-2 gap-2">
            <NumField label="Focus (min)" value={fs.workMin} onChange={(v) => f.updateSettings({ workMin: v })} />
            <NumField label="Short break" value={fs.shortBreakMin} onChange={(v) => f.updateSettings({ shortBreakMin: v })} />
            <NumField label="Long break" value={fs.longBreakMin} onChange={(v) => f.updateSettings({ longBreakMin: v })} />
            <NumField label="Long break every" value={fs.longBreakEvery} max={12} onChange={(v) => f.updateSettings({ longBreakEvery: v })} />
          </div>
          <Check label="Pomodoro cycle (auto breaks)" checked={fs.pomodoro} onChange={(v) => f.updateSettings({ pomodoro: v })} />
          <Check label="Auto-start breaks" checked={fs.autoStartBreaks} disabled={!fs.pomodoro} onChange={(v) => f.updateSettings({ autoStartBreaks: v })} />
          <Check label="Auto-start focus after breaks" checked={fs.autoStartWork} disabled={!fs.pomodoro} onChange={(v) => f.updateSettings({ autoStartWork: v })} />
          <Check label="Notify when a session ends" checked={fs.notify} onChange={(v) => f.updateSettings({ notify: v })} />
          <Check label="Block distracting sites while focusing" checked={fs.blockDuringFocus} onChange={(v) => f.updateSettings({ blockDuringFocus: v })} />
          <Check label="…and during breaks" checked={fs.blockDuringBreaks} disabled={!fs.blockDuringFocus} onChange={(v) => f.updateSettings({ blockDuringBreaks: v })} />
          <button className="text-xs text-white/80 underline-offset-2 hover:underline" onClick={() => openPanel('blocker')}>Manage blocked sites →</button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-white/60">{label}</p>
      <p className="text-lg font-semibold leading-tight">{value}</p>
      <p className="text-[11px] text-white/60">{sub}</p>
    </div>
  );
}

function NumField({ label, value, onChange, max = 240 }: { label: string; value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <label className="block">
      <span className="text-[11px] text-white/70">{label}</span>
      <input
        type="number" min={1} max={max} value={value}
        onChange={(e) => { const n = Math.round(Number(e.target.value)); if (n >= 1 && n <= max) onChange(n); }}
        className="mt-0.5 w-full rounded-lg bg-white/10 px-2 py-1 outline-none focus:bg-white/20"
      />
    </label>
  );
}

function Check({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2', disabled && 'opacity-50')}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
