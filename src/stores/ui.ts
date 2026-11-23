import { create } from 'zustand';

export type PanelId =
  | 'tasks'
  | 'focus'
  | 'blocker'
  | 'notes'
  | 'tabs'
  | 'calendar'
  | 'stats'
  | 'countdowns'
  | 'inspiration'
  | 'weather'
  | 'clocks'
  | 'ai'
  | 'settings';

interface UIState {
  panel: PanelId | null;
  /** optional param passed to the panel, e.g. a task id, a settings section */
  params: Record<string, any>;
  editLayout: boolean;
  /** live accent extracted from the current background photo */
  bgAccent: string | null;
  bgCredit: { author?: string; link?: string } | null;
  openPanel: (p: PanelId, params?: Record<string, any>) => void;
  closePanel: () => void;
  setEditLayout: (v: boolean) => void;
}

export const useUI = create<UIState>((set) => ({
  panel: null,
  params: {},
  editLayout: false,
  bgAccent: null,
  bgCredit: null,
  openPanel: (panel, params = {}) => set({ panel, params }),
  closePanel: () => set({ panel: null, params: {} }),
  setEditLayout: (editLayout) => set({ editLayout }),
}));
