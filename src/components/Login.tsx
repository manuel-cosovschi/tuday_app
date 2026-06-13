'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { CheckCircle2 } from 'lucide-react';

export function Login() {
  const login = useStore((s) => s.login);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="card w-full max-w-sm p-7">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
          <CheckCircle2 className="h-8 w-8" />
          <span className="text-2xl font-bold tracking-tight">Tuday</span>
        </div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Tus tareas y hábitos del día, sin olvidos. Te insiste hasta que las marques.
        </p>

        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) login(name.trim(), email.trim() || undefined);
          }}
        >
          <div>
            <label className="text-xs font-medium text-slate-500">Tu nombre</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Manuel"
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2.5 outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Email (opcional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2.5 outline-none focus:border-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white disabled:opacity-50 active:scale-[0.99] transition"
          >
            Entrar
          </button>
        </form>

        <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
          MVP: tus datos se guardan localmente en este dispositivo. En la versión con
          backend (Supabase) tendrás registro, login real y sincronización entre dispositivos.
        </p>
      </div>
    </div>
  );
}
