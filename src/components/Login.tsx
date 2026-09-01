'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { CheckCircle2, Loader2, MailCheck } from 'lucide-react';

type Mode = 'signin' | 'signup' | 'reset';

export function Login() {
  const signIn = useStore((s) => s.signIn);
  const signUp = useStore((s) => s.signUp);
  const resetPassword = useStore((s) => s.resetPassword);

  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
      } else if (mode === 'signup') {
        const { needsConfirm } = await signUp(email.trim(), password, name.trim());
        if (needsConfirm) {
          setInfo('Te enviamos un email para confirmar tu cuenta. Confirmalo y luego iniciá sesión.');
          setMode('signin');
        }
      } else {
        await resetPassword(email.trim());
        setInfo('Si el email existe, te enviamos un enlace para restablecer la contraseña.');
        setMode('signin');
      }
    } catch (err: any) {
      setError(translate(err?.message || 'Ocurrió un error.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="card w-full max-w-sm p-7">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
          <CheckCircle2 className="h-8 w-8" />
          <span className="text-2xl font-bold tracking-tight">Tuday</span>
        </div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {mode === 'signup'
            ? 'Creá tu cuenta para sincronizar y compartir tu calendario.'
            : mode === 'reset'
            ? 'Ingresá tu email y te enviamos un enlace para restablecer la contraseña.'
            : 'Iniciá sesión para ver tus tareas en todos tus dispositivos.'}
        </p>

        {info && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{info}</span>
          </div>
        )}

        <form className="mt-5 space-y-3" onSubmit={submit}>
          {mode === 'signup' && (
            <Input label="Nombre" value={name} onChange={setName} placeholder="Manuel" autoFocus />
          )}
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="tu@email.com"
            autoFocus={mode !== 'signup'}
          />
          {mode !== 'reset' && (
            <Input
              label="Contraseña"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
            />
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading || !email.trim() || (mode !== 'reset' && !password) || (mode === 'signup' && !name.trim())}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-semibold text-white disabled:opacity-50 active:scale-[0.99]"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'signin' ? 'Entrar' : mode === 'signup' ? 'Crear cuenta' : 'Enviar enlace'}
          </button>
        </form>

        <div className="mt-4 space-y-1 text-center text-xs text-slate-500">
          {mode === 'signin' && (
            <>
              <button onClick={() => switchMode('signup')} className="block w-full">
                ¿No tenés cuenta? <span className="font-semibold text-indigo-600 dark:text-indigo-400">Registrate</span>
              </button>
              <button onClick={() => switchMode('reset')} className="block w-full text-slate-400">
                Olvidé mi contraseña
              </button>
            </>
          )}
          {mode !== 'signin' && (
            <button onClick={() => switchMode('signin')} className="block w-full">
              ¿Ya tenés cuenta? <span className="font-semibold text-indigo-600 dark:text-indigo-400">Iniciá sesión</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  function switchMode(m: Mode) {
    setMode(m);
    setError('');
    setInfo('');
  }
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={type === 'password' ? 'current-password' : type === 'email' ? 'email' : 'name'}
        className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2.5 outline-none focus:border-indigo-500"
      />
    </div>
  );
}

function translate(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'Email o contraseña incorrectos.';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'Ese email ya está registrado. Iniciá sesión.';
  if (m.includes('password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (m.includes('email not confirmed')) return 'Confirmá tu email antes de iniciar sesión.';
  if (m.includes('unable to validate email')) return 'Email inválido.';
  return msg;
}
