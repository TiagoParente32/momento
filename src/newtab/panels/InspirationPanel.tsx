import { useState, type ReactNode } from 'react';
import { Heart, Quote as QuoteIcon, RefreshCw, Trash2, Pencil, Plus, Shuffle, Check, X } from 'lucide-react';
import { PanelFrame } from '@/components/PanelFrame';
import { Button, EmptyState, Field, IconButton, Input, Segmented, Tabs, Textarea, confirmDialog, toast } from '@/components/ui';
import { useInspiration, todaysQuote, todaysMantra, findQuote, allQuotes, type QuoteSource, type MantraSource } from '@/stores/inspiration';
import { MANTRAS, QUOTES } from '@/lib/quotes';
import { cn, fromISODate } from '@/lib/utils';
import type { Quote } from '@/lib/types';

type Tab = 'today' | 'favorites' | 'history' | 'custom' | 'mantras';

export default function InspirationPanel() {
  const [tab, setTab] = useState<Tab>('today');
  return (
    <PanelFrame title="Inspiration" icon={<QuoteIcon className="h-4 w-4" />}>
      <div className="px-5 pt-2">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'today', label: 'Today' },
            { value: 'favorites', label: 'Favourites' },
            { value: 'history', label: 'History' },
            { value: 'custom', label: 'My quotes' },
            { value: 'mantras', label: 'Mantras' },
          ]}
        />
      </div>
      <div className="p-5">
        {tab === 'today' && <TodayTab />}
        {tab === 'favorites' && <FavoritesTab />}
        {tab === 'history' && <HistoryTab />}
        {tab === 'custom' && <CustomTab />}
        {tab === 'mantras' && <MantrasTab />}
      </div>
    </PanelFrame>
  );
}

function QuoteCard({ q, actions }: { q: Quote; actions?: ReactNode }) {
  const st = useInspiration();
  const fav = st.favorites.includes(q.id);
  return (
    <div className="card flex items-start gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm italic leading-relaxed">“{q.text}”</p>
        <p className="mt-1 text-xs text-muted">— {q.author}</p>
      </div>
      <IconButton label={fav ? 'Remove from favourites' : 'Add to favourites'} aria-pressed={fav} onClick={() => st.toggleFavorite(q.id)}>
        <Heart className={cn('h-4 w-4', fav && 'fill-accent text-accent')} />
      </IconButton>
      {actions}
    </div>
  );
}

function TodayTab() {
  const st = useInspiration();
  const q = todaysQuote(st);
  const m = todaysMantra(st);
  const fav = st.favorites.includes(q.id);
  const [random, setRandom] = useState<Quote | null>(null);
  const roll = () => {
    const all = allQuotes(st);
    setRandom(all[Math.floor(Math.random() * all.length)]);
  };
  return (
    <div className="space-y-6">
      <section>
        <p className="section-title mb-2">Quote of the day</p>
        <div className="card p-6">
          <p className="font-display text-2xl leading-snug">“{q.text}”</p>
          <p className="mt-2 text-sm text-muted">— {q.author}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => st.toggleFavorite(q.id)}>
              <Heart className={cn('h-4 w-4', fav && 'fill-accent text-accent')} /> {fav ? 'Favourited' : 'Favourite'}
            </Button>
            <Button size="sm" onClick={() => st.nextQuote()}><RefreshCw className="h-4 w-4" /> New quote</Button>
            <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(`“${q.text}” — ${q.author}`); toast('Copied to clipboard', 'success'); }}>Copy</Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted">Daily quote from</span>
          <Segmented<QuoteSource>
            value={st.source}
            onChange={st.setSource}
            options={[{ value: 'all', label: 'All' }, { value: 'builtin', label: 'Built-in' }, { value: 'custom', label: 'Mine' }, { value: 'favorites', label: 'Favourites' }]}
          />
        </div>
      </section>

      <section>
        <p className="section-title mb-2">Mantra of the day</p>
        <div className="card flex items-center gap-3 p-5">
          <p className="flex-1 text-lg font-medium">{m}</p>
          <IconButton label="Another mantra" onClick={() => st.nextMantra()}><RefreshCw className="h-4 w-4" /></IconButton>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="section-title">Random quote generator</p>
          <Button size="sm" variant="primary" onClick={roll}><Shuffle className="h-4 w-4" /> Generate</Button>
        </div>
        {random ? (
          <QuoteCard q={random} actions={<Button size="sm" variant="ghost" onClick={() => { st.showQuote(random.id); toast('Set as today’s quote', 'success'); }}>Use today</Button>} />
        ) : (
          <p className="text-sm text-muted">Press generate for a random pick from {allQuotes(st).length} quotes.</p>
        )}
      </section>
    </div>
  );
}

function FavoritesTab() {
  const st = useInspiration();
  const favs = st.favorites.map((id) => findQuote(st, id)).filter(Boolean) as Quote[];
  if (!favs.length) return <EmptyState icon={<Heart className="h-5 w-5" />} title="No favourites yet" description="Tap the heart on any quote to save it here." />;
  return (
    <div className="space-y-2">
      {favs.map((q) => (
        <QuoteCard key={q.id} q={q} actions={<Button size="sm" variant="ghost" onClick={() => { st.showQuote(q.id); toast('Set as today’s quote', 'success'); }}>Show</Button>} />
      ))}
    </div>
  );
}

