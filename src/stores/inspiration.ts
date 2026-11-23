import { createPersisted } from '@/lib/persist';
import { KEYS } from '@/lib/storage';
import { dailyPick, todayISO, uid } from '@/lib/utils';
import { MANTRAS, QUOTES } from '@/lib/quotes';
import type { ISODate, Quote } from '@/lib/types';

export type QuoteSource = 'all' | 'builtin' | 'custom' | 'favorites';
export type MantraSource = 'all' | 'builtin' | 'custom';

interface InspirationData {
  customQuotes: Quote[];
  favorites: string[];
  history: { date: ISODate; quoteId: string }[];
  customMantras: string[];
  source: QuoteSource;
  mantraSource: MantraSource;
  override: { date: ISODate; quoteId: string } | null;
  mantraOverride: { date: ISODate; index: number } | null;
}

const defaults: InspirationData = {
  customQuotes: [],
  favorites: [],
  history: [],
  customMantras: [],
  source: 'all',
  mantraSource: 'all',
  override: null,
  mantraOverride: null,
};

export const allQuotes = (s: Pick<InspirationData, 'customQuotes'>): Quote[] => [...QUOTES, ...s.customQuotes];

export const findQuote = (s: Pick<InspirationData, 'customQuotes'>, id: string) => allQuotes(s).find((q) => q.id === id);

/** Quotes eligible under the chosen source (falls back to all built-ins if empty). */
export function quotePool(s: Pick<InspirationData, 'customQuotes' | 'favorites' | 'source'>): Quote[] {
  const all = allQuotes(s);
  let pool: Quote[];
  switch (s.source) {
    case 'builtin': pool = QUOTES; break;
    case 'custom': pool = s.customQuotes; break;
    case 'favorites': pool = all.filter((q) => s.favorites.includes(q.id)); break;
    default: pool = all;
  }
  return pool.length ? pool : QUOTES;
}

export function mantraPool(s: Pick<InspirationData, 'customMantras' | 'mantraSource'>): string[] {
  const pool = s.mantraSource === 'builtin' ? MANTRAS : s.mantraSource === 'custom' ? s.customMantras : [...MANTRAS, ...s.customMantras];
  return pool.length ? pool : MANTRAS;
}

export function todaysQuote(s: InspirationData): Quote {
  const today = todayISO();
  if (s.override?.date === today) {
    const q = findQuote(s, s.override.quoteId);
    if (q) return q;
  }
  return dailyPick(quotePool(s), 'quote', today) ?? QUOTES[0];
}

export function todaysMantra(s: InspirationData): string {
  const today = todayISO();
  const pool = mantraPool(s);
  if (s.mantraOverride?.date === today) return pool[s.mantraOverride.index % pool.length];
  return dailyPick(pool, 'mantra', today) ?? MANTRAS[0];
}

const pushHistory = (history: InspirationData['history'], date: ISODate, quoteId: string) => {
  const rest = history.filter((h) => !(h.date === date && h.quoteId === quoteId));
  return [...rest, { date, quoteId }].slice(-90);
};

export const useInspiration = createPersisted(KEYS.inspiration, defaults, (set, get) => ({
  /** Record today's quote in history once per day. */
  recordToday() {
    const s = get();
    const today = todayISO();
    const q = todaysQuote(s);
    if (s.history.some((h) => h.date === today && h.quoteId === q.id)) return;
    set({ history: pushHistory(s.history, today, q.id) });
  },
  /** Pick a different random quote for today. */
  nextQuote() {
    const s = get();
    const pool = quotePool(s);
    const current = todaysQuote(s).id;
    const options = pool.length > 1 ? pool.filter((q) => q.id !== current) : pool;
    const q = options[Math.floor(Math.random() * options.length)];
    const today = todayISO();
    set({ override: { date: today, quoteId: q.id }, history: pushHistory(s.history, today, q.id) });
  },
  showQuote(id: string) {
    const today = todayISO();
    set((s) => ({ override: { date: today, quoteId: id }, history: pushHistory(s.history, today, id) }));
  },
  nextMantra() {
    const s = get();
    const pool = mantraPool(s);
    const cur = pool.indexOf(todaysMantra(s));
    let idx = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && idx === cur) idx = (idx + 1) % pool.length;
    set({ mantraOverride: { date: todayISO(), index: idx } });
  },
  toggleFavorite(id: string) {
    set((s) => ({ favorites: s.favorites.includes(id) ? s.favorites.filter((f) => f !== id) : [...s.favorites, id] }));
  },
  addQuote(text: string, author: string) {
    const q: Quote = { id: 'c' + uid(), text: text.trim(), author: author.trim() || 'Unknown', custom: true };
    set((s) => ({ customQuotes: [...s.customQuotes, q] }));
    return q;
  },
  updateQuote(id: string, patch: Partial<Pick<Quote, 'text' | 'author'>>) {
    set((s) => ({ customQuotes: s.customQuotes.map((q) => (q.id === id ? { ...q, ...patch } : q)) }));
  },
  removeQuote(id: string) {
    set((s) => ({
      customQuotes: s.customQuotes.filter((q) => q.id !== id),
      favorites: s.favorites.filter((f) => f !== id),
      override: s.override?.quoteId === id ? null : s.override,
    }));
  },
  addMantra(text: string) {
    const t = text.trim();
    if (!t) return;
    set((s) => ({ customMantras: [...s.customMantras, t] }));
  },
  updateMantra(index: number, text: string) {
    set((s) => ({ customMantras: s.customMantras.map((m, i) => (i === index ? text.trim() : m)) }));
  },
  removeMantra(index: number) {
    set((s) => ({ customMantras: s.customMantras.filter((_, i) => i !== index), mantraOverride: null }));
  },
  setSource(source: QuoteSource) { set({ source, override: null }); },
  setMantraSource(mantraSource: MantraSource) { set({ mantraSource, mantraOverride: null }); },
  clearHistory() { set({ history: [] }); },
}));
