'use client';

import { useCallback, useEffect, useState } from 'react';
import { useStore, SalaryRow, SalaryEntry } from '@/lib/store';
import { EmptyState } from '@/components/ui-bits';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Wallet,
  Plus,
  Minus,
  Equal,
  Loader2,
  Send,
  Settings2,
  Check,
  X,
} from 'lucide-react';

function money(n: number, currency: string) {
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency || 'ARS',
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

export default function SalaryPage() {
  const userId = useStore((s) => s.userId);
  const salaryOverview = useStore((s) => s.salaryOverview);

  const [rows, setRows] = useState<SalaryRow[] | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setRows(await salaryOverview());
      setError('');
    } catch {
      setError('No pudimos cargar el sueldo. Revisá la conexión.');
    }
  }, [salaryOverview]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const asOwner = (rows ?? []).filter((r) => r.i_am_owner);
  const asMember = (rows ?? []).filter((r) => !r.i_am_owner);

  return (
    <main className="px-4 pt-6">
      <div className="mb-3 flex items-center gap-2">
        <Wallet className="h-6 w-6 text-indigo-500" />
        <h1 className="text-2xl font-bold">Sueldo</h1>
      </div>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      {rows === null ? (
        <div className="card grid place-items-center p-8 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Wallet className="h-10 w-10" />}>
          Todavía no hay nadie vinculado. Cuando conectes a tu manager en Ajustes →
          Compartir, vas a poder cargarle el sueldo acá.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {asOwner.length > 0 && <OwnerConfigCard onSaved={refresh} rows={asOwner} />}
          {asOwner.map((r) => (
            <OwnerSalaryCard key={r.member_id} row={r} onChange={refresh} />
          ))}
          {asMember.map((r) => (
            <MemberSalaryCard key={r.owner_id} row={r} onChange={refresh} />
          ))}
        </div>
      )}
    </main>
  );
}

