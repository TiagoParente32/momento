import { Suspense, useEffect, useState } from 'react';
import { Background } from './Background';
import { Dashboard } from './Dashboard';
import { PANELS, FULLSCREEN_PANELS, WIDE_PANELS } from './registry';
import { Onboarding } from './Onboarding';
import { useSettings, useS } from '@/stores/settings';
import { useUI } from '@/stores/ui';
import { applyAppearance } from '@/lib/appearance';
import { ConfirmHost, Spinner, ToastHost } from '@/components/ui';
import { cn } from '@/lib/utils';
import { startAutoSync } from '@/lib/sync';

export function App() {
  const hydrated = useSettings((s) => s.hydrated);
  const s = useS();
  const { panel, closePanel, bgAccent, openPanel } = useUI();

  useEffect(() => { applyAppearance(s, bgAccent); }, [s, bgAccent]);
  useEffect(() => { void startAutoSync(); }, []);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = () => applyAppearance(useSettings.getState().settings, useUI.getState().bgAccent);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  // Deep links: newtab.html#panel=focus&task=abc
  useEffect(() => {
    const parse = () => {
      const p = new URLSearchParams(location.hash.slice(1));
      const id = p.get('panel');
      if (id && id in PANELS) {
        const params: Record<string, string> = {};
        p.forEach((v, k) => k !== 'panel' && (params[k] = v));
        openPanel(id as any, params);
        history.replaceState(null, '', location.pathname);
      }
    };
    parse();
    window.addEventListener('hashchange', parse);
    return () => window.removeEventListener('hashchange', parse);
  }, [openPanel]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
      // Esc while typing just leaves the field; a second Esc closes the panel.
      if (e.key === 'Escape' && typing) { t.blur(); return; }
      // Panels themselves are role=dialog; only a true modal (confirm, editor…) should swallow Esc.
      if (e.key === 'Escape' && !e.defaultPrevented && useUI.getState().panel && !document.querySelector('[aria-modal="true"]')) closePanel();
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const map: Record<string, any> = { t: 'tasks', f: 'focus', n: 'notes', c: 'calendar', s: 'settings', a: 'ai' };
      if (map[e.key]) { e.preventDefault(); openPanel(map[e.key]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closePanel, openPanel]);

  // Keep the last panel mounted briefly after close so it can animate out.
  const [rendered, setRendered] = useState(panel);
  const closing = !panel && !!rendered;
  useEffect(() => {
    if (panel) { setRendered(panel); return; }
    const t = setTimeout(() => setRendered(null), 230);
    return () => clearTimeout(t);
  }, [panel]);
  const active = panel ?? rendered;

  // Render nothing (not a dark screen) until hydrated: boot.js has already painted the cached background.
  if (!hydrated) return null;

  const P = active ? PANELS[active] : null;
  const fullscreen = !!active && FULLSCREEN_PANELS.includes(active);
  const wide = !!active && WIDE_PANELS.includes(active);

  return (
    <div className="relative h-full">
      <Background />
      {/*
        Only transform the dashboard here — opacity/filter on this wrapper would switch off
        every glass card's backdrop blur mid-animation. Blur/dim comes from sibling scrims.
      */}
      <div
        className={cn(
          'h-full transition-transform duration-500 ease-out',
          panel && !fullscreen && 'scale-[.985]',
          panel && fullscreen && 'pointer-events-none scale-[1.03]',
        )}
      >
        <Dashboard />
      </div>

      {P && !fullscreen && (
        <div className={cn('fixed inset-0 z-50 flex justify-end', closing && 'pointer-events-none')}>
          <div className={cn('scrim bg-black/25', closing ? 'animate-fade-out' : 'animate-fade-soft')} onMouseDown={closePanel} aria-hidden />
          <section
            key={active}
            className={cn('panel relative m-3 flex h-[calc(100%-1.5rem)] w-full flex-col overflow-hidden rounded-3xl text-ink shadow-2xl', closing ? 'animate-slide-out' : 'animate-slide-in', wide ? 'max-w-5xl' : 'max-w-xl')}
            role="dialog"
            aria-modal="false"
          >
            <Suspense fallback={<div className="grid h-full place-items-center"><Spinner /></div>}>
              <P />
            </Suspense>
          </section>
        </div>
      )}
      {P && fullscreen && (
        <div className={cn('fixed inset-0 z-50', closing && 'pointer-events-none focus-leaving')}>
          <Suspense fallback={<div className="grid h-full place-items-center"><Spinner /></div>}>
            <P />
          </Suspense>
        </div>
      )}

      {!s.onboarded && <Onboarding />}
      <ConfirmHost />
      <ToastHost />
    </div>
  );
}
