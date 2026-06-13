'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { habitStreaks } from '@/lib/stats';
import { resolveStatus } from '@/lib/recurrence';
import { dateKey } from '@/lib/date';
import { AddTaskModal } from '@/components/AddTaskModal';
import { Fab, EmptyState } from '@/components/ui-bits';
import { Flame, Trophy, Check, Pencil } from 'lucide-react';

export default function HabitsPage() {
  const tasks = useStore((s) => s.tasks);
  const completions = useStore((s) => s.completions);
  const setStatus = useStore((s) => s.setStatus);

  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const habits = useMemo(() => tasks.filter((t) => t.type === 'habito' && !t.archived), [tasks]);
  const todayKey = dateKey();

  return (
    <main className="px-4 pt-6">
      <h1 className="mb-3 text-2xl font-bold">Hábitos</h1>

      {habits.length === 0 && (
        <EmptyState>
          Todavía no tenés hábitos. Creá uno (entrenar, leer, estudiar…) con el botón +.
        </EmptyState>
      )}

      <div className="space-y-3">
        {habits.map((h) => {
          const { current, best, history } = habitStreaks(h, completions);
          const todayDone = resolveStatus(h, todayKey, completions).status === 'completada';
          const total = history.length;
          const done = history.filter((d) => d.done).length;
          const percent = total ? Math.round((done / total) * 100) : 0;

          return (
            <div key={h.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{h.title}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1 text-orange-500">
                      <Flame className="h-4 w-4" /> {current} días
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-500">
                      <Trophy className="h-4 w-4" /> mejor {best}
                    </span>
                    <span>{percent}% (30d)</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setEditId(h.id); setModal(true); }}
                    className="rounded-lg p-2 text-slate-400"
                    aria-label="Editar hábito"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setStatus(h, todayKey, todayDone ? 'pendiente' : 'completada')}
                    className={`grid h-9 w-9 place-items-center rounded-full border-2 transition ${
                      todayDone
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-slate-300 text-transparent dark:border-slate-600 active:scale-90'
                    }`}
                    aria-label="Marcar hoy"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Mini historial de los últimos días activos */}
              <div className="mt-3 flex flex-wrap gap-1">
                {history.map((d) => (
                  <span
                    key={d.date}
                    title={d.date}
                    className={`h-4 w-4 rounded ${
                      d.done ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Fab onClick={() => { setEditId(null); setModal(true); }} />
      <AddTaskModal
        open={modal}
        onClose={() => setModal(false)}
        editId={editId}
        defaultType="habito"
      />
    </main>
  );
}
