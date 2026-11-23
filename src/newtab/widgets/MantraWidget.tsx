import { RefreshCw } from 'lucide-react';
import { useInspiration, todaysMantra } from '@/stores/inspiration';

export default function MantraWidget() {
  const state = useInspiration();
  const m = todaysMantra(state);
  return (
    <div className="group mx-auto mt-4 flex items-center justify-center gap-2">
      <p className="text-xl font-medium tracking-wide text-white/90">{m}</p>
      <button onClick={() => state.nextMantra()} className="rounded-full p-1 opacity-0 transition hover:bg-white/15 group-hover:opacity-100 focus:opacity-100" aria-label="Show another mantra">
        <RefreshCw className="h-4 w-4" />
      </button>
    </div>
  );
}
