import { createPersisted } from '@/lib/persist';
import { KEYS } from '@/lib/storage';
import { uid } from '@/lib/utils';
import type { Settings, Shortcut, WidgetId, WidgetPlacement, Zone } from '@/lib/types';

export const DEFAULT_WIDGETS: WidgetPlacement[] = [
  { id: 'shortcuts', zone: 'topLeft', order: 0, visible: true },
  { id: 'search', zone: 'topCenter', order: 0, visible: false },
  { id: 'weather', zone: 'topRight', order: 0, visible: true },
  { id: 'worldClocks', zone: 'topRight', order: 1, visible: false },
  { id: 'clock', zone: 'center', order: 0, visible: true },
  { id: 'greeting', zone: 'center', order: 1, visible: true },
  { id: 'goal', zone: 'center', order: 2, visible: true },
  { id: 'focus', zone: 'bottomLeft', order: 0, visible: true },
  { id: 'countdowns', zone: 'bottomLeft', order: 1, visible: true },
  { id: 'calendar', zone: 'bottomLeft', order: 2, visible: false },
  { id: 'stats', zone: 'bottomLeft', order: 3, visible: false },
  { id: 'quote', zone: 'bottomCenter', order: 0, visible: true },
  { id: 'mantra', zone: 'center', order: 3, visible: false },
  { id: 'tasks', zone: 'bottomRight', order: 0, visible: true },
];

export const WIDGET_META: Record<WidgetId, { label: string; description: string }> = {
  clock: { label: 'Clock', description: 'Large digital clock and date' },
  greeting: { label: 'Greeting', description: 'Personalised greeting with your name' },
  goal: { label: 'Daily goal', description: 'Your main focus for today' },
  quote: { label: 'Quote', description: 'Daily motivational quote' },
  mantra: { label: 'Mantra', description: 'Daily affirmation or mantra' },
  tasks: { label: 'Tasks', description: "Today's tasks and most important task" },
  weather: { label: 'Weather', description: 'Current conditions and forecast' },
  shortcuts: { label: 'Shortcuts', description: 'Quick links to your favourite sites' },
  focus: { label: 'Focus timer', description: 'Pomodoro / focus session timer' },
  countdowns: { label: 'Countdowns', description: 'Days until what matters' },
  calendar: { label: 'Calendar', description: 'Upcoming events preview' },
  stats: { label: 'Stats', description: "Today's productivity at a glance" },
  worldClocks: { label: 'World clocks', description: 'Times around the world' },
  search: { label: 'Search', description: 'Web search bar' },
};

export const ZONES: Zone[] = ['topLeft', 'topCenter', 'topRight', 'center', 'bottomLeft', 'bottomCenter', 'bottomRight'];
export const ZONE_LABEL: Record<Zone, string> = {
  topLeft: 'Top left', topCenter: 'Top centre', topRight: 'Top right', center: 'Centre',
  bottomLeft: 'Bottom left', bottomCenter: 'Bottom centre', bottomRight: 'Bottom right',
};

const defaultShortcuts: Shortcut[] = [
  { id: uid(), title: 'Gmail', url: 'https://mail.google.com' },
  { id: uid(), title: 'Calendar', url: 'https://calendar.google.com' },
  { id: uid(), title: 'GitHub', url: 'https://github.com' },
  { id: uid(), title: 'YouTube', url: 'https://youtube.com' },
];

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  theme: 'auto',
  accent: '#7c83ff',
  autoAccent: true,
  fontDisplay: 'inter',
  fontBody: 'inter',
  clock24h: false,
  showSeconds: false,
  tempUnit: 'c',
  weekStartsOn: 1,
  backgroundMode: 'photo',
  backgroundCategories: ['landscape', 'nature', 'mountains'],
  backgroundRotation: 'daily',
  backgroundFavorites: [],
  pinnedBackground: null,
  customBackgrounds: [],
  gradient: 'dusk',
  solidColor: '#1e293b',
  dimBackground: 0.25,
  blurWidgets: true,
  widgets: DEFAULT_WIDGETS,
  shortcuts: defaultShortcuts,
  location: null,
  useGeolocation: false,
  notifications: { enabled: true, focus: true, reminders: true, events: true, breaks: true },
  tasks: { defaultListId: null, showCompletedOnDashboard: false, confirmDelete: true },
  balance: {
    enabled: false,
    work: { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:30' },
    hiddenInDowntime: ['tasks', 'focus', 'stats', 'calendar'],
    breakReminders: true,
    breakEveryMin: 60,
    dimInDowntime: false,
    downtimeMessage: 'Work is done for today. Enjoy your time.',
  },
  privacy: { analyticsOptIn: false, blurQuoteOnHover: false },
  onboarded: false,
};

export const useSettings = createPersisted(
  KEYS.settings,
  { settings: DEFAULT_SETTINGS },
  (set, get) => ({
    update(patch: Partial<Settings>) {
      set((s) => ({ settings: { ...s.settings, ...patch } }));
    },
    updateNested<K extends keyof Settings>(key: K, patch: Partial<Settings[K]>) {
      set((s) => ({ settings: { ...s.settings, [key]: { ...(s.settings[key] as object), ...(patch as object) } } }));
    },
    setWidget(id: WidgetId, patch: Partial<WidgetPlacement>) {
      set((s) => ({
        settings: { ...s.settings, widgets: s.settings.widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)) },
      }));
    },
    /** Move widget into zone at index (drag & drop). */
    moveWidget(id: WidgetId, zone: Zone, index: number) {
      const widgets = get().settings.widgets.map((w) => ({ ...w }));
      const moving = widgets.find((w) => w.id === id);
      if (!moving) return;
      const target = widgets.filter((w) => w.zone === zone && w.id !== id).sort((a, b) => a.order - b.order);
      target.splice(Math.max(0, Math.min(index, target.length)), 0, moving);
      moving.zone = zone;
      target.forEach((w, i) => (w.order = i));
      set((s) => ({ settings: { ...s.settings, widgets } }));
    },
    resetLayout() {
      set((s) => ({ settings: { ...s.settings, widgets: DEFAULT_WIDGETS } }));
    },
  }),
  // migrate: merge stored settings over defaults so new fields always exist
  (stored) => {
    const st = stored?.settings ?? {};
    const widgets: WidgetPlacement[] = DEFAULT_WIDGETS.map((d) => st.widgets?.find((w: WidgetPlacement) => w.id === d.id) ?? d);
    return {
      settings: {
        ...DEFAULT_SETTINGS,
        ...st,
        notifications: { ...DEFAULT_SETTINGS.notifications, ...st.notifications },
        tasks: { ...DEFAULT_SETTINGS.tasks, ...st.tasks },
        balance: { ...DEFAULT_SETTINGS.balance, ...st.balance, work: { ...DEFAULT_SETTINGS.balance.work, ...st.balance?.work } },
        privacy: { ...DEFAULT_SETTINGS.privacy, ...st.privacy },
        widgets,
      },
    };
  },
);

/** Convenience hook returning settings object. */
export const useS = () => useSettings((s) => s.settings);
