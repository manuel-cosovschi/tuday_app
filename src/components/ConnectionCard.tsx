'use client';

import { useEffect, useState } from 'react';
import { useStore, Manager } from '@/lib/store';
import { Link2, Copy, Check, UserPlus, Loader2, Trash2, LogOut, Users } from 'lucide-react';

export function ConnectionCard() {
  const userId = useStore((s) => s.userId);
  const workspaces = useStore((s) => s.workspaces);
  const createInvite = useStore((s) => s.createInvite);
  const redeemInvite = useStore((s) => s.redeemInvite);
  const loadManagers = useStore((s) => s.loadManagers);
  const revokeManager = useStore((s) => s.revokeManager);
  const leaveWorkspace = useStore((s) => s.leaveWorkspace);
  const switchWorkspace = useStore((s) => s.switchWorkspace);

  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [genLoading, setGenLoading] = useState(false);

  const [redeem, setRedeem] = useState('');
  const [redeemMsg, setRedeemMsg] = useState('');
  const [redeemErr, setRedeemErr] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);

  const [managers, setManagers] = useState<Manager[]>([]);

  const managed = workspaces.filter((w) => w.owner_id !== userId);

  async function refreshManagers() {
    try {
      setManagers(await loadManagers());
    } catch {
      /* noop */
    }
  }
  useEffect(() => {
    refreshManagers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    setGenLoading(true);
    try {
      setCode(await createInvite());
      setCopied(false);
    } finally {
      setGenLoading(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }

  async function link() {
    setRedeemErr('');
    setRedeemMsg('');
    setRedeemLoading(true);
    try {
      const name = await redeemInvite(redeem);
      setRedeemMsg(`¡Vinculado! Ya podés gestionar el calendario de ${name}.`);
      setRedeem('');
    } catch (e: any) {
      setRedeemErr(e?.message || 'No se pudo vincular.');
    } finally {
      setRedeemLoading(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2">
        <Link2 className="h-5 w-5 text-indigo-500" />
        <p className="text-sm font-semibold">Compartir / Conexión</p>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Dejá que otra persona (por ejemplo tu manager) administre tu calendario, o gestioná el de
        alguien más.
      </p>

      {/* Generar código */}
      <div className="mt-4">
        <p className="mb-1 text-xs font-medium text-slate-500">Que alguien maneje MI calendario</p>
        {code ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-xl border border-dashed border-indigo-400 bg-indigo-50 px-3 py-2.5 text-center text-xl font-bold tracking-[0.3em] text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
              {code}
            </div>
            <button
              onClick={copy}
              className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-600 text-white active:scale-90"
              aria-label="Copiar código"
            >
              {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
            </button>
          </div>
        ) : (
          <button
            onClick={generate}
            disabled={genLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"
          >
            {genLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Generar código de invitación
          </button>
        )}
        {code && (
          <p className="mt-1.5 text-[11px] text-slate-400">
            Pasale este código a la otra persona. Lo ingresa abajo en “Vincularme a un calendario”.
            Válido 7 días.
          </p>
        )}
      </div>

      {/* Managers actuales */}
      {managers.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-xs font-medium text-slate-500">Pueden gestionar tu calendario</p>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {managers.map((m) => (
              <div key={m.member_id} className="flex items-center justify-between py-2 text-sm">
                <span className="truncate">{m.name || m.email || 'Usuario'}</span>
                <button
                  onClick={async () => {
                    await revokeManager(m.member_id);
                    refreshManagers();
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Quitar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vincularme */}
      <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
        <p className="mb-1 text-xs font-medium text-slate-500">Vincularme a un calendario</p>
        <div className="flex items-center gap-2">
          <input
            value={redeem}
            onChange={(e) => setRedeem(e.target.value.toUpperCase())}
            placeholder="CÓDIGO"
            maxLength={8}
            className="flex-1 rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 text-center font-bold tracking-[0.2em] outline-none focus:border-indigo-500 dark:border-slate-700"
          />
          <button
            onClick={link}
            disabled={redeemLoading || redeem.length < 4}
            className="flex h-11 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white disabled:opacity-50 active:scale-95"
          >
            {redeemLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Vincular
          </button>
        </div>
        {redeemMsg && <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400">{redeemMsg}</p>}
        {redeemErr && <p className="mt-1.5 text-xs text-red-500">{redeemErr}</p>}
      </div>

      {/* Calendarios que gestiono */}
      {managed.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Users className="h-3.5 w-3.5" /> Calendarios que gestiono
          </p>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {managed.map((w) => (
              <div key={w.owner_id} className="flex items-center justify-between py-2 text-sm">
                <button
                  onClick={() => switchWorkspace(w.owner_id)}
                  className="truncate text-left font-medium text-indigo-600 dark:text-indigo-400"
                >
                  {w.name}
                </button>
                <button
                  onClick={() => leaveWorkspace(w.owner_id)}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-slate-800"
                >
                  <LogOut className="h-3.5 w-3.5" /> Salir
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
