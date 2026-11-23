import type { BackgroundCategory, Settings } from './types';
import { hashString, hexToRgb, rgbToHex } from './utils';

export interface Photo { id: string; category: BackgroundCategory; author: string; }

/** Curated Unsplash photos (served from images.unsplash.com under the Unsplash License). */
export const PHOTOS: Photo[] = [
  { id: '1506905925346-21bda4d32df4', category: 'mountains', author: 'Kalen Emsley' },
  { id: '1464822759023-fed622ff2c3b', category: 'mountains', author: 'Kalen Emsley' },
  { id: '1454496522488-7a8e488e8606', category: 'mountains', author: 'Ivana Cajina' },
  { id: '1519681393784-d120267933ba', category: 'mountains', author: 'Benjamin Voros' },
  { id: '1486870591958-9b9d0d1dda99', category: 'mountains', author: 'Tim Stief' },
  { id: '1501785888041-af3ef285b470', category: 'landscape', author: 'Pietro De Grandi' },
  { id: '1470071459604-3b5ec3a7fe05', category: 'landscape', author: 'Lukasz Szmigiel' },
  { id: '1469474968028-56623f02e42e', category: 'landscape', author: 'David Marcu' },
  { id: '1472214103451-9374bd1c798e', category: 'landscape', author: 'Robert Lukeman' },
  { id: '1500534314209-a25ddb2bd429', category: 'landscape', author: 'Bailey Zindel' },
  { id: '1426604966848-d7adac402bff', category: 'landscape', author: 'Lukasz Szmigiel' },
  { id: '1475924156734-496f6cac6ec1', category: 'landscape', author: 'Sergey Pesterev' },
  { id: '1439066615861-d1af74d74000', category: 'landscape', author: 'Ales Krivec' },
  { id: '1441974231531-c6227db76b6e', category: 'forest', author: 'Lukasz Szmigiel' },
  { id: '1448375240586-882707db888b', category: 'forest', author: 'Sebastian Unrau' },
  { id: '1511497584788-876760111969', category: 'forest', author: 'Johannes Plenio' },
  { id: '1425913397330-cf8af2ff40a1', category: 'forest', author: 'Steven Kamenar' },
  { id: '1447752875215-b2761acb3c5d', category: 'nature', author: 'Luca Bravo' },
  { id: '1433086966358-54859d0ed716', category: 'nature', author: 'Robert Lukeman' },
  { id: '1490750967868-88aa4486c946', category: 'nature', author: 'Sergey Shmidt' },
  { id: '1465146344425-f00d5f5c8f07', category: 'nature', author: 'Mark Basarab' },
  { id: '1418065460487-3e41a6c84dc5', category: 'nature', author: 'Ales Krivec' },
  { id: '1507525428034-b723cf961d3e', category: 'ocean', author: 'Sean Oulashin' },
  { id: '1505142468610-359e7d316be0', category: 'ocean', author: 'Shifaaz Shamoon' },
  { id: '1519046904884-53103b34b206', category: 'ocean', author: 'Sean O.' },
  { id: '1502680390469-be75c86b636f', category: 'ocean', author: 'Jeremy Bishop' },
  { id: '1477959858617-67f85cf4f1df', category: 'city', author: 'Pedro Lastra' },
  { id: '1449824913935-59a10b8d2000', category: 'city', author: 'Matthew Henry' },
  { id: '1480714378408-67cf0d13bc1b', category: 'city', author: 'Pedro Lastra' },
  { id: '1494500764479-0c8f2919a3d8', category: 'minimal', author: 'Bryan Goff' },
  { id: '1502082553048-f009c37129b9', category: 'minimal', author: 'Johann Siemens' },
  { id: '1500964757637-c85e8a162699', category: 'minimal', author: 'Federico Respini' },
];

export const photoUrl = (id: string, w = 2400) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

export const BACKGROUND_CATEGORIES: { value: BackgroundCategory; label: string }[] = [
  { value: 'landscape', label: 'Landscapes' },
  { value: 'nature', label: 'Nature' },
  { value: 'mountains', label: 'Mountains' },
  { value: 'ocean', label: 'Ocean' },
  { value: 'forest', label: 'Forest' },
  { value: 'city', label: 'City' },
  { value: 'minimal', label: 'Minimal' },
];

export const GRADIENTS: Record<string, { label: string; css: string; accent: string }> = {
  dusk: { label: 'Dusk', css: 'linear-gradient(135deg,#2b2f77 0%,#6b4fa3 45%,#f0907a 100%)', accent: '#f0907a' },
  aurora: { label: 'Aurora', css: 'linear-gradient(135deg,#0f2027 0%,#203a43 40%,#2c9a7a 100%)', accent: '#34d399' },
  sand: { label: 'Sand', css: 'linear-gradient(135deg,#d6c7b0 0%,#a99682 50%,#6e6152 100%)', accent: '#d4a373' },
  ocean: { label: 'Ocean', css: 'linear-gradient(135deg,#0b3866 0%,#1e6fa8 50%,#7cc6e8 100%)', accent: '#38bdf8' },
  rose: { label: 'Rose', css: 'linear-gradient(135deg,#43264a 0%,#a8466e 50%,#f5a3a3 100%)', accent: '#f472b6' },
  forest: { label: 'Forest', css: 'linear-gradient(135deg,#1a2a1f 0%,#2f5233 50%,#94b49f 100%)', accent: '#84cc16' },
  slate: { label: 'Slate', css: 'linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#475569 100%)', accent: '#818cf8' },
  peach: { label: 'Peach', css: 'linear-gradient(135deg,#ffb88c 0%,#de6262 100%)', accent: '#fb923c' },
};

