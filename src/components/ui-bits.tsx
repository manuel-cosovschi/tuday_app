'use client';

import { Plus } from 'lucide-react';

export function SectionTitle({
  children,
  count,
  accent,
}: {
  children: React.ReactNode;
  count?: number;
  accent?: string;
}) {
  return (
    <div className="mb-2 mt-5 flex items-center gap-2 px-1">
      <h2 className={`text-sm font-bold uppercase tracking-wide ${accent ?? 'text-slate-500'}`}>
        {children}
      </h2>
      {count !== undefined && (
        <span className="rounded-full bg-slate-200 px-2 text-[11px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
          {count}
        </span>
      )}
    </div>
  );
}

export function ProgressBar({
  percent,
  label,
  light,
}: {
  percent: number;
  label: string;
  light?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className={light ? 'font-medium text-white/80' : 'font-medium text-slate-500'}>
          {label}
        </span>
        <span className={light ? 'font-bold text-white' : 'font-bold'}>{percent}%</span>
      </div>
      <div
        className={`mt-1.5 h-2 overflow-hidden rounded-full ${
          light ? 'bg-white/25' : 'bg-slate-200 dark:bg-slate-700'
        }`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            light ? 'bg-white' : 'bg-gradient-to-r from-indigo-500 to-violet-500'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

// Anillo de progreso circular (para el hero del dashboard).
export function ProgressRing({
  percent,
  size = 72,
  stroke = 8,
}: {
  percent: number;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="white"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span className="absolute text-lg font-bold text-white">{percent}%</span>
    </div>
  );
}

export function EmptyState({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 p-7 text-center text-sm text-slate-400">
      {icon && <div className="text-slate-300 dark:text-slate-600">{icon}</div>}
      {children}
    </div>
  );
}

export function Fab({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Agregar tarea"
      className="fixed bottom-[max(6.5rem,calc(env(safe-area-inset-bottom)+6.5rem))] right-4 z-30 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-600/40 transition active:scale-90"
    >
      <Plus className="h-7 w-7" />
    </button>
  );
}
