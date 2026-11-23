// Shared domain types for Momento. Every persisted store uses these shapes.

export type ID = string;
export type ISODate = string; // 'YYYY-MM-DD'
export type ISODateTime = string; // full ISO string

// ---------- Tasks ----------
export type Priority = 'none' | 'low' | 'medium' | 'high' | 'urgent';
export type Recurrence = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly';

export interface Subtask {
  id: ID;
  title: string;
  done: boolean;
}

export interface Task {
  id: ID;
  listId: ID;
  title: string;
  description: string;
  priority: Priority;
  dueDate: ISODate | null;
  dueTime: string | null; // 'HH:mm'
  reminderAt: ISODateTime | null;
  recurrence: Recurrence;
  category: string; // free-form tag
  subtasks: Subtask[];
  done: boolean;
  completedAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  order: number;
  focusMinutes: number; // accumulated from linked focus sessions
}

export interface TaskList {
  id: ID;
  name: string;
  color: string; // hex
  icon?: string;
  order: number;
}

// ---------- Focus ----------
export type FocusPhase = 'work' | 'shortBreak' | 'longBreak';
export type FocusStatus = 'idle' | 'running' | 'paused';

export interface FocusTimerState {
  status: FocusStatus;
  phase: FocusPhase;
  /** epoch ms when the running phase ends (only when running) */
  endsAt: number | null;
  /** remaining ms (authoritative when paused/idle) */
  remainingMs: number;
  /** total planned ms for current phase */
  durationMs: number;
  taskId: ID | null;
  /** number of work sessions completed in the current pomodoro cycle */
  cycleCount: number;
  startedAt: number | null;
}

export interface FocusSession {
  id: ID;
  phase: FocusPhase;
  startedAt: ISODateTime;
  endedAt: ISODateTime;
  minutes: number;
  taskId: ID | null;
  completed: boolean; // ran to the end vs. stopped early
}

export interface FocusSettings {
  workMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  longBreakEvery: number;
  autoStartBreaks: boolean;
  autoStartWork: boolean;
  pomodoro: boolean; // false = single custom-duration session
  notify: boolean;
  sound: AmbientSound;
  volume: number; // 0..1
  blockDuringFocus: boolean;
  /** also keep blocking during short/long breaks (only applies with blockDuringFocus) */
  blockDuringBreaks: boolean;
}

export type AmbientSound = 'none' | 'rain' | 'ocean' | 'forest' | 'fire' | 'cafe' | 'white' | 'brown';

// ---------- Blocker ----------
export interface BlockSchedule {
  id: ID;
  name: string;
  days: number[]; // 0=Sun..6=Sat
  start: string; // 'HH:mm'
  end: string; // 'HH:mm'
  enabled: boolean;
}

export interface BlockerState {
  sites: string[]; // domains, e.g. 'twitter.com'
  allowlist: string[]; // exceptions, e.g. 'music.youtube.com'
  alwaysOn: boolean;
  schedules: BlockSchedule[];
  /** epoch ms; when set and in the future, blocking is snoozed */
  snoozeUntil: number | null;
}

// ---------- Notes ----------
export interface NoteFolder {
  id: ID;
  name: string;
  color: string;
}

