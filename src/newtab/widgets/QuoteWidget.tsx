import { useEffect, useState } from 'react';
import { Burst, useCelebrate } from '@/components/ui';
import { Heart, RefreshCw } from 'lucide-react';
import { useInspiration, todaysQuote } from '@/stores/inspiration';
import { useS } from '@/stores/settings';
import { useUI } from '@/stores/ui';
import { cn } from '@/lib/utils';

export default function QuoteWidget() {
  const state = useInspiration();
  const s = useS();
  const openPanel = useUI((u) => u.openPanel);
  const q = todaysQuote(state);
  const fav = state.favorites.includes(q.id);
  const favBurst = useCelebrate(fav, q.id);
  const [spin, setSpin] = useState(0);

  useEffect(() => { if (state.hydrated) state.recordToday(); }, [state.hydrated, q.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <figure className={cn('group mx-auto max-w-2xl text-center transition', s.privacy.blurQuoteOnHover && 'blur-sm hover:blur-0 focus-within:blur-0')}>
      <blockquote key={q.id} className="animate-rise-in">
        <button className="text-lg italic leading-snug text-white/95 transition-colors hover:text-white" onClick={() => openPanel('inspiration')} title="Open inspiration">
          “{q.text}”
        </button>
      </blockquote>
      <figcaption className="mt-1 flex translate-y-1 items-center justify-center gap-2 text-sm text-white/75 opacity-0 transition duration-300 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100">
        <span key={q.id} className="animate-fade-in">— {q.author}</span>
        <button onClick={() => state.toggleFavorite(q.id)} className="relative rounded-full p-1 transition hover:bg-white/15 active:scale-90" aria-label={fav ? 'Remove from favourites' : 'Add to favourites'} aria-pressed={fav}>
          <Heart key={String(fav)} className={cn('h-4 w-4', fav && 'animate-pop fill-white')} />
          {favBurst > 0 && <Burst key={favBurst} count={8} distance={16} colors={['#fff', '#fda4af', '#f9a8d4']} />}
        </button>
        <button onClick={() => { setSpin((n) => n + 1); state.nextQuote(); }} className="rounded-full p-1 transition hover:bg-white/15 active:scale-90" aria-label="Show another quote">
          <RefreshCw className="h-4 w-4 transition-transform duration-500 ease-out" style={{ transform: `rotate(${spin * 360}deg)` }} />
        </button>
      </figcaption>
    </figure>
  );
}
