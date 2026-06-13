'use client';

import { useReminders } from './ReminderProvider';
import { useStore } from '@/lib/store';
import { PRIORITY_CHIP, PRIORITY_LABEL } from '@/lib/ui';
import { Check, AlarmClock, X, AlertTriangle } from 'lucide-react';

// Modo enfoque: mientras la app está abierta, insiste con la tarea más urgente
// hasta que el usuario actúe. Es el fallback principal de "notificación" en iOS.
export function FocusOverlay() {
  const { ringing } = useReminders();
  const focusMode = useStore((s) => s.settings.focusMode);
  const setStatus = useStore((s) => s.setStatus);
  const snooze = useStore((s) => s.snooze);

  if (!focusMode || ringing.length === 0) return null;

  const inst = ringing[0];
  const { task, date } = inst;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <div className="card w-full max-w-sm p-6 text-center animate-slideUp">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/20 animate-pulseRing">
          <AlertTriangle className="h-7 w-7" />
        </div>

        <p className="text-xs font-medium uppercase tracking-wide text-red-500">
          {inst.isOverdue ? 'Tarea vencida' : 'Es la hora'}
        </p>
        <h2 className="mt-1 text-xl font-bold">{task.title}</h2>
        {task.description && (
          <p className="mt-1 text-sm text-slate-500">{task.description}</p>
        )}

        <div className="mt-3 flex items-center justify-center gap-2 text-xs">
          <span className={`rounded-full px-2 py-0.5 ${PRIORITY_CHIP[task.priority]}`}>
            {PRIORITY_LABEL[task.priority]}
          </span>
          {task.time && <span className="text-slate-500">{task.time}</span>}
          {ringing.length > 1 && (
            <span className="text-slate-400">+{ringing.length - 1} más pendientes</span>
          )}
        </div>

        <button
          onClick={() => setStatus(task, date, 'completada')}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 font-semibold text-white active:scale-[0.99]"
        >
          <Check className="h-5 w-5" /> Marcar como hecha
        </button>

        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <button
            onClick={() => snooze(task, date, '15m')}
            className="flex flex-col items-center gap-1 rounded-xl bg-slate-100 py-2.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            <AlarmClock className="h-4 w-4" /> 15 min
          </button>
          <button
            onClick={() => snooze(task, date, '1h')}
            className="flex flex-col items-center gap-1 rounded-xl bg-slate-100 py-2.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            <AlarmClock className="h-4 w-4" /> 1 hora
          </button>
          <button
            onClick={() => snooze(task, date, 'tomorrow')}
            className="flex flex-col items-center gap-1 rounded-xl bg-slate-100 py-2.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            <AlarmClock className="h-4 w-4" /> Mañana
          </button>
        </div>

        <button
          onClick={() => setStatus(task, date, 'cancelada')}
          className="mt-3 inline-flex items-center gap-1 text-xs text-slate-400"
        >
          <X className="h-3.5 w-3.5" /> Cancelar tarea
        </button>
      </div>
    </div>
  );
}
