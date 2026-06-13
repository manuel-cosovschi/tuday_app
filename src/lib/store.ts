'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Task,
  Completions,
  DayRecord,
  Status,
  Settings,
  UserProfile,
  DEFAULT_SETTINGS,
} from './types';
import { dateKey } from './date';
import { addMinutes, addDays, startOfDay, parseISO } from 'date-fns';

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export type SnoozeMode = '15m' | '1h' | 'tomorrow';

interface State {
  profile: UserProfile | null;
  settings: Settings;
  tasks: Task[];
  completions: Completions;

  // Auth simple (local).
  login: (name: string, email?: string) => void;
  logout: () => void;

  // CRUD tareas.
  addTask: (t: Omit<Task, 'id' | 'createdAt' | 'status'> & { status?: Status }) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  archiveTask: (id: string) => void;
  deleteTask: (id: string) => void;

  // Acciones sobre la instancia de un día.
  setStatus: (task: Task, date: string, status: Status) => void;
  snooze: (task: Task, date: string, mode: SnoozeMode) => void;

  // Ajustes.
  updateSettings: (patch: Partial<Settings>) => void;
}

function writeRecord(
  completions: Completions,
  taskId: string,
  date: string,
  patch: Partial<DayRecord>
): Completions {
  const prev = completions[taskId]?.[date] ?? { status: 'pendiente', postponeCount: 0 };
  return {
    ...completions,
    [taskId]: { ...completions[taskId], [date]: { ...prev, ...patch } },
  };
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      profile: null,
      settings: DEFAULT_SETTINGS,
      tasks: [],
      completions: {},

      login: (name, email) =>
        set({ profile: { name, email, createdAt: new Date().toISOString() } }),
      logout: () => set({ profile: null }),

      addTask: (t) => {
        const task: Task = {
          id: uid(),
          createdAt: new Date().toISOString(),
          status: t.status ?? 'pendiente',
          ...t,
        };
        set((s) => ({ tasks: [...s.tasks, task] }));
        return task;
      },

      updateTask: (id, patch) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      archiveTask: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, archived: true } : t)),
        })),

      deleteTask: (id) =>
        set((s) => {
          const completions = { ...s.completions };
          delete completions[id];
          return { tasks: s.tasks.filter((t) => t.id !== id), completions };
        }),

      setStatus: (task, date, status) =>
        set((s) => {
          const completedAt = status === 'completada' ? new Date().toISOString() : undefined;
          const completions = writeRecord(s.completions, task.id, date, {
            status,
            completedAt,
            snoozedUntil: undefined,
          });
          // Tareas únicas: reflejar también en el estado de la tarea.
          const tasks =
            task.type === 'unica'
              ? s.tasks.map((t) => (t.id === task.id ? { ...t, status } : t))
              : s.tasks;
          return { completions, tasks };
        }),

      snooze: (task, date, mode) =>
        set((s) => {
          const now = new Date();
          let until: Date;
          if (mode === '15m') until = addMinutes(now, 15);
          else if (mode === '1h') until = addMinutes(now, 60);
          else until = addMinutes(startOfDay(addDays(now, 1)), 9 * 60); // mañana 09:00

          const prevCount = s.completions[task.id]?.[date]?.postponeCount ?? 0;
          const completions = writeRecord(s.completions, task.id, date, {
            status: 'pospuesta',
            snoozedUntil: until.toISOString(),
            postponeCount: prevCount + 1,
          });
          const tasks =
            task.type === 'unica'
              ? s.tasks.map((t) =>
                  t.id === task.id ? { ...t, status: 'pospuesta' as Status } : t
                )
              : s.tasks;
          return { completions, tasks };
        }),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: 'tuday-store-v1',
      partialize: (s) => ({
        profile: s.profile,
        settings: s.settings,
        tasks: s.tasks,
        completions: s.completions,
      }),
    }
  )
);

export { dateKey, parseISO };
