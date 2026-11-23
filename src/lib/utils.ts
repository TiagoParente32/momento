export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, '').slice(0, 16);

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export const pad = (n: number) => String(n).padStart(2, '0');

/** Local date as YYYY-MM-DD */
export const toISODate = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISODate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const todayISO = () => toISODate(new Date());
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const startOfWeek = (d: Date, weekStartsOn: 0 | 1 = 1) => {
  const x = startOfDay(d);
  const diff = (x.getDay() - weekStartsOn + 7) % 7;
  return addDays(x, -diff);
};
export const daysBetween = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
export const sameDay = (a: Date, b: Date) => toISODate(a) === toISODate(b);

/** Deterministic integer from a string (for daily rotation). */
export const hashString = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
export function dailyPick<T>(arr: T[], salt = '', date = todayISO()): T | undefined {
  return arr.length ? arr[hashString(date + salt) % arr.length] : undefined;
}

export const formatMinutes = (min: number) => {
  const m = Math.round(min);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
};

export const formatMs = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

export const normalizeDomain = (input: string) => {
  let s = input.trim().toLowerCase();
  if (!s) return '';
  try {
    if (!/^[a-z]+:\/\//.test(s)) s = 'https://' + s;
    s = new URL(s).hostname;
  } catch { return ''; }
  return s.replace(/^www\./, '');
};

export const normalizeUrl = (input: string) => {
  const s = input.trim();
  if (!s) return '';
  return /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : 'https://' + s;
};

export const faviconFor = (url: string, size = 64) => {
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=${size}`;
  } catch { return ''; }
};

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...a: A) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const rgbToHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');

export const timeToMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };

/** Is `now` inside [start,end) on one of `days`? Handles overnight ranges. */
export const inTimeWindow = (now: Date, days: number[], start: string, end: string) => {
  const mins = now.getHours() * 60 + now.getMinutes();
  const s = timeToMinutes(start), e = timeToMinutes(end);
  if (s === e) return days.includes(now.getDay());
  if (s < e) return days.includes(now.getDay()) && mins >= s && mins < e;
  if (mins >= s) return days.includes(now.getDay());
  const yesterday = (now.getDay() + 6) % 7;
  return mins < e && days.includes(yesterday);
};

export const download = (filename: string, content: string, type = 'application/json') => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const PALETTE = ['#6366f1', '#ec4899', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#8b5cf6', '#ef4444', '#64748b'];
