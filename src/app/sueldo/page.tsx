'use client';

import { useCallback, useEffect, useState } from 'react';
import { useStore, SalaryRow, SalaryEntry, Receipt } from '@/lib/store';
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
  Receipt as ReceiptIcon,
  Share2,
  Copy,
  Trash2,
  SlidersHorizontal,
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

/* ---------- Dueño: configuración ---------- */
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

/* ---------- Dueño: cargar sueldo, registrar pagos y ajustes ---------- */
function OwnerSalaryCard({ row, onChange }: { row: SalaryRow; onChange: () => void }) {
  const addSalaryEntry = useStore((s) => s.addSalaryEntry);
  const registerPayment = useStore((s) => s.registerPayment);
  const profile = useStore((s) => s.profile);

  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState('Transferencia');
  const [note, setNote] = useState('');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const num = Number(String(amount).replace(',', '.'));
  const valid = Number.isFinite(num) && num > 0;

  async function addCredit() {
    if (!valid) return setErr('Ingresá un monto válido.');
    setErr('');
    setBusy(true);
    try {
      await addSalaryEntry(row.owner_id, row.member_id, 'credito', num, 'Carga de sueldo');
      setAmount('');
      onChange();
    } catch {
      setErr('No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }

  async function adjust(mode: 'restar' | 'fijar') {
    if (!valid) return setErr('Ingresá un monto válido.');
    setErr('');
    setBusy(true);
    try {
      if (mode === 'restar') {
        await addSalaryEntry(row.owner_id, row.member_id, 'ajuste', -num, 'Ajuste');
      } else {
        const delta = num - row.balance;
        if (delta !== 0) {
          await addSalaryEntry(row.owner_id, row.member_id, 'ajuste', delta, 'Monto fijado');
        }
      }
      setAmount('');
      onChange();
    } catch {
      setErr('No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!valid) return setErr('Ingresá un monto válido.');
    setErr('');
    setBusy(true);
    try {
      const r = await registerPayment(row.member_id, num, method, note || undefined);
      setReceipt(r);
      setAmount('');
      setNote('');
      setPayOpen(false);
      setReloadKey((k) => k + 1);
      onChange();
    } catch (e: any) {
      setErr(
        String(e?.message || '').includes('superar')
          ? `El pago no puede superar el saldo (${money(row.balance, row.currency)}).`
          : 'No se pudo registrar el pago.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <p className="text-xs text-slate-500">Pendiente de pago a</p>
      <p className="font-semibold">{row.counterpart_name}</p>

      <p className="mt-2 text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
        {money(row.balance, row.currency)}
      </p>
      <p className="text-[11px] text-slate-400">Esto es lo que todavía le debés.</p>

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

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          onClick={addCredit}
          disabled={busy || !valid}
          className="flex items-center justify-center gap-1 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          <Plus className="h-4 w-4" /> Sumar sueldo
        </button>
        <button
          onClick={() => setPayOpen((v) => !v)}
          disabled={busy || !valid || row.balance <= 0}
          className="flex items-center justify-center gap-1 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          <ReceiptIcon className="h-4 w-4" /> Registrar pago
        </button>
      </div>

      {payOpen && valid && (
        <div className="mt-3 rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
          <p className="text-sm">
            Vas a registrar un pago de <b>{money(num, row.currency)}</b>. Quedarían{' '}
            <b>{money(row.balance - num, row.currency)}</b> pendientes.
          </p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {['Efectivo', 'Transferencia', 'Otro'].map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`rounded-lg py-2 text-xs font-medium ${
                  method === m
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-600 dark:bg-slate-700 dark:text-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota (opcional)"
            className="mt-2 w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-600"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={pay}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Confirmar y emitir comprobante
            </button>
            <button
              onClick={() => setPayOpen(false)}
              className="rounded-xl bg-slate-200 px-4 text-slate-600 dark:bg-slate-700 dark:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setAdjustOpen((v) => !v)}
        className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-slate-400"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" /> Ajuste manual
      </button>
      {adjustOpen && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            onClick={() => adjust('restar')}
            disabled={busy || !valid}
            className="flex items-center justify-center gap-1 rounded-xl bg-slate-200 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-40 dark:bg-slate-700 dark:text-slate-200"
          >
            <Minus className="h-4 w-4" /> Restar (sin recibo)
          </button>
          <button
            onClick={() => adjust('fijar')}
            disabled={busy || !valid}
            className="flex items-center justify-center gap-1 rounded-xl bg-slate-200 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-40 dark:bg-slate-700 dark:text-slate-200"
          >
            <Equal className="h-4 w-4" /> Fijar en
          </button>
        </div>
      )}

      {err && <p className="mt-2 text-xs text-red-500">{err}</p>}

      <Receipts
        owner={row.owner_id}
        member={row.member_id}
        currency={row.currency}
        canVoid
        ownerName={profile?.name ?? 'Dueño'}
        memberName={row.counterpart_name}
        reloadKey={reloadKey}
        onVoided={onChange}
      />
      <History owner={row.owner_id} member={row.member_id} currency={row.currency} />

      {receipt && (
        <ReceiptModal
          receipt={receipt}
          currency={row.currency}
          ownerName={profile?.name ?? 'Dueño'}
          memberName={row.counterpart_name}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  );
}

/* ---------- Manager ---------- */
function MemberSalaryCard({ row, onChange }: { row: SalaryRow; onChange: () => void }) {
  const settleSalary = useStore((s) => s.settleSalary);
  const profile = useStore((s) => s.profile);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const digits = (row.whatsapp ?? '').replace(/\D/g, '');
  const text = encodeURIComponent(
    `Hola! Te paso el detalle de mi sueldo en Tuday: acumulado hasta hoy ${money(
      row.balance,
      row.currency
    )}. Lo marqué como saldado en la app. ¡Gracias!`
  );
  const waHref = digits ? `https://wa.me/${digits}?text=${text}` : '';

  async function settle() {
    setBusy(true);
    setErr('');
    try {
      await settleSalary(row.owner_id);
      setConfirm(false);
      setReloadKey((k) => k + 1);
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
      <p className="text-[11px] text-slate-400">Pendiente de cobro.</p>

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

      <Receipts
        owner={row.owner_id}
        member={row.member_id}
        currency={row.currency}
        ownerName={row.counterpart_name}
        memberName={profile?.name ?? 'Yo'}
        reloadKey={reloadKey}
      />
      <History owner={row.owner_id} member={row.member_id} currency={row.currency} />
    </div>
  );
}

/* ---------- Comprobantes ---------- */
function Receipts({
  owner,
  member,
  currency,
  canVoid,
  ownerName,
  memberName,
  reloadKey,
  onVoided,
}: {
  owner: string;
  member: string;
  currency: string;
  canVoid?: boolean;
  ownerName: string;
  memberName: string;
  reloadKey: number;
  onVoided?: () => void;
}) {
  const receiptsFor = useStore((s) => s.receiptsFor);
  const [items, setItems] = useState<Receipt[] | null>(null);
  const [open, setOpen] = useState<Receipt | null>(null);

  const load = useCallback(() => {
    receiptsFor(owner, member)
      .then(setItems)
      .catch(() => setItems([]));
  }, [receiptsFor, owner, member]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  if (!items || items.length === 0) return null;

  return (
    <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        <ReceiptIcon className="h-3.5 w-3.5" /> Comprobantes de pago
      </p>
      <div className="space-y-1.5">
        {items.map((r) => (
          <button
            key={r.id}
            onClick={() => setOpen(r)}
            className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-left text-xs dark:bg-slate-800/60"
          >
            <span className="text-slate-500">
              N° {String(r.number).padStart(4, '0')} ·{' '}
              {format(new Date(r.issued_at), 'd MMM yyyy', { locale: es })}
            </span>
            <span className="font-semibold">{money(r.amount, currency)}</span>
          </button>
        ))}
      </div>

      {open && (
        <ReceiptModal
          receipt={open}
          currency={currency}
          ownerName={ownerName}
          memberName={memberName}
          canVoid={canVoid}
          onVoided={() => {
            setOpen(null);
            load();
            onVoided?.();
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function ReceiptModal({
  receipt,
  currency,
  ownerName,
  memberName,
  canVoid,
  onClose,
  onVoided,
}: {
  receipt: Receipt;
  currency: string;
  ownerName: string;
  memberName: string;
  canVoid?: boolean;
  onClose: () => void;
  onVoided?: () => void;
}) {
  const voidReceipt = useStore((s) => s.voidReceipt);
  const [copied, setCopied] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [busy, setBusy] = useState(false);

  const nro = String(receipt.number).padStart(4, '0');
  const texto =
    `RECIBO DE SUELDO N° ${nro}\n` +
    `Fecha: ${format(new Date(receipt.issued_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}\n` +
    `Pagó: ${ownerName}\n` +
    `Recibió: ${memberName}\n` +
    `Monto: ${money(receipt.amount, currency)}\n` +
    (receipt.method ? `Medio: ${receipt.method}\n` : '') +
    (receipt.note ? `Nota: ${receipt.note}\n` : '') +
    `Saldo anterior: ${money(receipt.balance_before, currency)}\n` +
    `Saldo restante: ${money(receipt.balance_after, currency)}`;

  async function share() {
    try {
      if (navigator.share) await navigator.share({ text: texto });
      else throw new Error('no share');
    } catch {
      copy();
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-sm p-5 animate-slideUp">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">
              Recibo de sueldo
            </p>
            <p className="text-lg font-bold">N° {nro}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-3 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
          {money(receipt.amount, currency)}
        </p>

        <div className="mt-3 space-y-1 text-xs text-slate-500">
          <Line label="Fecha" value={format(new Date(receipt.issued_at), "d MMM yyyy, HH:mm", { locale: es })} />
          <Line label="Pagó" value={ownerName} />
          <Line label="Recibió" value={memberName} />
          {receipt.method && <Line label="Medio" value={receipt.method} />}
          {receipt.note && <Line label="Nota" value={receipt.note} />}
          <Line label="Saldo anterior" value={money(receipt.balance_before, currency)} />
          <Line label="Saldo restante" value={money(receipt.balance_after, currency)} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={share}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white"
          >
            <Share2 className="h-4 w-4" /> Compartir
          </button>
          <button
            onClick={copy}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-200 py-2.5 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200"
          >
            <Copy className="h-4 w-4" /> {copied ? '¡Copiado!' : 'Copiar'}
          </button>
        </div>

        {canVoid && (
          <div className="mt-3 text-center">
            {confirmVoid ? (
              <div className="flex items-center justify-center gap-2 text-xs">
                <button
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await voidReceipt(receipt.id);
                      onVoided?.();
                    } finally {
                      setBusy(false);
                    }
                  }}
                  disabled={busy}
                  className="rounded-lg bg-red-50 px-3 py-1.5 font-semibold text-red-600 dark:bg-red-500/15 dark:text-red-300"
                >
                  {busy ? 'Anulando…' : 'Sí, anular y devolver el saldo'}
                </button>
                <button onClick={() => setConfirmVoid(false)} className="text-slate-400">
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmVoid(true)}
                className="inline-flex items-center gap-1 text-[11px] text-slate-400"
              >
                <Trash2 className="h-3.5 w-3.5" /> Anular comprobante
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span>{label}</span>
      <span className="text-right font-medium text-slate-700 dark:text-slate-200">{value}</span>
    </div>
  );
}

/* ---------- Historial ---------- */
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
    <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
      <button onClick={() => setOpen((v) => !v)} className="text-xs font-semibold text-slate-500">
        {open ? 'Ocultar movimientos' : 'Ver todos los movimientos'}
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
                    {format(new Date(e.created_at), 'd MMM HH:mm', { locale: es })} ·{' '}
                    {e.kind === 'pago' ? 'Pago' : e.kind === 'credito' ? 'Carga' : 'Ajuste'}
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
