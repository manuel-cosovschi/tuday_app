'use client';

import { useState } from 'react';
import { TaskInstance } from '@/lib/types';
import { useStore } from '@/lib/store';
import { PRIORITY_BAR, PRIORITY_CHIP, PRIORITY_LABEL, TYPE_LABEL } from '@/lib/ui';
import { Check, Clock, MoreHorizontal, X, AlarmClock, Pencil } from 'lucide-react';

export function TaskCard({
  inst,
  onEdit,
}: {
  inst: TaskInstance;
  onEdit?: (id: string) => void;
}) {
  const { task, date, status, isOverdue } = inst;
  const setStatus = useStore((s) => s.setStatus);
  const snooze = useStore((s) => s.snooze);
  const [open, setOpen] = useState(false);

  const done = status === 'completada';
  const cancelled = status === 'cancelada';
  const postponeCount = inst.record?.postponeCount ?? 0;

  return (
    <div
      className={`card relative overflow-hidden ${
        isOverdue ? 'ring-2 ring-red-400/70 animate-pulseRing' : ''
      }`}
    >
      <span className={`absolute left-0 top-0 h-full w-1.5 ${PRIORITY_BAR[task.priority]}`} />
      <div className="flex items-start gap-3 p-3 pl-4">
        <button
          aria-label="Marcar como hecha"
          onClick={() => setStatus(task, date, done ? 'pendiente' : 'completada')}
          className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition ${
            done
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-slate-300 dark:border-slate-600 text-transparent active:scale-90'
          }`}
        >
          <Check className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p
              className={`truncate font-semibold ${
                done || cancelled ? 'text-slate-400 line-through' : ''
              }`}
            >
              {task.title}
            </p>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
            {task.time && (
              <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <Clock className="h-3 w-3" />
                {task.time}
                {task.durationMin ? ` · ${task.durationMin}m` : ''}
              </span>
            )}
            <span className={`rounded-full px-2 py-0.5 ${PRIORITY_CHIP[task.priority]}`}>
              {PRIORITY_LABEL[task.priority]}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {task.category} · {TYPE_LABEL[task.type]}
            </span>
            {isOverdue && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700 dark:bg-red-500/20 dark:text-red-300">
                Vencida
              </span>
            )}
            {postponeCount > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                pospuesta ×{postponeCount}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Más acciones"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 dark:border-slate-800 p-2 text-xs">
          <Action onClick={() => snooze(task, date, '15m')} icon={<AlarmClock className="h-3.5 w-3.5" />}>
            +15 min
          </Action>
          <Action onClick={() => snooze(task, date, '1h')} icon={<AlarmClock className="h-3.5 w-3.5" />}>
            +1 hora
          </Action>
          <Action onClick={() => snooze(task, date, 'tomorrow')} icon={<AlarmClock className="h-3.5 w-3.5" />}>
            Mañana
          </Action>
          <Action onClick={() => setStatus(task, date, 'cancelada')} icon={<X className="h-3.5 w-3.5" />}>
            Cancelar
          </Action>
          {onEdit && (
            <Action onClick={() => onEdit(task.id)} icon={<Pencil className="h-3.5 w-3.5" />}>
              Editar
            </Action>
          )}
        </div>
      )}
    </div>
  );
}

function Action({
  children,
  onClick,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 font-medium text-slate-600 active:scale-95 dark:bg-slate-800 dark:text-slate-300"
    >
      {icon}
      {children}
    </button>
  );
}