export interface Note {
  id: ID;
  folderId: ID | null;
  title: string;
  html: string; // sanitized rich text
  pinned: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ---------- Tabs ----------
export interface SavedTab {
  url: string;
  title: string;
  favIconUrl?: string;
  pinned?: boolean;
}

export interface TabCollection {
  id: ID;
  name: string;
  kind: 'stash' | 'group';
  color: string;
  tabs: SavedTab[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ---------- Calendar ----------
export interface CalendarEvent {
  id: ID;
  title: string;
  description: string;
  start: ISODateTime;
  end: ISODateTime;
  allDay: boolean;
  color: string;
  reminderMin: number | null; // minutes before start
  location?: string;
  source: 'local' | 'google' | 'outlook';
  externalId?: string;
}

// ---------- Countdowns ----------
export type CountdownKind = 'birthday' | 'exam' | 'holiday' | 'vacation' | 'deadline' | 'milestone' | 'other';
export interface Countdown {
  id: ID;
  title: string;
  date: ISODate;
  kind: CountdownKind;
  color: string;
  repeatYearly: boolean;
  pinned: boolean; // show on dashboard
}

// ---------- Metrics ----------
export interface CustomMetric {
  id: ID;
  name: string;
  unit: string;
  color: string;
  dailyGoal: number | null;
  icon: string;
  /** date -> value */
  entries: Record<ISODate, number>;
}

export interface PersonalGoal {
  id: ID;
  title: string;
  target: number;
  progress: number;
  unit: string;
  deadline: ISODate | null;
  color: string;
}

// ---------- Inspiration ----------
export interface Quote {
  id: ID;
  text: string;
  author: string;
  custom?: boolean;
}

// ---------- Weather / clocks ----------
export interface GeoLocation {
  name: string;
  country?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface WorldClock {
  id: ID;
  label: string;
  timezone: string;
  country?: string;
}

// ---------- Settings ----------
export type ThemeMode = 'light' | 'dark' | 'auto';
export type WidgetId =
  | 'clock'
  | 'greeting'
  | 'goal'
  | 'quote'
  | 'mantra'
  | 'tasks'
  | 'weather'
  | 'shortcuts'
  | 'focus'
  | 'countdowns'
  | 'calendar'
  | 'stats'
  | 'worldClocks'
  | 'search';

export type Zone = 'topLeft' | 'topCenter' | 'topRight' | 'center' | 'bottomLeft' | 'bottomCenter' | 'bottomRight';

export interface WidgetPlacement {
  id: WidgetId;
  zone: Zone;
  order: number;
  visible: boolean;
}

export interface Shortcut {
  id: ID;
  title: string;
  url: string;
}

export type BackgroundCategory = 'landscape' | 'nature' | 'mountains' | 'ocean' | 'forest' | 'city' | 'minimal';

export interface CustomBackground {
  id: ID;
  dataUrl: string;
  name: string;
}

export interface WorkHours {
  days: number[];
  start: string;
  end: string;
}

export interface BalanceSettings {
  enabled: boolean;
  work: WorkHours;
  /** widgets hidden outside work hours */
  hiddenInDowntime: WidgetId[];
  breakReminders: boolean;
  breakEveryMin: number;
  dimInDowntime: boolean;
  downtimeMessage: string;
}

export interface Settings {
  name: string;
  theme: ThemeMode;
  accent: string; // hex
  autoAccent: boolean; // derive accent from background
  fontDisplay: string; // key of FONT_OPTIONS
  fontBody: string;
  clock24h: boolean;
  showSeconds: boolean;
  tempUnit: 'c' | 'f';
  weekStartsOn: 0 | 1;
  backgroundMode: 'photo' | 'custom' | 'gradient' | 'solid';
  backgroundCategories: BackgroundCategory[];
  backgroundRotation: 'daily' | 'hourly' | 'tab';
  backgroundFavorites: string[];
  pinnedBackground: string | null; // url or custom id
  customBackgrounds: CustomBackground[];
  gradient: string; // key into GRADIENTS
  solidColor: string;
  dimBackground: number; // 0..0.7 overlay strength
  blurWidgets: boolean;
  widgets: WidgetPlacement[];
  shortcuts: Shortcut[];
  location: GeoLocation | null;
  useGeolocation: boolean;
  notifications: {
    enabled: boolean;
    focus: boolean;
    reminders: boolean;
    events: boolean;
    breaks: boolean;
  };
  tasks: {
    defaultListId: ID | null;
    showCompletedOnDashboard: boolean;
    confirmDelete: boolean;
  };
  balance: BalanceSettings;
  privacy: {
    analyticsOptIn: false; // we never collect analytics
    blurQuoteOnHover: boolean;
  };
  onboarded: boolean;
}

// ---------- Daily ----------
export interface DailyGoal {
  date: ISODate;
  text: string;
  done: boolean;
}

// ---------- Integrations ----------
export type IntegrationId =
  | 'google-calendar'
  | 'outlook'
  | 'google-tasks'
  | 'todoist'
  | 'trello'
  | 'asana'
  | 'clickup'
  | 'github'
  | 'basecamp'
  | 'spotify'
  | 'youtube';

export interface IntegrationConnection {
  id: IntegrationId;
  connected: boolean;
  /** token or PAT — stored only in chrome.storage.local, never synced */
  token?: string;
  expiresAt?: number;
  meta?: Record<string, string>;
  lastSync?: ISODateTime;
  error?: string;
}
