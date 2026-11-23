import { useState } from 'react';
import { useS, useSettings } from '@/stores/settings';
import { greetingFor, useNow } from './core';

export default function GreetingWidget() {
  const s = useS();
  const update = useSettings((st) => st.update);
  const now = useNow(60_000);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(s.name);

  return (
    <h1 className="font-display text-[clamp(1.6rem,3.4vw,2.8rem)] font-medium tracking-tight">
      <span key={greetingFor(now)} className="inline-block animate-fade-in">{greetingFor(now)}</span>
      {editing ? (
        <>
          ,{' '}
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => { update({ name: draft.trim() }); setEditing(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') { setDraft(s.name); setEditing(false); }
            }}
            className="w-[8ch] animate-scale-in border-b-2 border-white/60 bg-transparent text-center outline-none transition-colors focus:border-white"
            aria-label="Your name"
          />
        </>
      ) : s.name ? (
        <>
          ,{' '}
          <button className="rounded-lg px-1 transition-colors hover:bg-white/10" onClick={() => { setDraft(s.name); setEditing(true); }} title="Edit name">
            {s.name}
          </button>
        </>
      ) : (
        <button className="ml-2 text-white/60 hover:text-white" onClick={() => setEditing(true)}>, what's your name?</button>
      )}
      .
    </h1>
  );
}
