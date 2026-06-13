'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { instancesForDate, overdueSingles } from '@/lib/recurrence';
import { dailyCompletion, weeklyCompletion, mostPostponed } from '@/lib/stats';
import { dateKey, prettyDate } from '@/lib/date';
import { PRIORITY_ORDER } from '@/lib/types';
import { TaskCard } from '@/components/TaskCard';
import { AddTaskModal } from '@/components/AddTaskModal';
import { SectionTitle, ProgressBar, ProgressRing, EmptyState, Fab } from '@/components/ui-bits';
import { CalendarCheck } from 'lucide-react';

export default function TodayPage() {
  const tasks = useStore((s) => s.tasks);
  const completions = useStore((s) => s.completions);
  const profile = useStore((s) => s.profile);

  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const data = useMemo(() => {
    const now = new Date();
    const key = dateKey(now);
    const today = instancesForDate(tasks, key, completions, now);
    const overdue = overdueSingles(tasks, completions, now);

    const pending = today.filter((i) => i.status === 'pendiente');
    const overdueAll = [...overdue, ...pending.filter((i) => i.isOverdue)];
    const urgent = pending.filter((i) => i.task.priority === 'urgente' && !i.isOverdue);
    const timed = pending
      .filter((i) => i.task.time && !i.isOverdue && i.task.priority !== 'urgente')
      .sort((a, b) => (a.task.time! < b.task.time! ? -1 : 1));
    const untimed = pending.filter(
      (i) => !i.task.time && !i.isOverdue && i.task.priority !== 'urgente'
    );
    const completed = today.filter((i) => i.status === 'completada');

    return {
      overdueAll,
      urgent,
      timed,
      untimed,
      completed,
      daily: dailyCompletion(tasks, completions, key),
      weekly: weeklyCompletion(tasks, completions, now),
      postponed: mostPostponed(tasks, completions, now),
    };
  }, [tasks, completions]);

  const edit = (id: string) => {
    setEditId(id);
    setModal(true);
  };
  const openNew = () => {
    setEditId(null);
    setModal(true);
  };

  const empty =
    data.overdueAll.length +
      data.urgent.length +
      data.timed.length +
      data.untimed.length +
      data.completed.length ===
    0;

  return (
    <main className="px-4 pt-6">
      <header className="mb-4">
        <p className="text-xs font-medium capitalize text-slate-400">{prettyDate(dateKey())}</p>
        <h1 className="text-2xl font-bold tracking-tight">
          Hola, {profile?.name} 👋
        </h1>
      </header>

      <section className="hero flex items-center gap-4 p-5">
        <ProgressRing percent={data.daily.percent} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {data.daily.done}/{data.daily.total} tareas de hoy
          </p>
          <p className="mb-2 text-xs text-white/70">
            {data.daily.percent >= 100 && data.daily.total > 0
              ? '¡Día completo! 🎉'
              : 'Vamos que se puede.'}
          </p>
          <ProgressBar percent={data.weekly.percent} label="Esta semana" light />
        </div>
      </section>

      {data.overdueAll.length > 0 && (
        <>
          <SectionTitle count={data.overdueAll.length} accent="text-red-500">
            Vencidas
          </SectionTitle>
          <div className="space-y-2">
            {data.overdueAll.map((i) => (
              <TaskCard key={`${i.task.id}-${i.date}`} inst={i} onEdit={edit} />
            ))}
          </div>
        </>
      )}

      {data.urgent.length > 0 && (
        <>
          <SectionTitle count={data.urgent.length} accent="text-orange-500">
            Urgentes
          </SectionTitle>
          <div className="space-y-2">
            {data.urgent.map((i) => (
              <TaskCard key={`${i.task.id}-${i.date}`} inst={i} onEdit={edit} />
            ))}
          </div>
        </>
      )}

      {data.timed.length > 0 && (
        <>
          <SectionTitle count={data.timed.length}>Por horario</SectionTitle>
          <div className="space-y-2">
            {data.timed.map((i) => (
              <TaskCard key={`${i.task.id}-${i.date}`} inst={i} onEdit={edit} />
            ))}
          </div>
        </>
      )}

      {data.untimed.length > 0 && (
        <>
          <SectionTitle count={data.untimed.length}>Sin horario</SectionTitle>
          <div className="space-y-2">
            {data.untimed.map((i) => (
              <TaskCard key={`${i.task.id}-${i.date}`} inst={i} onEdit={edit} />
            ))}
          </div>
        </>
      )}

      {data.postponed.length > 0 && (
        <>
          <SectionTitle accent="text-amber-500">Venís posponiendo</SectionTitle>
          <div className="card divide-y divide-slate-100 dark:divide-slate-800">
            {data.postponed.map(({ task, count }) => (
              <div key={task.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="truncate">{task.title}</span>
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                  ×{count}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {data.completed.length > 0 && (
        <>
          <SectionTitle count={data.completed.length} accent="text-emerald-500">
            Completadas hoy
          </SectionTitle>
          <div className="space-y-2 opacity-70">
            {data.completed.map((i) => (
              <TaskCard key={`${i.task.id}-${i.date}`} inst={i} onEdit={edit} />
            ))}
          </div>
        </>
      )}

      {empty && (
        <div className="mt-6">
          <EmptyState icon={<CalendarCheck className="h-10 w-10" />}>
            No tenés tareas para hoy. Tocá el botón + para crear la primera.
          </EmptyState>
        </div>
      )}

      <Fab onClick={openNew} />
      <AddTaskModal open={modal} onClose={() => setModal(false)} editId={editId} />
    </main>
  );
}