export const ACCENTS = ['#7c83ff', '#38bdf8', '#34d399', '#f59e0b', '#f472b6', '#f87171', '#a78bfa', '#2dd4bf', '#e2b07a'];

export const FONT_OPTIONS: Record<string, { label: string; css: string; google?: string }> = {
  inter: { label: 'Inter', css: "'Inter', ui-sans-serif, system-ui, sans-serif", google: 'Inter:wght@300;400;500;600;700' },
  outfit: { label: 'Outfit', css: "'Outfit', ui-sans-serif, system-ui, sans-serif", google: 'Outfit:wght@200;300;400;500;600;700' },
  manrope: { label: 'Manrope', css: "'Manrope', ui-sans-serif, system-ui, sans-serif", google: 'Manrope:wght@300;400;500;600;700' },
  playfair: { label: 'Playfair Display', css: "'Playfair Display', Georgia, serif", google: 'Playfair+Display:wght@400;500;600;700' },
  lora: { label: 'Lora', css: "'Lora', Georgia, serif", google: 'Lora:wght@400;500;600;700' },
  dmserif: { label: 'DM Serif Display', css: "'DM Serif Display', Georgia, serif", google: 'DM+Serif+Display' },
  space: { label: 'Space Grotesk', css: "'Space Grotesk', ui-sans-serif, sans-serif", google: 'Space+Grotesk:wght@300;400;500;600;700' },
  nunito: { label: 'Nunito', css: "'Nunito', ui-rounded, ui-sans-serif, sans-serif", google: 'Nunito:wght@300;400;600;700' },
  mono: { label: 'JetBrains Mono', css: "'JetBrains Mono', ui-monospace, monospace", google: 'JetBrains+Mono:wght@300;400;500;700' },
  system: { label: 'System', css: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" },
};

/** Pick the photo for now given settings. Deterministic per day/hour; random per tab. */
export function pickPhoto(s: Settings, seed: string): Photo {
  const pool = PHOTOS.filter((p) => s.backgroundCategories.includes(p.category));
  const list = pool.length ? pool : PHOTOS;
  return list[hashString(seed) % list.length];
}

export function rotationSeed(s: Settings) {
  const d = new Date();
  if (s.backgroundRotation === 'hourly') return `${d.toDateString()}-${d.getHours()}`;
  if (s.backgroundRotation === 'tab') return String(Math.random());
  return d.toDateString();
}

/** Average a downscaled image to derive a pleasant accent colour. */
export async function extractAccent(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 48; c.height = 48;
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, 48, 48);
        const { data } = ctx.getImageData(0, 0, 48, 48);
        // weight saturated mid-tones more than greys
        let r = 0, g = 0, b = 0, wsum = 0;
        for (let i = 0; i < data.length; i += 4) {
          const R = data[i], G = data[i + 1], B = data[i + 2];
          const max = Math.max(R, G, B), min = Math.min(R, G, B);
          const sat = max === 0 ? 0 : (max - min) / max;
          const lum = (max + min) / 510;
          const w = 0.05 + sat * sat * (1 - Math.abs(lum - 0.55) * 1.4);
          if (w <= 0) continue;
          r += R * w; g += G * w; b += B * w; wsum += w;
        }
        if (!wsum) return resolve(null);
        resolve(tuneAccent(rgbToHex(r / wsum, g / wsum, b / wsum)));
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Push a colour toward a vivid, readable accent (HSL: S≥55%, L in 55–68%). */
export function tuneAccent(hex: string) {
  let [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0; const l0 = (max + min) / 2;
  const d = max - min;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  const s = Math.max(0.55, d ? d / (1 - Math.abs(2 * l0 - 1)) : 0.55);
  const l = Math.min(0.68, Math.max(0.55, l0));
  const c = (1 - Math.abs(2 * l - 1)) * Math.min(1, s);
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

let fontLink: HTMLLinkElement | null = null;
/** Apply theme mode, accent and fonts to the document root. */
export function applyAppearance(s: Settings, bgAccent: string | null) {
  const root = document.documentElement;
  const dark = s.theme === 'dark' || (s.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', dark);
  const accent = s.autoAccent && bgAccent ? bgAccent : s.accent;
  root.style.setProperty('--accent', hexToRgb(accent).join(' '));
  const fd = FONT_OPTIONS[s.fontDisplay] ?? FONT_OPTIONS.inter;
  const fb = FONT_OPTIONS[s.fontBody] ?? FONT_OPTIONS.inter;
  root.style.setProperty('--font-display', fd.css);
  root.style.setProperty('--font-body', fb.css);
  const families = [fd.google, fb.google].filter(Boolean);
  const href = families.length ? `https://fonts.googleapis.com/css2?${[...new Set(families)].map((f) => `family=${f}`).join('&')}&display=swap` : '';
  if (!fontLink) {
    fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);
  }
  if (fontLink.href !== href) fontLink.href = href;
}