/* ---------- Dueño: configuración (WhatsApp + moneda) ---------- */
function OwnerConfigCard({ rows, onSaved }: { rows: SalaryRow[]; onSaved: () => void }) {
  const saveSalaryConfig = useStore((s) => s.saveSalaryConfig);
  const [open, setOpen] = useState(false);
  const [whatsapp, setWhatsapp] = useState(rows[0]?.whatsapp ?? '');
  const [currency, setCurrency] = useState(rows[0]?.currency ?? 'ARS');
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await saveSalaryConfig(currency, whatsapp);
      setOk(true);
      setTimeout(() => setOk(false), 1500);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-4">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 text-sm font-semibold">
        <Settings2 className="h-4 w-4 text-slate-400" />
        Configuración de cobro
      </button>
      {!rows[0]?.whatsapp && (
        <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
          Cargá tu WhatsApp para que te llegue el aviso cuando salde.
        </p>
      )}
      {open && (
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Tu WhatsApp (con código de país, ej: 5491122334455)
            </span>
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              inputMode="numeric"
              placeholder="5491122334455"
              className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 outline-none focus:border-indigo-500 dark:border-slate-700"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Moneda</span>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 outline-none focus:border-indigo-500 dark:border-slate-700"
            >
              <option value="ARS">Peso argentino (ARS)</option>
              <option value="USD">Dólar (USD)</option>
              <option value="EUR">Euro (EUR)</option>
            </select>
          </label>
          <button
            onClick={save}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {ok ? '¡Guardado!' : 'Guardar'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Dueño: control del sueldo de cada manager ---------- */
function OwnerSalaryCard({ row, onChange }: { row: SalaryRow; onChange: () => void }) {
  const addSalaryEntry = useStore((s) => s.addSalaryEntry);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function apply(mode: 'sumar' | 'restar' | 'fijar') {
    const n = Number(String(amount).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) {
      setErr('Ingresá un monto válido.');
      return;
    }
    setErr('');
    setBusy(true);
    try {
      if (mode === 'sumar') {
        await addSalaryEntry(row.owner_id, row.member_id, 'credito', n, 'Carga de sueldo');
      } else if (mode === 'restar') {
        await addSalaryEntry(row.owner_id, row.member_id, 'ajuste', -n, 'Ajuste');
      } else {
        const delta = n - row.balance;
        if (delta !== 0) {
          await addSalaryEntry(row.owner_id, row.member_id, 'ajuste', delta, 'Monto fijado');
        }
      }
      setAmount('');
      onChange();
    } catch {
      setErr('No se pudo guardar. Revisá la conexión.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <p className="text-xs text-slate-500">Sueldo disponible de</p>
      <p className="font-semibold">{row.counterpart_name}</p>

      <p className="mt-2 text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
        {money(row.balance, row.currency)}
      </p>

      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Monto</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0"
          className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 text-lg outline-none focus:border-indigo-500 dark:border-slate-700"
        />
      </label>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <button
          onClick={() => apply('sumar')}
          disabled={busy || !amount}
          className="flex items-center justify-center gap-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          <Plus className="h-4 w-4" /> Sumar
        </button>
        <button
          onClick={() => apply('restar')}
          disabled={busy || !amount}
          className="flex items-center justify-center gap-1 rounded-xl bg-slate-200 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-40 dark:bg-slate-700 dark:text-slate-200"
        >
          <Minus className="h-4 w-4" /> Restar
        </button>
        <button
          onClick={() => apply('fijar')}
          disabled={busy || !amount}
          className="flex items-center justify-center gap-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          <Equal className="h-4 w-4" /> Fijar
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-red-500">{err}</p>}
      <p className="mt-2 text-[11px] text-slate-400">
        Solo vos podés modificar este monto. Tu manager lo ve actualizado al instante.
      </p>

      <History owner={row.owner_id} member={row.member_id} currency={row.currency} />
    </div>
  );
}

/* ---------- Manager: ver saldo y saldar ---------- */
function MemberSalaryCard({ row, onChange }: { row: SalaryRow; onChange: () => void }) {
  const settleSalary = useStore((s) => s.settleSalary);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const digits = (row.whatsapp ?? '').replace(/\D/g, '');
  const text = encodeURIComponent(
    `Hola! Te paso el detalle de mi sueldo en Tuday: acumulado hasta hoy ${money(
      row.balance,
      row.currency
    )}. Lo marqué como saldado en la app. ¡Gracias!`
  );
  const waHref = digits ? `https://wa.me/${digits}?text=${text}` : '';
  const canSettle = row.balance > 0 && !!digits;

  async function settle() {
    setBusy(true);
    setErr('');
    try {
      await settleSalary(row.owner_id);
      setConfirm(false);
      onChange();
    } catch {
      setErr('No se pudo saldar. Probá de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <p className="text-xs text-slate-500">Tu sueldo acumulado</p>
      <p className="font-semibold">con {row.counterpart_name}</p>

      <p className="mt-2 text-4xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
        {money(row.balance, row.currency)}
      </p>

      {row.balance <= 0 ? (
        <p className="mt-3 text-sm text-slate-400">No hay saldo pendiente por ahora.</p>
      ) : !digits ? (
        <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
          Para poder saldar, {row.counterpart_name} tiene que cargar su WhatsApp en esta
          sección.
        </p>
      ) : !confirm ? (
        <button
          onClick={() => setConfirm(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 font-semibold text-white active:scale-[0.99]"
        >
          <Send className="h-5 w-5" /> Saldar sueldo
        </button>
      ) : (
        <div className="mt-4 rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
          <p className="text-sm">
            Vas a marcar <b>{money(row.balance, row.currency)}</b> como saldado y enviarle
            el mensaje por WhatsApp.
          </p>
          <div className="mt-3 flex gap-2">
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              onClick={settle}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white ${
                busy ? 'opacity-60' : ''
              }`}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Enviar y saldar
            </a>
            <button
              onClick={() => setConfirm(false)}
              className="rounded-xl bg-slate-200 px-4 text-sm font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      {err && <p className="mt-2 text-xs text-red-500">{err}</p>}
      {!canSettle && row.balance > 0 && digits === '' ? null : null}

      <History owner={row.owner_id} member={row.member_id} currency={row.currency} />
    </div>
  );
}

/* ---------- Historial de movimientos ---------- */
function History({
  owner,
  member,
  currency,
}: {
  owner: string;
  member: string;
  currency: string;
}) {
  const salaryEntries = useStore((s) => s.salaryEntries);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SalaryEntry[] | null>(null);

  useEffect(() => {
    if (!open) return;
    salaryEntries(owner, member)
      .then(setItems)
      .catch(() => setItems([]));
  }, [open, owner, member, salaryEntries]);

  return (
    <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
      <button onClick={() => setOpen((v) => !v)} className="text-xs font-semibold text-slate-500">
        {open ? 'Ocultar movimientos' : 'Ver movimientos'}
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {items === null ? (
            <p className="text-xs text-slate-400">Cargando…</p>
          ) : items.length === 0 ? (
            <p className="text-xs text-slate-400">Sin movimientos todavía.</p>
          ) : (
            items.map((e) => {
              const negative = e.kind === 'pago' || e.amount < 0;
              const shown = e.kind === 'pago' ? -Math.abs(e.amount) : e.amount;
              return (
                <div key={e.id} className="flex items-center justify-between text-xs">
                  <span className="truncate text-slate-500">
                    {format(new Date(e.created_at), "d MMM HH:mm", { locale: es })} ·{' '}
                    {e.kind === 'pago' ? 'Saldado' : e.kind === 'credito' ? 'Carga' : 'Ajuste'}
                  </span>
                  <span
                    className={`shrink-0 font-semibold ${
                      negative ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {money(shown, currency)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
