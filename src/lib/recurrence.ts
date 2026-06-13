// Resolución de recurrencias: dada una tarea y una fecha, decide si aplica,
// y construye la "instancia" del día con su estado real.
import { Task, TaskInstance, DayRecord, Completions, Status } from './types';
import { keyToDate, combineDateTime, dateKey } from './date';
import { getDay, getDate, isBefore, startOfDay, parseISO } from 'date-fns';

// ¿La tarea aplica en esta fecha (key yyyy-MM-dd)?
export function appliesOn(task: Task, key: string): boolean {
  if (task.archived) return false;
  const d = keyToDate(key);

  switch (task.type) {
    case 'unica':
      return task.dueDate === key;
    case 'diaria':
      return true;
    case 'semanal':
    case 'habito': {
      // Si no hay días definidos, se asume todos los días.
      if (!task.daysOfWeek || task.daysOfWeek.length === 0) return true;
      return task.daysOfWeek.includes(getDay(d));
    }
    case 'mensual':
      return task.dayOfMonth ? getDate(d) === task.dayOfMonth : false;
    default:
      return false;
  }
}

// Estado efectivo de la tarea en esa fecha.
// Una tarea "pospuesta" cuyo snooze ya venció vuelve a contar como "pendiente"
// para que el motor de recordatorios la retome.
export function resolveStatus(
  task: Task,
  key: string,
  completions: Completions,
  now: Date = new Date()
): { status: Status; record?: DayRecord } {
  const record = completions[task.id]?.[key];
  let status: Status = task.type === 'unica' ? task.status : record?.status ?? 'pendiente';

  if (status === 'pospuesta' && record?.snoozedUntil && now >= parseISO(record.snoozedUntil)) {
    status = 'pendiente';
  }
  return { status, record };
}

export function buildInstance(
  task: Task,
  key: string,
  completions: Completions,
  now: Date = new Date()
): TaskInstance {
  const { status, record } = resolveStatus(task, key, completions, now);
  const dueAt = combineDateTime(key, task.time);
  const dayStart = startOfDay(keyToDate(key));

  let isOverdue = false;
  if (status === 'pendiente') {
    if (isBefore(dayStart, startOfDay(now))) {
      // Día anterior sin completar.
      isOverdue = true;
    } else if (dueAt && isBefore(dueAt, now)) {
      // Hoy pero ya pasó la hora.
      isOverdue = true;
    }
  }

  return { task, date: key, status, record, dueAt, isOverdue };
}

// Todas las instancias que aplican en una fecha.
export function instancesForDate(
  tasks: Task[],
  key: string,
  completions: Completions,
  now: Date = new Date()
): TaskInstance[] {
  return tasks
    .filter((t) => appliesOn(t, key))
    .map((t) => buildInstance(t, key, completions, now));
}

// Tareas únicas vencidas en días anteriores (arrastre de pendientes).
export function overdueSingles(
  tasks: Task[],
  completions: Completions,
  now: Date = new Date()
): TaskInstance[] {
  const todayKey = dateKey(now);
  return tasks
    .filter(
      (t) =>
        t.type === 'unica' &&
        !t.archived &&
        t.status === 'pendiente' &&
        t.dueDate &&
        t.dueDate < todayKey
    )
    .map((t) => buildInstance(t, t.dueDate!, completions, now));
}
