// Helpers de fecha. Trabajamos con claves yyyy-MM-dd en hora local.
import {
  format,
  parse,
  startOfWeek,
  addDays,
  isToday as dfIsToday,
  parseISO,
} from 'date-fns';

export const DATE_KEY = 'yyyy-MM-dd';

export function dateKey(d: Date = new Date()): string {
  return format(d, DATE_KEY);
}

export function keyToDate(key: string): Date {
  return parse(key, DATE_KEY, new Date());
}

export function isToday(key: string): boolean {
  return dfIsToday(keyToDate(key));
}

// Combina una fecha (key) y hora "HH:mm" en un Date local.
export function combineDateTime(key: string, time?: string): Date | undefined {
  if (!time) return undefined;
  return parse(`${key} ${time}`, `${DATE_KEY} HH:mm`, new Date());
}

// Lunes como inicio de semana (configuración común en LatAm).
export function weekDays(reference: Date = new Date()): Date[] {
  const start = startOfWeek(reference, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const DAY_LABELS_FULL = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

export function prettyDate(key: string): string {
  return format(keyToDate(key), "EEEE d 'de' MMMM");
}

export { format, addDays, parseISO };
