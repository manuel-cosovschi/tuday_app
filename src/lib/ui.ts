import { Priority, TaskType, Status } from './types';

export const PRIORITY_LABEL: Record<Priority, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
};

// Clases de borde/acento por prioridad.
export const PRIORITY_BAR: Record<Priority, string> = {
  baja: 'bg-blue-500',
  media: 'bg-amber-500',
  alta: 'bg-orange-500',
  urgente: 'bg-red-500',
};

export const PRIORITY_CHIP: Record<Priority, string> = {
  baja: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  media: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  alta: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  urgente: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
};

export const TYPE_LABEL: Record<TaskType, string> = {
  unica: 'Única',
  diaria: 'Diaria',
  semanal: 'Semanal',
  mensual: 'Mensual',
  habito: 'Hábito',
};

export const STATUS_LABEL: Record<Status, string> = {
  pendiente: 'Pendiente',
  completada: 'Completada',
  pospuesta: 'Pospuesta',
  cancelada: 'Cancelada',
};
