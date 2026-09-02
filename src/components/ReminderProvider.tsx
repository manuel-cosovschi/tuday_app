'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { TaskInstance } from '@/lib/types';
import { instancesForDate } from '@/lib/recurrence';
import { dateKey } from '@/lib/date';
import {
  showSystemNotification,
  beep,
  vibrate,
  registerServiceWorker,
} from '@/lib/notifications';

const TICK_MS = 20_000; // revisa cada 20s
const DISMISS_MS = 30 * 60_000; // "Ahora no" silencia 30 min

interface ReminderCtx {
  ringing: TaskInstance[];
  ringingCount: number;
  dismiss: (taskId: string, date: string) => void;
}
const Ctx = createContext<ReminderCtx>({ ringing: [], ringingCount: 0, dismiss: () => {} });
export const useReminders = () => useContext(Ctx);

// Fases de aviso ya disparadas, en memoria (no necesita persistir).
type PhaseMap = Record<string, { pre?: boolean; lastDue?: number }>;

export function ReminderProvider({ children }: { children: React.ReactNode }) {
  const tasks = useStore((s) => s.tasks);
  const completions = useStore((s) => s.completions);
  const settings = useStore((s) => s.settings);
  const userId = useStore((s) => s.userId);
  const workspaceOwnerId = useStore((s) => s.workspaceOwnerId);

  const [ringing, setRinging] = useState<TaskInstance[]>([]);
  const phases = useRef<PhaseMap>({});
  const dismissed = useRef<Record<string, number>>({});

  // Los recordatorios son solo de TU propio calendario. Si estás gestionando el
  // calendario de otra persona, no te bombardeamos con sus alarmas.
  const isOwnCalendar = !!userId && workspaceOwnerId === userId;

  useEffect(() => {
    registerServiceWorker();
  }, []);

  const dismiss = useCallback((taskId: string, date: string) => {
    dismissed.current[`${taskId}:${date}`] = Date.now() + DISMISS_MS;
    setRinging((prev) => prev.filter((i) => !(i.task.id === taskId && i.date === date)));
  }, []);

  const tick = useCallback(() => {
    if (!isOwnCalendar) {
      setRinging([]);
      return;
    }
    const now = new Date();
    const todayKey = dateKey(now);
    const today = instancesForDate(tasks, todayKey, completions, now);

    const nowRinging: TaskInstance[] = [];

    for (const inst of today) {
      if (inst.status !== 'pendiente') continue;
      // Solo avisamos por tareas con HORA concreta. Las tareas sin hora quedan
      // visibles en la lista, pero no interrumpen ni suenan.
      if (!inst.dueAt) continue;
      if ((dismissed.current[`${inst.task.id}:${inst.date}`] ?? 0) > now.getTime()) continue;

      const key = `${inst.task.id}:${inst.date}`;
      const phase = (phases.current[key] ??= {});
      const isUrgent = inst.task.priority === 'urgente';
      const repeatMin = isUrgent ? settings.repeatEveryUrgentMin : settings.repeatEveryMin;

      const dueMs = inst.dueAt.getTime();
      const preMs = dueMs - settings.preNotifyMin * 60_000;

      // Aviso previo (una sola vez, sin sonido).
      if (now.getTime() >= preMs && now.getTime() < dueMs && !phase.pre) {
        phase.pre = true;
        notify(`⏰ Pronto: ${inst.task.title}`, `Falta poco (${inst.task.time}).`, false);
      }

      // En hora o pasada: insiste (con tope de tiempo para no acosar todo el día).
      const minutesLate = (now.getTime() - dueMs) / 60_000;
      if (minutesLate >= 0 && minutesLate <= 120) {
        nowRinging.push(inst);
        const since = phase.lastDue ?? 0;
        if (now.getTime() - since >= repeatMin * 60_000) {
          phase.lastDue = now.getTime();
          notify(
            `${isUrgent ? '🔴 URGENTE: ' : '🔔 '}${inst.task.title}`,
            minutesLate < 1 ? 'Es la hora de esta tarea.' : 'Sigue pendiente. Marcala o posponé.',
            true
          );
        }
      }
    }

    nowRinging.sort((a, b) => {
      const pa = a.task.priority === 'urgente' ? 0 : 1;
      const pb = b.task.priority === 'urgente' ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0);
    });
    setRinging(nowRinging);

    function notify(title: string, body: string, insist: boolean) {
      if (settings.notificationsEnabled) {
        showSystemNotification(title, { body, tag: title, renotify: true, requireInteraction: insist });
      }
      if (insist) {
        if (settings.soundEnabled) beep();
        if (settings.vibrationEnabled) vibrate([200, 100, 200]);
      }
    }
  }, [tasks, completions, settings, isOwnCalendar]);

  useEffect(() => {
    tick();
    const id = setInterval(tick, TICK_MS);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [tick]);

  return (
    <Ctx.Provider value={{ ringing, ringingCount: ringing.length, dismiss }}>
      {children}
    </Ctx.Provider>
  );
}
