'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, ListTodo, Repeat, Settings } from 'lucide-react';

const items = [
  { href: '/', label: 'Hoy', Icon: ListTodo },
  { href: '/semana', label: 'Semana', Icon: CalendarDays },
  { href: '/habitos', label: 'Hábitos', Icon: Repeat },
  { href: '/ajustes', label: 'Ajustes', Icon: Settings },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--hairline)] bg-[var(--card)]/80 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-xl grid-cols-4 px-2 py-1.5">
        {items.map(({ href, label, Icon }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition ${
                active
                  ? 'text-indigo-600 dark:text-indigo-300'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              <span
                className={`grid h-8 w-12 place-items-center rounded-full transition ${
                  active ? 'bg-indigo-100 dark:bg-indigo-500/20' : ''
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
