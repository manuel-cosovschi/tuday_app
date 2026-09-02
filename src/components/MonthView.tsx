'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { instancesForDate } from '@/lib/recurrence';
import { dateKey, DAY_LABELS, prettyDate } from '@/lib/date';
import { PRIORITY_BAR } from '@/lib/ui';
import { TaskCard } from './TaskCard';
import { AddTaskModal } from './AddTaskModal';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  isSameMonth,
  isToday,
  format,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

// Etiquetas de columnas: lunes a domingo.
const COLS = [1, 2, 3, 4, 5, 6, 0].map((d) => DAY_LABELS[d]);

export function MonthView() {
  const tasks = useStore((s) => s.tasks);
  const completions = useStore((s) => s.completions);

  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState<string>(dateKey());
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState<string | undefined>(undefined);

  const reference = addMonths(new Date(), monthOffset);
  const todayKey = dateKey();

  const cells = useMemo(() => {
    const now = new Date();
    const gridStart = startOfWeek(startOfMonth(reference), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(reference), { weekStartsOn: 1 });
    const days: {
      key: string;
      date: Date;
      inMonth: boolean;
      pending: number;
      done: number;
      overdue: number;
      prios: string[];
    }[] = [];
    let d = gridStart;
    while (d <= gridEnd) {
      const key = format(d, 'yyyy-MM-dd');
      const inst = instancesForDate(tasks, key, completions, now).filter(
        (i) => i.status !== 'cancelada'
      );
      const pending = inst.filter((i) => i.status === 'pendiente').length;
      const done = inst.filter((i) => i.status === 'completada').length;
      const overdue = inst.filter((i) => i.isOverdue).length;
      const prios = Array.from(
        new Set(inst.filter((i) => i.status === 'pendiente').map((i) => i.task.priority))
      );
      days.push({ key, date: d, inMonth: isSameMonth(d, reference), pending, done, overdue, prios });
      d = addDays(d, 1);
    }
    return days;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, completions, monthOffset]);

  const selectedInstances = useMemo(() => {
    const now = new Date();
    return instancesForDate(tasks, selected, completions, now)
      .filter((i) => i.status !== 'cancelada')
      .sort((a, b) => ((a.task.time ?? '99') < (b.task.time ?? '99') ? -1 : 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, completions, selected]);

  const addForDay = (key: string) => {
    setEditId(null);
    setNewDate(key);
    setModal(true);
  };
  const edit = (id: string) => {
    setEditId(id);
    setNewDate(undefined);
    setModal(true);
  };

  return (
    <div>
      {/* Encabezado del mes */}
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => setMonthOffset((o) => o - 1)} className="rounded-lg p-2 text-slate-400">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="font-bold capitalize">{format(reference, 'LLLL yyyy', { locale: es })}</p>
          <button
            onClick={() => {
              setMonthOffset(0);
              setSelected(todayKey);
            }}
            className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400"
          >
            Ir a hoy
          </button>
        </div>
        <button onClick={() => setMonthOffset((o) => o + 1)} className="rounded-lg p-2 text-slate-400">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Cabecera de días */}
      <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase text-slate-400">
        {COLS.map((c) => (
          <div key={c} className="py-1">
            {c}
          </div>
        ))}
      </div>

      {/* Cuadrícula */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c) => {
          const isSel = c.key === selected;
          const isTod = isToday(c.date);
          return (
            <button
              key={c.key}
              onClick={() => setSelected(c.key)}
              className={`relative flex aspect-square flex-col items-center justify-start rounded-lg p-1 text-xs transition ${
                isSel
                  ? 'bg-indigo-600 text-white'
                  : c.inMonth
                  ? 'bg-[var(--card)] border border-[var(--hairline)]'
                  : 'opacity-40'
              }`}
            >
              <span
                className={`mt-0.5 grid h-5 w-5 place-items-center rounded-full text-[11px] ${
                  isTod && !isSel ? 'bg-indigo-100 font-bold text-indigo-700 dark:bg-indigo-500/30 dark:text-indigo-200' : ''
                } ${isSel ? 'font-bold' : ''}`}
              >
                {c.date.getDate()}
              </span>

              {/* Indicadores de tareas */}
              {c.pending + c.done > 0 && (
                <div className="mt-auto flex items-center gap-0.5 pb-0.5">
                  {c.prios.slice(0, 3).map((p, i) => (
                    <span
                      key={i}
                      className={`h-1.5 w-1.5 rounded-full ${isSel ? 'bg-white' : PRIORITY_BAR[p as keyof typeof PRIORITY_BAR]}`}
                    />
                  ))}
                  {c.pending === 0 && c.done > 0 && (
                    <span className={`h-1.5 w-1.5 rounded-full ${isSel ? 'bg-white/70' : 'bg-emerald-500'}`} />
                  )}
                </div>
              )}

              {/* Marca de vencidas */}
              {c.overdue > 0 && !isSel && (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Día seleccionado */}
      <div className="mt-4 flex items-center justify-between px-1">
        <h2 className="text-sm font-bold capitalize text-slate-600 dark:text-slate-300">
          {prettyDate(selected)}
        </h2>
        <button
          onClick={() => addForDay(selected)}
          className="inline-flex items-center gap-1 rounded-lg bg-indigo-100 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 active:scale-95 dark:bg-indigo-500/20 dark:text-indigo-300"
        >
          <Plus className="h-3.5 w-3.5" /> Agregar
        </button>
      </div>

      <div className="mt-2 space-y-2">
        {selectedInstances.length === 0 ? (
          <button
            onClick={() => addForDay(selected)}
            className="card flex w-full items-center justify-center gap-1.5 p-4 text-sm text-slate-400 active:scale-[0.99]"
          >
            <Plus className="h-4 w-4" /> Sin tareas — agregar una
          </button>
        ) : (
          selectedInstances.map((i) => (
            <TaskCard key={`${i.task.id}-${i.date}`} inst={i} onEdit={edit} />
          ))
        )}
      </div>

      <AddTaskModal open={modal} onClose={() => setModal(false)} editId={editId} defaultDate={newDate} />
    </div>
  );
}
