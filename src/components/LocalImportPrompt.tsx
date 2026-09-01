'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { Task, Completions } from '@/lib/types';
import { UploadCloud, Loader2, X } from 'lucide-react';

const OLD_KEY = 'tuday-store-v1';
const DONE_KEY = 'tuday-import-done';

export function LocalImportPrompt() {
  const userId = useStore((s) => s.userId);
  const workspaceOwnerId = useStore((s) => s.workspaceOwnerId);
  const cloudTasks = useStore((s) => s.tasks);
  const loading = useStore((s) => s.loading);
  const importLocal = useStore((s) => s.importLocal);

  const [local, setLocal] = useState<{ tasks: Task[]; completions: Completions } | null>(null);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(DONE_KEY)) return;
      const raw = localStorage.getItem(OLD_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const st = parsed?.state ?? parsed;
      const tasks: Task[] = st?.tasks ?? [];
      if (Array.isArray(tasks) && tasks.length > 0) {
        setLocal({ tasks, completions: st?.completions ?? {} });
      }
    } catch {
      /* noop */
    }
  }, []);

  // Solo en tu propio calendario, ya cargado y vacío en la nube.
  const show =
    local &&
    userId &&
    workspaceOwnerId === userId &&
    !loading &&
    cloudTasks.length === 0 &&
    count === 0;

  if (!show) return null;

  function dismiss() {
    localStorage.setItem(DONE_KEY, '1');
    setLocal(null);
  }

  async function doImport() {
    if (!local) return;
    setBusy(true);
    const n = await importLocal(local.tasks, local.completions);
    localStorage.setItem(DONE_KEY, '1');
    setBusy(false);
    setCount(n);
    setLocal(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="card w-full max-w-sm p-6 animate-slideUp">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20">
          <UploadCloud className="h-6 w-6" />
        </div>
        <h2 className="text-center text-lg font-bold">Importar tus tareas</h2>
        <p className="mt-1 text-center text-sm text-slate-500">
          Encontramos {local!.tasks.length} tarea(s) guardadas en este dispositivo. ¿Querés
          subirlas a tu cuenta para tenerlas sincronizadas?
        </p>
        <button
          onClick={doImport}
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-semibold text-white disabled:opacity-50 active:scale-[0.99]"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Importar a mi cuenta
        </button>
        <button
          onClick={dismiss}
          className="mt-2 flex w-full items-center justify-center gap-1 py-2 text-xs text-slate-400"
        >
          <X className="h-3.5 w-3.5" /> Empezar de cero
        </button>
      </div>
    </div>
  );
}
