'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { instancesForDate } from '@/lib/recurrence';
import { weeklyCompletion } from '@/lib/stats';
import { weekDays, format, DAY_LABELS_FULL, dateKey } from '@/lib/date';
import { addDays } from 'date-fns';
import { TaskCard } from '@/components/TaskCard';
import { AddTaskModal } from '@/components/AddTaskModal';
import { SectionTitle, ProgressBar, EmptyState, Fab } from '@/components/ui-bits';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function WeekPage() {
  const tasks = useStore((s) => s.tasks);
  const completions = useStore((s) => s.completions);

  const [offset, setOffset] = useState(0); // semanas respecto a hoy
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const reference = addDays(new Date(), offset * 7);
  const todayKey = dateKey();

  const days = useMemo(() => {
    const now = new Date();
    return weekDays(reference).map((d) => {
      const key = format(d, 'yyyy-MM-dd');
      const instances = instancesForDate(tasks, key, completions, now).filter(
        (i) => i.status !== 'cancelada'
      );
      const done = instances.filter((i) => i.status === 'completada').length;
      const overdue = instances.filter((i) => i.isOverdue).length;
      return {
        key,
        date: d,
        label: DAY_LABELS_FULL[d.getDay()],
        dayNum: d.getDate(),
        instances: instances.sort((a, b) => (a.task.time ?? '99') < (b.task.time ?? '99') ? -1 : 1),
        done,
        total: instances.length,
        overdue,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, completions, offset]);

  const weekly = useMemo(
    () => weeklyCompletion(tasks, completions, reference),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, completions, offset]
  );

  const edit = (id: string) => {
    setEditId(id);
    setModal(true);
  };

  return (
    <main className="px-4 pt-6">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Semana</h1>
        <div className="flex items-center gap-1">
          <button onClick={() => setOffset((o) => o - 1)} className="rounded-lg p-2 text-slate-400">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => setOffset(0)}
            className="rounded-lg px-3 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400"
          >
            Hoy
          </button>
          <button onClick={() => setOffset((o) => o + 1)} className="rounded-lg p-2 text-slate-400">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <ProgressBar percent={weekly.percent} label={`Cumplimiento semanal (${weekly.done}/${weekly.total})`} />

      {days.map((d) => (
        <section key={d.key}>
          <SectionTitle
            count={d.total || undefined}
            accent={d.key === todayKey ? 'text-indigo-600 dark:text-indigo-400' : undefined}
          >
            {d.label} {d.dayNum}
            {d.overdue > 0 && <span className="ml-1 text-red-500">· {d.overdue} vencida(s)</span>}
          </SectionTitle>
          {d.instances.length === 0 ? (
            <EmptyState>Sin tareas</EmptyState>
          ) : (
            <div className="space-y-2">
              {d.instances.map((i) => (
                <TaskCard key={`${i.task.id}-${i.date}`} inst={i} onEdit={edit} />
              ))}
            </div>
          )}
        </section>
      ))}

      <Fab onClick={() => { setEditId(null); setModal(true); }} />
      <AddTaskModal open={modal} onClose={() => setModal(false)} editId={editId} />
    </main>
  );
}
