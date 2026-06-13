// Estadísticas: cumplimiento diario/semanal, rachas de hábitos, posposiciones.
import { Task, Completions, TaskInstance } from './types';
import { instancesForDate, appliesOn, resolveStatus } from './recurrence';
import { dateKey, weekDays, format } from './date';
import { subDays } from 'date-fns';

export interface Completion {
  total: number;
  done: number;
  percent: number; // 0-100
}

function summarize(instances: TaskInstance[]): Completion {
  const relevant = instances.filter((i) => i.status !== 'cancelada');
  const total = relevant.length;
  const done = relevant.filter((i) => i.status === 'completada').length;
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function dailyCompletion(
  tasks: Task[],
  completions: Completions,
  key = dateKey()
): Completion {
  return summarize(instancesForDate(tasks, key, completions));
}

export function weeklyCompletion(
  tasks: Task[],
  completions: Completions,
  reference = new Date()
): Completion {
  let total = 0;
  let done = 0;
  for (const d of weekDays(reference)) {
    const c = summarize(instancesForDate(tasks, format(d, 'yyyy-MM-dd'), completions));
    total += c.total;
    done += c.done;
  }
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
}

// Racha actual y mejor racha de un hábito (días activos consecutivos completados).
export function habitStreaks(
  habit: Task,
  completions: Completions,
  now = new Date()
): { current: number; best: number; history: { date: string; done: boolean }[] } {
  const history: { date: string; done: boolean }[] = [];
  let current = 0;
  let best = 0;
  let run = 0;
  let currentBroken = false;

  // Miramos hasta 90 días hacia atrás.
  for (let i = 0; i < 90; i++) {
    const d = subDays(now, i);
    const key = format(d, 'yyyy-MM-dd');
    if (!appliesOn(habit, key)) continue;
    const { status } = resolveStatus(habit, key, completions);
    const done = status === 'completada';
    if (i < 30) history.push({ date: key, done });

    if (done) {
      run += 1;
      best = Math.max(best, run);
      if (!currentBroken) current = run;
    } else {
      // El día de hoy todavía pendiente no rompe la racha.
      const isToday = i === 0;
      if (!isToday) {
        currentBroken = true;
      }
      run = 0;
    }
  }

  return { current, best, history: history.reverse() };
}

// Tareas que más se posponen (suma de postponeCount en los últimos 30 días).
export function mostPostponed(
  tasks: Task[],
  completions: Completions,
  now = new Date()
): { task: Task; count: number }[] {
  const counts = new Map<string, number>();

  for (const [taskId, byDate] of Object.entries(completions)) {
    for (const [, rec] of Object.entries(byDate)) {
      counts.set(taskId, (counts.get(taskId) ?? 0) + (rec.postponeCount ?? 0));
    }
  }
  // También tareas únicas con postponeCount en su DayRecord ya cubierto arriba.

  return tasks
    .map((t) => ({ task: t, count: counts.get(t.id) ?? 0 }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}
