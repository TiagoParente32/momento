import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { useDaily } from '@/stores/daily';
import { todayISO, cn } from '@/lib/utils';
import { Burst, useCelebrate } from '@/components/ui';

export default function GoalWidget() {
  const goals = useDaily((s) => s.goals);
  const { setGoal, toggleGoal } = useDaily.getState();
  const goal = goals.find((g) => g.date === todayISO());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const burst = useCelebrate(!!goal?.done, goal?.date);

  if (!goal || editing) {
    return (
      <form
        className="mx-auto mt-6 w-full max-w-xl animate-fade-in"
        onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { setGoal(draft); setEditing(false); } }}
      >
        <label htmlFor="goal" className="block text-xl font-medium text-white/90">What is your main focus for today?</label>
        <input
          id="goal"
          autoFocus={editing}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
          onBlur={() => editing && !draft.trim() && setEditing(false)}
          className="mt-2 w-full border-b-2 border-white/50 bg-transparent py-1 text-center text-2xl outline-none transition focus:border-white"
          maxLength={140}
        />
      </form>
    );
  }

  return (
    <div className="group mx-auto mt-6 max-w-xl animate-fade-in">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Today</p>
      <div className="mt-1 flex items-center justify-center gap-3">
        <button
          onClick={() => toggleGoal()}
          className={cn('relative grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 border-white/80 transition duration-300 ease-spring hover:scale-110 active:scale-90', goal.done && 'bg-white text-zinc-900')}
          aria-label={goal.done ? 'Mark goal not done' : 'Mark goal done'}
        >
          {goal.done && <Check className="h-4 w-4 animate-pop" strokeWidth={3} />}
          {burst > 0 && <Burst key={burst} count={14} distance={34} />}
        </button>
        <span className={cn('strike text-2xl font-medium', goal.done && 'is-done')}>{goal.text}</span>
        <span className="flex gap-1 opacity-0 transition duration-300 group-hover:opacity-100">
          <button className="rounded-md p-1 hover:bg-white/15" aria-label="Edit goal" onClick={() => { setDraft(goal.text); setEditing(true); }}>
            <Pencil className="h-4 w-4" />
          </button>
          <button className="rounded-md p-1 hover:bg-white/15" aria-label="Clear goal" onClick={() => setGoal('')}>
            <X className="h-4 w-4" />
          </button>
        </span>
      </div>
      {goal.done && <p className="mt-2 text-sm text-white/80 animate-scale-in">Nice work! 🎉</p>}
    </div>
  );
}
