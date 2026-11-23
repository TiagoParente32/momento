import { createPersisted } from '@/lib/persist';
import { KEYS } from '@/lib/storage';
import { uid } from '@/lib/utils';
import { DEFAULT_LISTS, applyToggle, makeTask } from '@/lib/tasks-core';
import type { Task, TaskList } from '@/lib/types';

export { DEFAULT_LISTS, PRIORITY_META, RECURRENCE_LABEL, topTask, isOverdue, isDueToday, formatDue } from '@/lib/tasks-core';

/**
 * Persisted shape under KEYS.tasks: `{ tasks: Task[], lists: TaskList[] }`.
 */
export const useTasks = createPersisted(
  KEYS.tasks,
  { tasks: [] as Task[], lists: DEFAULT_LISTS },
  (set, get) => ({
    addTask(input: Partial<Task> & { title: string }): Task {
      const order = get().tasks.reduce((m, t) => Math.max(m, t.order), -1) + 1;
      const task = makeTask({ listId: get().lists[0]?.id ?? 'personal', ...input }, order);
      set((s) => ({ tasks: [...s.tasks, task] }));
      return task;
    },
    updateTask(id: string, patch: Partial<Task>) {
      const now = new Date().toISOString();
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: now } : t)) }));
    },
    deleteTask(id: string) {
      set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    },
    toggleTask(id: string) {
      set((s) => ({ tasks: applyToggle(s.tasks, id) }));
    },
    /** Reorder: place task `id` before `beforeId` (or at end). */
    moveTask(id: string, beforeId: string | null) {
      const tasks = [...get().tasks].sort((a, b) => a.order - b.order);
      const moving = tasks.find((t) => t.id === id);
      if (!moving) return;
      const rest = tasks.filter((t) => t.id !== id);
      const idx = beforeId ? rest.findIndex((t) => t.id === beforeId) : rest.length;
      rest.splice(idx < 0 ? rest.length : idx, 0, moving);
      const order = new Map(rest.map((t, i) => [t.id, i]));
      set((s) => ({ tasks: s.tasks.map((t) => ({ ...t, order: order.get(t.id) ?? t.order })) }));
    },
    addList(name: string, color: string): TaskList {
      const list: TaskList = { id: uid(), name: name.trim() || 'New list', color, order: get().lists.length };
      set((s) => ({ lists: [...s.lists, list] }));
      return list;
    },
    updateList(id: string, patch: Partial<TaskList>) {
      set((s) => ({ lists: s.lists.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
    },
    deleteList(id: string) {
      if (id === 'personal') return;
      set((s) => ({
        lists: s.lists.filter((l) => l.id !== id),
        tasks: s.tasks.map((t) => (t.listId === id ? { ...t, listId: 'personal' } : t)),
      }));
    },
    addFocusMinutes(taskId: string, minutes: number) {
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, focusMinutes: (t.focusMinutes || 0) + minutes } : t)) }));
    },
    clearCompleted() {
      set((s) => ({ tasks: s.tasks.filter((t) => !t.done) }));
    },
  }),
  (stored) => ({
    tasks: Array.isArray(stored?.tasks) ? stored.tasks : [],
    lists: Array.isArray(stored?.lists) && stored.lists.length ? stored.lists : DEFAULT_LISTS,
  }),
);
