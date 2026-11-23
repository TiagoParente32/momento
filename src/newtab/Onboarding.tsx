import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useSettings } from '@/stores/settings';

/** First-run: ask for the user's name. Everything else works with sensible defaults. */
export function Onboarding() {
  const update = useSettings((s) => s.update);
  const [name, setName] = useState('');
  const finish = () => update({ name: name.trim(), onboarded: true });
  return (
    <div className="dash-text fixed inset-0 z-[90] grid place-items-center bg-black/30 backdrop-blur-sm animate-fade-in">
      <form className="w-full max-w-lg px-6 text-center" onSubmit={(e) => { e.preventDefault(); finish(); }}>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/70">Momento</p>
        <h1 className="mt-3 font-display text-4xl font-medium">Make every moment count.</h1>
        <label htmlFor="ob-name" className="mt-10 block text-xl text-white/90">Hello, what's your name?</label>
        <div className="mt-3 flex items-center border-b-2 border-white/60 focus-within:border-white">
          <input id="ob-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} className="flex-1 bg-transparent py-2 text-center text-3xl outline-none" maxLength={40} />
          <button type="submit" className="rounded-full p-2 hover:bg-white/15" aria-label="Continue"><ArrowRight className="h-6 w-6" /></button>
        </div>
        <button type="button" onClick={finish} className="mt-6 text-sm text-white/60 hover:text-white">Skip for now</button>
      </form>
    </div>
  );
}
