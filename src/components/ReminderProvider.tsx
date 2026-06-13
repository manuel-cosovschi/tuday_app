'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { TaskInstance } from '@/lib/types';
import { instancesForDate, overdueSingles } from '@/lib/recurrence';
import { dateKey } from '@/lib/date';
import {
  showSystemNotification,
  beep,
  vibrate,
  registerServiceWorker,
} from '@/lib/notifications';

const TICK_MS = 20_000; // revisa cada 20s

interface ReminderCtx {
  ringing: TaskInstance[];
  ringingCount: number;
}
const Ctx = createContext<ReminderCtx>({ ringing: [], ringingCount: 0 });
export const useReminders = () => useContext(Ctx);

// Fases de aviso ya disparadas, en memoria (no necesita persistir).
type PhaseMap = Record<string, { pre?: boolean; lastDue?: number }>;

export function ReminderProvider({ children }: { children: React.ReactNode }) {
  const tasks = useStore((s) => s.tasks);
  const completions = useStore((s) => s.completions);
  const settings = useStore((s) => s.settings);

  const [ringing, setRinging] = useState<TaskInstance[]>([]);
  const phases = useRef<PhaseMap>({});

  useEffect(() => {
    registerServiceWorker();
  }, []);

  const tick = useCallback(() => {
    const now = new Date();
    const todayKey = dateKey(now);
    const today = instancesForDate(tasks, todayKey, completions, now);
    const overdue = overdueSingles(tasks, completions, now);
    const candidates = [...overdue, ...today];

    const nowRinging: TaskInstance[] = [];

    for (const inst of candidates) {
      if (inst.status !== 'pendiente') continue;
      const key = `${inst.task.id}:${inst.date}`;
      const phase = (phases.current[key] ??= {});
      const isUrgent = inst.task.priority === 'urgente';
      const repeatMin = isUrgent ? settings.repeatEveryUrgentMin : settings.repeatEveryMin;

      if (inst.dueAt) {
        const dueMs = inst.dueAt.getTime();
        const preMs = dueMs - settings.preNotifyMin * 60_000;

        // Aviso previo (una vez).
        if (now.getTime() >= preMs && now.getTime() < dueMs && !phase.pre) {
          phase.pre = true;
          notify(`⏰ Pronto: ${inst.task.title}`, `Falta poco (${inst.task.time}).`, false);
        }

        // En hora o vencida: insiste.
        if (now.getTime() >= dueMs) {
          nowRinging.push(inst);
          const since = phase.lastDue ?? 0;
          if (now.getTime() - since >= repeatMin * 60_000) {
            phase.lastDue = now.getTime();
            notify(
              `${isUrgent ? '🔴 URGENTE: ' : '🔔 '}${inst.task.title}`,
              inst.isOverdue ? '¡Tarea vencida! Marcala como hecha o posponé.' : 'Es la hora de esta tarea.',
              true
            );
          }
        }
      } else if (inst.isOverdue) {
        // Vencida sin hora concreta: visible en modo enfoque, aviso 1 vez.
        nowRinging.push(inst);
        if (!phase.lastDue) {
          phase.lastDue = now.getTime();
          notify(`🔔 Pendiente: ${inst.task.title}`, 'Tenés una tarea sin completar.', false);
        }
      }
    }

    // Ordena por prioridad/vencimiento para mostrar la más importante arriba.
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
      // Fallbacks con la app abierta (clave en iPhone).
      if (insist) {
        if (settings.soundEnabled) beep();
        if (settings.vibrationEnabled) vibrate([200, 100, 200]);
      }
    }
  }, [tasks, completions, settings]);

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
    <Ctx.Provider value={{ ringing, ringingCount: ringing.length }}>{children}</Ctx.Provider>
  );
}
