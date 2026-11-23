import { useEffect, useMemo, useRef, useState } from 'react';
import { useS, useSettings } from '@/stores/settings';
import { useUI } from '@/stores/ui';
import { useFocus } from '@/stores/focus';
import { cn } from '@/lib/utils';
import { GRADIENTS, PHOTOS, extractAccent, photoUrl, pickPhoto, rotationSeed, tuneAccent } from '@/lib/appearance';
import { hashString } from '@/lib/utils';

/**
 * Full-bleed background: rotating Unsplash photo, custom upload, gradient or solid.
 * Crossfades between images, skips broken photos, and publishes an accent colour
 * extracted from the image (used when "match accent to background" is on).
 */
export function Background() {
  const s = useS();
  const inFocus = useUI((u) => u.panel === 'focus');
  const focusRunning = useFocus((f) => f.timer.status === 'running' && f.timer.phase === 'work');
  // The skip count is remembered for the current rotation period (today / this hour),
  // so pressing "next" sticks across new tabs instead of snapping back.
  const [seedBump, setSeedBump] = useState(() => loadBump(s.backgroundRotation === 'tab' ? null : rotationSeed(s)));
  const [failed, setFailed] = useState<Set<string>>(new Set());
  // Start from the background boot.js already painted, so there is no placeholder or fade on load.
  const [layers, setLayers] = useState<{ src: string; key: number; instant?: boolean }[]>(() => {
    const b = loadBoot();
    return b?.kind === 'image' ? [{ src: b.bg, key: 0, instant: true }] : [];
  });
  const keyRef = useRef(0);

  // Expose a way to skip to the next photo (used by settings "Next photo" button + dashboard).
  useEffect(() => {
    const onNext = () => setSeedBump((n) => {
      const st = useSettings.getState().settings;
      if (st.backgroundRotation !== 'tab') saveBump(rotationSeed(st), n + 1);
      return n + 1;
    });
    window.addEventListener('momento:next-bg', onNext);
    return () => window.removeEventListener('momento:next-bg', onNext);
  }, []);

  const target = useMemo(() => {
    if (s.backgroundMode === 'custom' && s.customBackgrounds.length) {
      const pinned = s.customBackgrounds.find((c) => c.id === s.pinnedBackground);
      const pick = pinned ?? s.customBackgrounds[hashString(rotationSeed(s) + seedBump) % s.customBackgrounds.length];
      return { kind: 'image' as const, src: pick.dataUrl, credit: null };
    }
    if (s.backgroundMode === 'gradient') return { kind: 'css' as const, css: (GRADIENTS[s.gradient] ?? GRADIENTS.dusk).css, accent: (GRADIENTS[s.gradient] ?? GRADIENTS.dusk).accent };
    if (s.backgroundMode === 'solid') return { kind: 'css' as const, css: s.solidColor, accent: null };
    // photo mode
    const pinned = s.pinnedBackground && PHOTOS.find((p) => p.id === s.pinnedBackground);
    let photo = pinned || pickPhoto(s, rotationSeed(s) + (seedBump ? `#${seedBump}` : ''));
    let guard = 0;
    while (failed.has(photo.id) && guard++ < PHOTOS.length) photo = pickPhoto(s, photo.id + guard);
    return { kind: 'image' as const, src: photoUrl(photo.id), photoId: photo.id, credit: { author: photo.author, link: `https://unsplash.com/photos/${photo.id}` } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.backgroundMode, s.customBackgrounds, s.pinnedBackground, s.gradient, s.solidColor, s.backgroundCategories.join(), s.backgroundRotation, seedBump, failed]);

  useEffect(() => {
    if (target.kind === 'css') {
      useUI.setState({ bgAccent: target.accent ? tuneAccent(target.accent) : null, bgCredit: null });
      setLayers([]);
      saveBoot({ kind: 'css', bg: target.css, dim: s.dimBackground });
      document.getElementById('boot-bg')?.remove();
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      const key = ++keyRef.current;
      // Same image as the boot cache: keep it as-is instead of crossfading over itself.
      setLayers((ls) => (ls.length === 1 && ls[0].instant && ls[0].src === target.src ? ls : [...ls.slice(-1), { src: target.src, key }]));
      saveBoot({ kind: 'image', bg: target.src, dim: s.dimBackground });
      document.getElementById('boot-bg')?.remove();
      useUI.setState({ bgCredit: target.credit });
      extractAccent(target.src).then((a) => !cancelled && useUI.setState({ bgAccent: a }));
    };
    img.onerror = () => {
      if (cancelled) return;
      if ('photoId' in target && target.photoId) setFailed((f) => new Set(f).add(target.photoId!));
    };
    img.src = target.src;
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  // Keep the boot cache's dim in sync when only the dim slider changes.
  useEffect(() => {
    const b = loadBoot();
    if (b && b.dim !== s.dimBackground) saveBoot({ ...b, dim: s.dimBackground });
  }, [s.dimBackground]);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-zinc-900" aria-hidden>
      <div className={cn('bg-stage', inFocus && 'is-focus', inFocus && focusRunning && 'is-running')}>
        {target.kind === 'css' ? (
          <div className="absolute inset-0" style={{ background: target.css }} />
        ) : (
          <>
            {/* soft placeholder while the first image loads (only when nothing is cached) */}
            {!layers.length && <div className="absolute inset-0" style={{ background: GRADIENTS.slate.css }} />}
            {layers.map((l, i) => (
              <FadeLayer key={l.key} src={l.src} top={i === layers.length - 1} instant={l.instant} />
            ))}
          </>
        )}
      </div>
      <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${s.dimBackground})` }} />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/25 to-transparent" />
    </div>
  );
}

type BootCache = { kind: 'image' | 'css'; bg: string; dim: number };
const BOOT_KEY = 'momento:boot'; // read synchronously by public/boot.js
function loadBoot(): BootCache | null {
  try {
    const v = JSON.parse(localStorage.getItem(BOOT_KEY) ?? 'null');
    return v && typeof v.bg === 'string' ? v : null;
  } catch { return null; }
}
function saveBoot(v: BootCache) {
  // Huge custom-upload data URLs aren't worth duplicating into localStorage.
  if (v.bg.length > 1_500_000) { try { localStorage.removeItem(BOOT_KEY); } catch { /* storage unavailable */ } return; }
  try { localStorage.setItem(BOOT_KEY, JSON.stringify(v)); } catch { /* storage unavailable / quota */ }
}

const BUMP_KEY = 'momento:bg-bump';
function loadBump(seed: string | null): number {
  if (!seed) return 0;
  try {
    const v = JSON.parse(localStorage.getItem(BUMP_KEY) ?? 'null');
    return v && v.seed === seed && typeof v.bump === 'number' ? v.bump : 0;
  } catch { return 0; }
}
function saveBump(seed: string, bump: number) {
  try { localStorage.setItem(BUMP_KEY, JSON.stringify({ seed, bump })); } catch { /* storage unavailable */ }
}

function FadeLayer({ src, top, instant }: { src: string; top: boolean; instant?: boolean }) {
  const [visible, setVisible] = useState(!!instant);
  useEffect(() => { const t = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(t); }, []);
  const shown = visible || !top;
  return <div className={cn('bg-layer', shown && 'is-shown')} style={{ backgroundImage: `url("${src}")`, opacity: shown ? 1 : 0 }} />;
}
