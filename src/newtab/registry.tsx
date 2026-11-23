import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { WidgetId } from '@/lib/types';
import type { PanelId } from '@/stores/ui';

/**
 * `lazy()` that survives extension updates: a tab opened before a rebuild still
 * references old chunk filenames, which no longer exist. On a failed chunk load we
 * reload the page once so it picks up the new build (guarded against reload loops).
 */
const RELOAD_KEY = 'momento:chunk-reload';
function lazyLoad<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load().then(
      (m) => { try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* ignore */ } return m; },
      (err) => {
        let reloaded = false;
        try { reloaded = sessionStorage.getItem(RELOAD_KEY) === '1'; sessionStorage.setItem(RELOAD_KEY, '1'); } catch { /* ignore */ }
        if (!reloaded) { location.reload(); return new Promise<never>(() => {}); }
        throw err;
      },
    ),
  );
}

/**
 * Widget & panel registries. Each module default-exports a component.
 * Widgets render on the photo (white text, use `.glass` for cards).
 * Panels render inside the theme-aware drawer and should use <PanelFrame>.
 */
export const WIDGETS: Record<WidgetId, LazyExoticComponent<ComponentType>> = {
  clock: lazyLoad(() => import('./widgets/ClockWidget')),
  greeting: lazyLoad(() => import('./widgets/GreetingWidget')),
  goal: lazyLoad(() => import('./widgets/GoalWidget')),
  search: lazyLoad(() => import('./widgets/SearchWidget')),
  shortcuts: lazyLoad(() => import('./widgets/ShortcutsWidget')),
  quote: lazyLoad(() => import('./widgets/QuoteWidget')),
  mantra: lazyLoad(() => import('./widgets/MantraWidget')),
  weather: lazyLoad(() => import('./widgets/WeatherWidget')),
  worldClocks: lazyLoad(() => import('./widgets/WorldClocksWidget')),
  countdowns: lazyLoad(() => import('./widgets/CountdownsWidget')),
  stats: lazyLoad(() => import('./widgets/StatsWidget')),
  tasks: lazyLoad(() => import('./widgets/TasksWidget')),
  focus: lazyLoad(() => import('./widgets/FocusWidget')),
  calendar: lazyLoad(() => import('./widgets/CalendarWidget')),
};

export const PANELS: Record<PanelId, LazyExoticComponent<ComponentType>> = {
  tasks: lazyLoad(() => import('./panels/TasksPanel')),
  focus: lazyLoad(() => import('./panels/FocusPanel')),
  blocker: lazyLoad(() => import('./panels/BlockerPanel')),
  notes: lazyLoad(() => import('./panels/NotesPanel')),
  tabs: lazyLoad(() => import('./panels/TabsPanel')),
  calendar: lazyLoad(() => import('./panels/CalendarPanel')),
  stats: lazyLoad(() => import('./panels/StatsPanel')),
  countdowns: lazyLoad(() => import('./panels/CountdownsPanel')),
  inspiration: lazyLoad(() => import('./panels/InspirationPanel')),
  weather: lazyLoad(() => import('./panels/WeatherPanel')),
  clocks: lazyLoad(() => import('./panels/ClocksPanel')),
  ai: lazyLoad(() => import('./panels/AIPanel')),
  settings: lazyLoad(() => import('./panels/SettingsPanel')),
};

/** Panels that take over the whole screen instead of the side drawer. */
export const FULLSCREEN_PANELS: PanelId[] = ['focus'];
/** Panels that use a wide drawer. */
export const WIDE_PANELS: PanelId[] = ['notes', 'tasks', 'calendar', 'stats', 'settings', 'tabs', 'ai'];
