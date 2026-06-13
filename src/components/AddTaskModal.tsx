'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { Priority, TaskType, DEFAULT_CATEGORIES } from '@/lib/types';
import { dateKey, DAY_LABELS } from '@/lib/date';
import { X, Trash2 } from 'lucide-react';

const PRIORITIES: Priority[] = ['baja', 'media', 'alta', 'urgente'];
const TYPES: { value: TaskType; label: string }[] = [
  { value: 'unica', label: 'Única' },
  { value: 'diaria', label: 'Diaria' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensual', label: 'Mensual' },
  { value: 'habito', label: 'Hábito' },
];

export function AddTaskModal({
  open,
  onClose,
  editId,
  defaultType = 'unica',
}: {
  open: boolean;
  onClose: () => void;
  editId?: string | null;
  defaultType?: TaskType;
}) {
  const tasks = useStore((s) => s.tasks);
  const addTask = useStore((s) => s.addTask);
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);

  const editing = editId ? tasks.find((t) => t.id === editId) : undefined;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(DEFAULT_CATEGORIES[0]);
  const [priority, setPriority] = useState<Priority>('media');
  const [type, setType] = useState<TaskType>(defaultType);
  const [due, setDue] = useState(dateKey());
  const [time, setTime] = useState('');
  const [durationMin, setDurationMin] = useState<string>('');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [dayOfMonth, setDayOfMonth] = useState<string>('1');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description ?? '');
      setCategory(editing.category);
      setPriority(editing.priority);
      setType(editing.type);
      setDue(editing.dueDate ?? dateKey());
      setTime(editing.time ?? '');
      setDurationMin(editing.durationMin ? String(editing.durationMin) : '');
      setDays(editing.daysOfWeek ?? [1, 2, 3, 4, 5]);
      setDayOfMonth(editing.dayOfMonth ? String(editing.dayOfMonth) : '1');
    } else {
      setTitle('');
      setDescription('');
      setCategory(DEFAULT_CATEGORIES[0]);
      setPriority('media');
      setType(defaultType);
      setDue(dateKey());
      setTime('');
      setDurationMin('');
      setDays([1, 2, 3, 4, 5]);
      setDayOfMonth('1');
    }
  }, [open, editId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const showDays = type === 'semanal' || type === 'habito';
  const showDate = type === 'unica';
  const showMonth = type === 'mensual';

  function save() {
    if (!title.trim()) return;
    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      priority,
      type,
      time: time || undefined,
      durationMin: durationMin ? Number(durationMin) : undefined,
      dueDate: showDate ? due : undefined,
      daysOfWeek: showDays ? days : undefined,
      dayOfMonth: showMonth ? Number(dayOfMonth) : undefined,
    };
    if (editing) updateTask(editing.id, payload);
    else addTask(payload);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-xl card rounded-b-none sm:rounded-3xl animate-slideUp max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between bg-[var(--card)] px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-bold">{editing ? 'Editar' : 'Nueva tarea'}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <Field label="Título">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Revisar campañas de Meta Ads"
              className="input"
            />
          </Field>

          <Field label="Descripción (opcional)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="input resize-none"
            />
          </Field>

          <Field label="Tipo">
            <div className="grid grid-cols-5 gap-1.5">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`rounded-lg py-2 text-xs font-medium transition ${
                    type === t.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Prioridad">
            <div className="grid grid-cols-4 gap-1.5">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`rounded-lg py-2 text-xs font-medium capitalize transition ${
                    priority === p
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </Field>

          {showDate && (
            <Field label="Fecha">
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="input" />
            </Field>
          )}

          {showDays && (
            <Field label="Días activos">
              <div className="flex gap-1.5">
                {DAY_LABELS.map((d, i) => {
                  const on = days.includes(i);
                  return (
                    <button
                      key={i}
                      onClick={() =>
                        setDays((prev) =>
                          prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
                        )
                      }
                      className={`h-9 flex-1 rounded-lg text-xs font-medium ${
                        on
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          {showMonth && (
            <Field label="Día del mes">
              <input
                type="number"
                min={1}
                max={31}
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                className="input"
              />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Hora (opcional)">
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input" />
            </Field>
            <Field label="Duración (min)">
              <input
                type="number"
                min={0}
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                placeholder="30"
                className="input"
              />
            </Field>
          </div>

          <Field label="Categoría">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
              {DEFAULT_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="sticky bottom-0 flex gap-2 bg-[var(--card)] p-4 border-t border-slate-100 dark:border-slate-800">
          {editing && (
            <button
              onClick={() => {
                deleteTask(editing.id);
                onClose();
              }}
              className="rounded-xl bg-red-50 px-4 py-3 text-red-600 dark:bg-red-500/10"
              aria-label="Eliminar"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={save}
            disabled={!title.trim()}
            className="flex-1 rounded-xl bg-indigo-600 py-3 font-semibold text-white disabled:opacity-50 active:scale-[0.99]"
          >
            {editing ? 'Guardar cambios' : 'Crear'}
          </button>
        </div>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          border-radius: 0.75rem;
          border: 1px solid rgb(226 232 240);
          background: transparent;
          padding: 0.625rem 0.75rem;
          outline: none;
          -webkit-appearance: none;
          appearance: none;
        }
        .dark .input {
          border-color: rgb(51 65 85);
        }
        .input:focus {
          border-color: #6366f1;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}
