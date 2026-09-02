'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from './supabase';
import {
  Task,
  Completions,
  DayRecord,
  Status,
  Settings,
  DEFAULT_SETTINGS,
} from './types';
import { dateKey } from './date';
import { addMinutes, addDays, startOfDay } from 'date-fns';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type SnoozeMode = '15m' | '1h' | 'tomorrow';

export interface Workspace {
  owner_id: string;
  name: string;
  role: 'owner' | 'manager';
}
export interface Manager {
  member_id: string;
  name: string | null;
  email: string | null;
  role: string;
  created_at: string;
}
interface Profile {
  name: string;
  email?: string;
}

// -------- mapeo fila <-> Task ----------
type Row = Record<string, any>;

function rowToTask(r: Row): Task {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? undefined,
    category: r.category,
    priority: r.priority,
    type: r.type,
    dueDate: r.due_date ?? undefined,
    time: r.task_time ?? undefined,
    durationMin: r.duration_min ?? undefined,
    daysOfWeek: r.days_of_week ?? undefined,
    dayOfMonth: r.day_of_month ?? undefined,
    status: r.status,
    createdAt: r.created_at,
    archived: r.archived ?? false,
  };
}

function taskToRow(t: Partial<Task>): Row {
  const row: Row = {};
  if (t.title !== undefined) row.title = t.title;
  if ('description' in t) row.description = t.description ?? null;
  if (t.category !== undefined) row.category = t.category;
  if (t.priority !== undefined) row.priority = t.priority;
  if (t.type !== undefined) row.type = t.type;
  if ('dueDate' in t) row.due_date = t.dueDate ?? null;
  if ('time' in t) row.task_time = t.time ?? null;
  if ('durationMin' in t) row.duration_min = t.durationMin ?? null;
  if ('daysOfWeek' in t) row.days_of_week = t.daysOfWeek ?? null;
  if ('dayOfMonth' in t) row.day_of_month = t.dayOfMonth ?? null;
  if (t.status !== undefined) row.status = t.status;
  if (t.archived !== undefined) row.archived = t.archived;
  return row;
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

// -------- estado ----------
interface State {
  ready: boolean; // auth resuelta
  loading: boolean; // cargando datos del workspace
  userId: string | null;
  profile: Profile | null;

  workspaces: Workspace[];
  workspaceOwnerId: string | null;

  tasks: Task[];
  completions: Completions;
  settings: Settings;

  // auth
  init: () => void;
  signUp: (email: string, password: string, name: string) => Promise<{ needsConfirm: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;

  // datos
  loadData: () => Promise<void>;
  switchWorkspace: (ownerId: string) => Promise<void>;

  // conexión entre personas
  createInvite: () => Promise<string>;
  redeemInvite: (code: string) => Promise<string>;
  loadManagers: () => Promise<Manager[]>;
  revokeManager: (memberId: string) => Promise<void>;
  leaveWorkspace: (ownerId: string) => Promise<void>;

  // migración de datos locales del MVP anterior
  importLocal: (tasks: Task[], completions: Completions) => Promise<number>;

  // CRUD tareas
  addTask: (t: Omit<Task, 'id' | 'createdAt' | 'status'> & { status?: Status }) => Task | undefined;
  updateTask: (id: string, patch: Partial<Task>) => void;
  archiveTask: (id: string) => void;
  deleteTask: (id: string) => void;
  setStatus: (task: Task, date: string, status: Status) => void;
  snooze: (task: Task, date: string, mode: SnoozeMode) => void;

  updateSettings: (patch: Partial<Settings>) => void;
}

let channel: RealtimeChannel | null = null;
let reloadTimer: ReturnType<typeof setTimeout> | null = null;

// --- Persistencia robusta de sesión ---
// Guardamos un respaldo propio de la sesión para que un fallo transitorio
// (base pausada / sin red) NO obligue a re-loguearse. Con entrar una vez alcanza.
const AUTH_BACKUP_KEY = 'tuday-auth-backup';
let userInitiatedLogout = false;

function saveAuthBackup(session: any, name: string) {
  try {
    localStorage.setItem(
      AUTH_BACKUP_KEY,
      JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        user: { id: session.user.id, email: session.user.email, name },
      })
    );
  } catch {
    /* noop */
  }
}
function readAuthBackup(): any | null {
  try {
    const raw = localStorage.getItem(AUTH_BACKUP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function clearAuthBackup() {
  try {
    localStorage.removeItem(AUTH_BACKUP_KEY);
  } catch {
    /* noop */
  }
}

export const useStore = create<State>()(
  persist(
    (set, get) => {
      function ownerId() {
        return get().workspaceOwnerId;
      }

      function scheduleReload() {
        if (reloadTimer) clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => get().loadData(), 300);
      }

      function subscribe(owner: string) {
        if (channel) supabase.removeChannel(channel);
        channel = supabase
          .channel(`tuday-ws-${owner}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'tuday_tasks', filter: `owner_id=eq.${owner}` },
            scheduleReload
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'tuday_task_logs', filter: `owner_id=eq.${owner}` },
            scheduleReload
          )
          .subscribe();
      }

      async function handleSession(session: any) {
        if (!session) {
          if (channel) supabase.removeChannel(channel);
          channel = null;
          set({
            userId: null,
            profile: null,
            workspaces: [],
            workspaceOwnerId: null,
            tasks: [],
            completions: {},
            ready: true,
          });
          return;
        }
        const user = session.user;
        const name = user.user_metadata?.name || (user.email ? user.email.split('@')[0] : 'Usuario');
        saveAuthBackup(session, name); // recordar la sesión de forma persistente
        // Desbloquear la UI de inmediato: NUNCA quedarse en "Cargando" por la red.
        // Los datos se cargan a continuación; si la base falla, la app igual abre.
        set({
          userId: user.id,
          profile: { name, email: user.email },
          workspaceOwnerId: get().workspaceOwnerId ?? user.id,
          ready: true,
        });

        try {
          await supabase.from('tuday_profiles').upsert({ id: user.id, name, email: user.email });
          const { data: ws } = await supabase.rpc('tuday_my_workspaces');
          if (ws) {
            set({
              workspaces: (ws as Row[]).map((w) => ({
                owner_id: w.owner_id,
                name: w.name,
                role: w.role,
              })),
            });
          }
          await get().loadData();
          subscribe(get().workspaceOwnerId ?? user.id);
        } catch {
          // Sin conexión / base pausada: la app queda usable y reintenta al reconectar.
        }
      }

      return {
        ready: false,
        loading: false,
        userId: null,
        profile: null,
        workspaces: [],
        workspaceOwnerId: null,
        tasks: [],
        completions: {},
        settings: DEFAULT_SETTINGS,

        init: () => {
          // Failsafe: pase lo que pase, nunca quedarse en "Cargando…" más de 6s.
          setTimeout(() => {
            if (!get().ready) set({ ready: true });
          }, 6000);

          supabase.auth
            .getSession()
            .then(({ data }) => {
              if (data.session) {
                handleSession(data.session);
                return;
              }
              // Sin sesión activa: intentar restaurar desde nuestro respaldo.
              const b = readAuthBackup();
              if (b?.refresh_token && b?.user) {
                // Mostrar la app YA logueada (sin pedir credenciales)...
                set({
                  userId: b.user.id,
                  profile: { name: b.user.name, email: b.user.email },
                  workspaceOwnerId: get().workspaceOwnerId ?? b.user.id,
                  ready: true,
                });
                // ...y restaurar la sesión de Supabase en segundo plano.
                supabase.auth
                  .setSession({ access_token: b.access_token, refresh_token: b.refresh_token })
                  .then(({ data }) => {
                    if (data.session) handleSession(data.session);
                    else get().loadData();
                  })
                  .catch(() => get().loadData());
              } else {
                set({ ready: true }); // realmente no hay sesión → login
              }
            })
            .catch(() => set({ ready: true }));

          supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
              // Solo desloguear si el usuario lo pidió. Un deslogueo por fallo
              // transitorio (base pausada/sin red) se ignora para no molestar.
              if (userInitiatedLogout) {
                clearAuthBackup();
                handleSession(null);
              }
              return;
            }
            if (session) handleSession(session);
          });

          // Al volver la conexión o reabrir la app: reasegurar sesión y recargar.
          if (typeof window !== 'undefined') {
            const retry = async () => {
              if (!get().userId) return;
              const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }) as any);
              if (data?.session) {
                get().loadData();
              } else {
                const b = readAuthBackup();
                if (b?.refresh_token) {
                  supabase.auth
                    .setSession({ access_token: b.access_token, refresh_token: b.refresh_token })
                    .then(() => get().loadData())
                    .catch(() => {});
                }
              }
            };
            window.addEventListener('online', retry);
            document.addEventListener('visibilitychange', () => {
              if (document.visibilityState === 'visible') retry();
            });
          }
        },

        signUp: async (email, password, name) => {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name, app: 'tuday' } },
          });
          if (error) throw error;
          if (data.session) return { needsConfirm: false };
          // Las cuentas de Tuday se confirman al instante (sin email): entramos directo.
          const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
          return { needsConfirm: !!e2 };
        },

        signIn: async (email, password) => {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
        },

        resetPassword: async (email) => {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
          });
          if (error) throw error;
        },

        logout: async () => {
          userInitiatedLogout = true;
          clearAuthBackup();
          try {
            await supabase.auth.signOut();
          } catch {
            /* noop */
          }
          handleSession(null);
          userInitiatedLogout = false;
        },

        loadData: async () => {
          const owner = ownerId();
          if (!owner) return;
          set({ loading: true });
          const [taskRes, logRes] = await Promise.all([
            supabase.from('tuday_tasks').select('*').eq('owner_id', owner).order('created_at'),
            supabase.from('tuday_task_logs').select('*').eq('owner_id', owner),
          ]);
          // IMPORTANTE: si la consulta falla (base caída/pausada, red), NO tocar el
          // estado actual. Nunca vaciar la lista por un error transitorio.
          if (taskRes.error || logRes.error) {
            set({ loading: false });
            return;
          }
          const tasks = (taskRes.data ?? []).map(rowToTask);
          const completions: Completions = {};
          for (const r of logRes.data ?? []) {
            completions[r.task_id] = completions[r.task_id] ?? {};
            completions[r.task_id][r.date] = {
              status: r.status,
              completedAt: r.completed_at ?? undefined,
              snoozedUntil: r.snoozed_until ?? undefined,
              postponeCount: r.postpone_count ?? 0,
            };
          }
          set({ tasks, completions, loading: false });
        },

        switchWorkspace: async (owner) => {
          set({ workspaceOwnerId: owner, tasks: [], completions: {} });
          await get().loadData();
          subscribe(owner);
        },

        createInvite: async () => {
          const { data, error } = await supabase.rpc('tuday_create_invite');
          if (error) throw error;
          return data as string;
        },

        redeemInvite: async (code) => {
          const { data, error } = await supabase.rpc('tuday_redeem_invite', {
            p_code: code.trim().toUpperCase(),
          });
          if (error) throw error;
          // recargar workspaces
          const { data: ws } = await supabase.rpc('tuday_my_workspaces');
          set({
            workspaces: (ws ?? []).map((w: Row) => ({
              owner_id: w.owner_id,
              name: w.name,
              role: w.role,
            })),
          });
          const row = Array.isArray(data) ? data[0] : data;
          return row?.owner_name || 'Calendario';
        },

        loadManagers: async () => {
          const { data, error } = await supabase.rpc('tuday_my_managers');
          if (error) throw error;
          return (data ?? []) as Manager[];
        },

        revokeManager: async (memberId) => {
          const owner = get().userId;
          await supabase
            .from('tuday_memberships')
            .delete()
            .eq('owner_id', owner)
            .eq('member_id', memberId);
        },

        leaveWorkspace: async (owner) => {
          const me = get().userId;
          await supabase
            .from('tuday_memberships')
            .delete()
            .eq('owner_id', owner)
            .eq('member_id', me);
          const { data: ws } = await supabase.rpc('tuday_my_workspaces');
          const workspaces = (ws ?? []).map((w: Row) => ({
            owner_id: w.owner_id,
            name: w.name,
            role: w.role,
          }));
          set({ workspaces });
          if (get().workspaceOwnerId === owner) await get().switchWorkspace(get().userId!);
        },

        importLocal: async (tasks, completions) => {
          const owner = get().userId;
          const userId = get().userId;
          if (!owner) return 0;
          const idMap: Record<string, string> = {};
          const taskRows = tasks.map((t) => {
            const id = crypto.randomUUID();
            idMap[t.id] = id;
            return { id, owner_id: owner, created_by: userId, created_at: t.createdAt, ...taskToRow(t) };
          });
          if (taskRows.length) await supabase.from('tuday_tasks').insert(taskRows);
          const logRows: Row[] = [];
          for (const [taskId, byDate] of Object.entries(completions)) {
            const newId = idMap[taskId];
            if (!newId) continue;
            for (const [date, rec] of Object.entries(byDate)) {
              logRows.push({
                task_id: newId,
                owner_id: owner,
                date,
                status: rec.status,
                completed_at: rec.completedAt ?? null,
                snoozed_until: rec.snoozedUntil ?? null,
                postpone_count: rec.postponeCount ?? 0,
              });
            }
          }
          if (logRows.length) await supabase.from('tuday_task_logs').insert(logRows);
          await get().loadData();
          return taskRows.length;
        },

        addTask: (t) => {
          const owner = ownerId();
          const userId = get().userId;
          if (!owner) return undefined;
          const id = crypto.randomUUID();
          const createdAt = new Date().toISOString();
          const task: Task = { id, createdAt, status: t.status ?? 'pendiente', ...t };
          set((s) => ({ tasks: [...s.tasks, task] }));
          void supabase
            .from('tuday_tasks')
            .insert({ id, owner_id: owner, created_by: userId, created_at: createdAt, ...taskToRow(task) })
            .then(({ error }) => {
              if (error) get().loadData();
            });
          return task;
        },

        updateTask: (id, patch) => {
          set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
          void supabase
            .from('tuday_tasks')
            .update(taskToRow(patch))
            .eq('id', id)
            .then(({ error }) => {
              if (error) get().loadData();
            });
        },

        archiveTask: (id) => {
          get().updateTask(id, { archived: true });
        },

        deleteTask: (id) => {
          set((s) => {
            const completions = { ...s.completions };
            delete completions[id];
            return { tasks: s.tasks.filter((t) => t.id !== id), completions };
          });
          void supabase
            .from('tuday_tasks')
            .delete()
            .eq('id', id)
            .then(({ error }) => {
              if (error) get().loadData();
            });
        },

        setStatus: (task, date, status) => {
          const owner = ownerId();
          const userId = get().userId;
          const completedAt = status === 'completada' ? new Date().toISOString() : undefined;
          const prevCount = get().completions[task.id]?.[date]?.postponeCount ?? 0;
          set((s) => {
            const completions = writeRecord(s.completions, task.id, date, {
              status,
              completedAt,
              snoozedUntil: undefined,
            });
            const tasks =
              task.type === 'unica'
                ? s.tasks.map((t) => (t.id === task.id ? { ...t, status } : t))
                : s.tasks;
            return { completions, tasks };
          });
          void supabase.from('tuday_task_logs').upsert(
            {
              task_id: task.id,
              owner_id: owner,
              date,
              status,
              completed_at: completedAt ?? null,
              snoozed_until: null,
              postpone_count: prevCount,
              updated_by: userId,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'task_id,date' }
          ).then(({ error }) => {
            if (error) get().loadData();
          });
          if (task.type === 'unica') {
            void supabase.from('tuday_tasks').update({ status }).eq('id', task.id);
          }
        },

        snooze: (task, date, mode) => {
          const owner = ownerId();
          const userId = get().userId;
          const now = new Date();
          let until: Date;
          if (mode === '15m') until = addMinutes(now, 15);
          else if (mode === '1h') until = addMinutes(now, 60);
          else until = addMinutes(startOfDay(addDays(now, 1)), 9 * 60);

          const prevCount = get().completions[task.id]?.[date]?.postponeCount ?? 0;
          const newCount = prevCount + 1;
          set((s) => {
            const completions = writeRecord(s.completions, task.id, date, {
              status: 'pospuesta',
              snoozedUntil: until.toISOString(),
              postponeCount: newCount,
            });
            const tasks =
              task.type === 'unica'
                ? s.tasks.map((t) => (t.id === task.id ? { ...t, status: 'pospuesta' as Status } : t))
                : s.tasks;
            return { completions, tasks };
          });
          void supabase.from('tuday_task_logs').upsert(
            {
              task_id: task.id,
              owner_id: owner,
              date,
              status: 'pospuesta',
              snoozed_until: until.toISOString(),
              postpone_count: newCount,
              updated_by: userId,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'task_id,date' }
          ).then(({ error }) => {
            if (error) get().loadData();
          });
          if (task.type === 'unica') {
            void supabase.from('tuday_tasks').update({ status: 'pospuesta' }).eq('id', task.id);
          }
        },

        updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      };
    },
    {
      name: 'tuday-settings-v1',
      partialize: (s) => ({ settings: s.settings }),
    }
  )
);

export { dateKey };