function HistoryTab() {
  const st = useInspiration();
  const items = [...st.history].reverse().map((h) => ({ ...h, q: findQuote(st, h.quoteId) })).filter((h) => h.q);
  if (!items.length) return <EmptyState icon={<QuoteIcon className="h-5 w-5" />} title="No history yet" description="Quotes you see will be listed here." />;
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={async () => { if (await confirmDialog({ title: 'Clear quote history?', danger: true, confirmLabel: 'Clear' })) st.clearHistory(); }}>Clear history</Button>
      </div>
      {items.map((h, i) => (
        <div key={h.date + h.quoteId + i}>
          <p className="mb-1 text-xs text-muted">{fromISODate(h.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
          <QuoteCard q={h.q!} />
        </div>
      ))}
    </div>
  );
}

function CustomTab() {
  const st = useInspiration();
  const [text, setText] = useState('');
  const [author, setAuthor] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    if (text.trim().length < 3) { setErr('Write a quote first'); return; }
    if (editing) { st.updateQuote(editing, { text: text.trim(), author: author.trim() || 'Unknown' }); toast('Quote updated', 'success'); }
    else { st.addQuote(text, author); toast('Quote added', 'success'); }
    setText(''); setAuthor(''); setEditing(null); setErr(null);
  };

  return (
    <div className="space-y-5">
      <form className="card space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label={editing ? 'Edit quote' : 'Add a quote'} error={err}>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Something that moves you…" maxLength={400} />
        </Field>
        <Field label="Author"><Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Optional" maxLength={80} /></Field>
        <div className="flex justify-end gap-2">
          {editing && <Button variant="ghost" onClick={() => { setEditing(null); setText(''); setAuthor(''); }}>Cancel</Button>}
          <Button type="submit" variant="primary"><Plus className="h-4 w-4" /> {editing ? 'Save' : 'Add quote'}</Button>
        </div>
      </form>
      {st.customQuotes.length === 0 ? (
        <EmptyState icon={<QuoteIcon className="h-5 w-5" />} title="No custom quotes" description={`You have ${QUOTES.length} built-in quotes. Add your own to mix them in.`} />
      ) : (
        <div className="space-y-2">
          {st.customQuotes.map((q) => (
            <QuoteCard
              key={q.id}
              q={q}
              actions={
                <>
                  <IconButton label="Edit quote" onClick={() => { setEditing(q.id); setText(q.text); setAuthor(q.author); }}><Pencil className="h-4 w-4" /></IconButton>
                  <IconButton label="Delete quote" onClick={async () => { if (await confirmDialog({ title: 'Delete this quote?', danger: true, confirmLabel: 'Delete' })) st.removeQuote(q.id); }}><Trash2 className="h-4 w-4" /></IconButton>
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MantrasTab() {
  const st = useInspiration();
  const [text, setText] = useState('');
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted">Daily mantra from</span>
        <Segmented<MantraSource> value={st.mantraSource} onChange={st.setMantraSource} options={[{ value: 'all', label: 'All' }, { value: 'builtin', label: 'Built-in' }, { value: 'custom', label: 'Mine' }]} />
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { st.addMantra(text); setText(''); toast('Mantra added', 'success'); } }}>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a personal mantra or affirmation" maxLength={120} aria-label="New mantra" />
        <Button type="submit" variant="primary"><Plus className="h-4 w-4" /> Add</Button>
      </form>
      <section>
        <p className="section-title mb-2">My mantras</p>
        {st.customMantras.length === 0 ? <p className="text-sm text-muted">None yet.</p> : (
          <ul className="space-y-1.5">
            {st.customMantras.map((m, i) => (
              <li key={i} className="card flex items-center gap-2 px-3 py-2">
                {editIdx === i ? (
                  <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); if (editText.trim()) st.updateMantra(i, editText); setEditIdx(null); }}>
                    <Input autoFocus value={editText} onChange={(e) => setEditText(e.target.value)} aria-label="Edit mantra" />
                    <IconButton label="Save" type="submit"><Check className="h-4 w-4" /></IconButton>
                    <IconButton label="Cancel" onClick={() => setEditIdx(null)}><X className="h-4 w-4" /></IconButton>
                  </form>
                ) : (
                  <>
                    <span className="flex-1 text-sm">{m}</span>
                    <IconButton label="Edit mantra" onClick={() => { setEditIdx(i); setEditText(m); }}><Pencil className="h-4 w-4" /></IconButton>
                    <IconButton label="Delete mantra" onClick={() => st.removeMantra(i)}><Trash2 className="h-4 w-4" /></IconButton>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <p className="section-title mb-2">Built-in ({MANTRAS.length})</p>
        <div className="flex flex-wrap gap-1.5">
          {MANTRAS.map((m) => <span key={m} className="chip bg-ink/5 text-ink/80">{m}</span>)}
        </div>
      </section>
    </div>
  );
}
