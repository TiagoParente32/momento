import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, Home, ShieldBan } from 'lucide-react';
import '@/styles.css';
import { KEYS, getItem, isExtension, onKeyChange } from '@/lib/storage';
import { GRADIENTS, PHOTOS, photoUrl } from '@/lib/appearance';
import { dailyPick, formatMs } from '@/lib/utils';
import { remainingMs, PHASE_LABEL, type FocusData } from '@/lib/focus-core';
import type { Settings } from '@/lib/types';
import { RollingDigits } from '@/components/ui';

const LINES = [
  'The things you care about are worth your full attention.',
  'This moment is yours. Spend it on what matters.',
  'Deep work now, free time later.',
  'Small focused steps add up to big things.',
  'You chose focus earlier. Trust that version of you.',
  'Distraction can wait. Your goals can’t.',
  'One thing at a time, done well.',
  'Breathe in. Refocus. Carry on.',
];

function Blocked() {
  const params = new URLSearchParams(location.search);
  const site = params.get('site') ?? 'This site';
  const reason = params.get('reason') ?? 'Blocked by Momento';
  const [focus, setFocus] = useState<Partial<FocusData> | null>(null);
  const [bg, setBg] = useState<string>(GRADIENTS.dusk.css);
  const [name, setName] = useState('');
  const [, tick] = useState(0);

  useEffect(() => {
    getItem<Partial<FocusData>>(KEYS.focus).then((f) => setFocus(f ?? null));
    const off = onKeyChange(KEYS.focus, (v) => setFocus((v as Partial<FocusData>) ?? null));
    getItem<{ settings: Settings }>(KEYS.settings).then((s) => {
      setName(s?.settings?.name ?? '');
      const p = dailyPick(PHOTOS.filter((x) => x.category === 'nature' || x.category === 'landscape'), 'blocked');
      if (p) {
        const img = new Image();
        img.onload = () => setBg(`center/cover no-repeat url("${photoUrl(p.id, 1920)}")`);
        img.src = photoUrl(p.id, 1920);
      }
    });
    const t = setInterval(() => tick((n) => n + 1), 1000);
    document.title = `${site} is blocked – Momento`;
    return () => { off(); clearInterval(t); };
  }, [site]);

  const timer = focus?.timer;
  const inFocus = timer && timer.status !== 'idle';
  const line = dailyPick(LINES, site) ?? LINES[0];

  const backToMomento = () => {
    if (isExtension) location.href = chrome.runtime.getURL('newtab.html');
    else location.href = '/newtab.html';
  };

  return (
    <div className="dash-text relative grid h-full place-items-center" style={{ background: bg }}>
      <div className="absolute inset-0 bg-black/45" />
      <main className="relative z-10 max-w-xl px-6 text-center animate-fade-in">
        <div className="glass mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl"><ShieldBan className="h-8 w-8" /></div>
        <p className="text-sm uppercase tracking-[0.3em] text-white/70">Stay focused{name ? `, ${name}` : ''}</p>
        <h1 className="mt-3 font-display text-4xl font-semibold">{site} is blocked</h1>
        <p className="mt-2 text-white/80">{reason}</p>
        {inFocus && timer && (
          <div className="glass mx-auto mt-8 inline-flex flex-col items-center rounded-2xl px-8 py-4">
            <span className="text-xs uppercase tracking-widest text-white/70">{timer.status === 'paused' ? 'Focus paused' : `${PHASE_LABEL[timer.phase]} remaining`}</span>
            <span className="font-display text-5xl font-semibold tabular-nums"><RollingDigits text={formatMs(remainingMs(timer))} /></span>
          </div>
        )}
        <p className="mt-8 text-xl font-light italic text-white/90">“{line}”</p>
        <div className="mt-10 flex justify-center gap-3">
          <button onClick={() => (history.length > 1 ? history.back() : backToMomento())} className="glass inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm hover:bg-white/15">
            <ArrowLeft className="h-4 w-4" /> Go back
          </button>
          <button onClick={backToMomento} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white/90">
            <Home className="h-4 w-4" /> Back to Momento
          </button>
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Blocked />
  </StrictMode>,
);
