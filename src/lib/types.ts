// Tipos del dominio de Tuday.

export type Priority = 'baja' | 'media' | 'alta' | 'urgente';

export type TaskType =
  | 'unica' // tarea única con fecha concreta
  | 'diaria' // se repite todos los días
  | 'semanal' // se repite en días concretos de la semana
  | 'mensual' // se repite un día del mes
  | 'habito'; // hábito (diario o por días), con racha e historial

// Estado por instancia/día (las recurrentes se resuelven por fecha).
export type Status = 'pendiente' | 'completada' | 'pospuesta' | 'cancelada';

export interface Task {
  id: string;
  title: string;
  description?: string;
  category: string;
  priority: Priority;
  type: TaskType;

  // Para tarea única: fecha concreta (yyyy-MM-dd).
  dueDate?: string;
  // Hora específica HH:mm (opcional).
  time?: string;
  // Duración estimada en minutos.
  durationMin?: number;

  // Recurrencia.
  daysOfWeek?: number[]; // 0=Dom ... 6=Sáb (semanal/habito)
  dayOfMonth?: number; // 1-31 (mensual)

  // Estado para tareas únicas (las recurrentes usan el log de completions).
  status: Status;

  createdAt: string; // ISO
  archived?: boolean;
}

// Registro de lo que pasó con una tarea recurrente en una fecha concreta.
export interface DayRecord {
  status: Status;
  completedAt?: string; // ISO
  snoozedUntil?: string; // ISO — no notificar hasta esta hora
  postponeCount: number;
}

// completions[taskId][yyyy-MM-dd] = DayRecord
export type Completions = Record<string, Record<string, DayRecord>>;

// Una instancia "resuelta" de tarea para un día concreto (lo que se muestra).
export interface TaskInstance {
  task: Task;
  date: string; // yyyy-MM-dd
  status: Status;
  record?: DayRecord;
  // Momento (Date) en que vence, si tiene hora.
  dueAt?: Date;
  isOverdue: boolean;
}

export interface UserProfile {
  name: string;
  email?: string;
  createdAt: string;
}

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  focusMode: boolean; // la app insiste en pantalla mientras está abierta
  // Cadencia de re-notificación (minutos).
  repeatEveryMin: number; // normal
  repeatEveryUrgentMin: number; // urgente
  preNotifyMin: number; // minutos antes de la hora
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  notificationsEnabled: false,
  soundEnabled: true,
  vibrationEnabled: true,
  focusMode: true,
  repeatEveryMin: 10,
  repeatEveryUrgentMin: 5,
  preNotifyMin: 10,
};

export const PRIORITY_ORDER: Record<Priority, number> = {
  urgente: 0,
  alta: 1,
  media: 2,
  baja: 3,
};

export const DEFAULT_CATEGORIES = [
  'Trabajo',
  'Estudio',
  'Salud',
  'Contenido',
  'Marketing',
  'Personal',
  'Finanzas',
];
