import { useEffect } from 'react';
import { Pause, Play, Maximize2, RotateCcw } from 'lucide-react';
import { useFocus, remainingMs, PHASE_LABEL } from '@/stores/focus';
import { useTasks } from '@/stores/tasks';
import { useUI } from '@/stores/ui';
import { cn, formatMs } from '@/lib/utils';
import { useNow } from './core';
import { RollingDigits } from '@/components/ui';

export default function FocusWidget() {
  const timer = useFocus((s) => s.timer);
  const f = useFocus.getState();
  const task = useTasks((s) => s.tasks.find((t) => t.id === timer.taskId));
  const openPanel = useUI((s) => s.openPanel);
  const now = useNow(timer.status === 'running' ? 1000 : 30_000);
  useEffect(() => { f.tick(); }, [now, f]);

  const remaining = remainingMs(timer, now.getTime());
  const progress = timer.durationMs ? 1 - remaining / timer.durationMs : 0;
  const size = 44, stroke = 3.5, r = (size - stroke) / 2, c = 2 * Math.PI * r;

  return (
    <div className="glass lift flex w-72 items-center gap-3 rounded-2xl p-3 text-left">
      <button
        className={cn('relative grid shrink-0 place-items-center rounded-full transition duration-300 ease-spring hover:scale-110 active:scale-95', timer.status === 'running' && timer.phase === 'work' && 'focus-widget-breathe')}
        style={{ width: size, height: size }}
        aria-label={timer.status === 'running' ? 'Pause focus timer' : timer.status === 'paused' ? 'Resume focus timer' : 'Start focus timer'}
        onClick={() => (timer.status === 'running' ? f.pause() : timer.status === 'paused' ? f.resume() : f.start())}
      >
        <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.2)" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="white" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - progress)} style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
        {timer.status === 'running' ? <Pause key="pause" className="h-4 w-4 animate-pop" /> : <Play key="play" className="ml-0.5 h-4 w-4 animate-pop" />}
      </button>
      <button className="min-w-0 flex-1 text-left" onClick={() => openPanel('focus')} aria-label="Open focus mode">
        <p key={`${timer.status}-${timer.phase}`} className="text-[10px] font-semibold uppercase tracking-widest text-white/70 animate-fade-in">
          {timer.status === 'paused' ? 'Paused' : timer.status === 'running' ? PHASE_LABEL[timer.phase] : `${PHASE_LABEL[timer.phase]} · ready`}
        </p>
        <p className="font-display text-2xl font-semibold leading-tight tabular-nums"><RollingDigits text={formatMs(remaining)} /></p>
        <p key={task?.id ?? 'none'} className="truncate text-xs text-white/70 animate-fade-in">{task ? task.title : 'No task linked'}</p>
      </button>
      <div className="flex flex-col gap-1">
        <button className="rounded-lg p-1 text-white/70 hover:bg-white/15 hover:text-white" aria-label="Open full-screen focus mode" title="Focus mode" onClick={() => openPanel('focus')}>
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        {timer.status !== 'idle' && (
          <button className="animate-scale-in rounded-lg p-1 text-white/70 hover:bg-white/15 hover:text-white" aria-label="Reset timer" title="Reset" onClick={() => f.reset()}>
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
