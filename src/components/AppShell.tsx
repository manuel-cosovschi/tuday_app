'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { ReminderProvider } from './ReminderProvider';
import { BottomNav } from './BottomNav';
import { FocusOverlay } from './FocusOverlay';
import { Login } from './Login';

function applyTheme(theme: 'light' | 'dark' | 'system') {
  const root = document.documentElement;
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', dark);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const profile = useStore((s) => s.profile);
  const theme = useStore((s) => s.settings.theme);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    applyTheme(theme);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => theme === 'system' && applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme, mounted]);

  if (!mounted) {
    return (
      <div className="min-h-screen grid place-items-center text-slate-400">Cargando…</div>
    );
  }

  if (!profile) return <Login />;

  return (
    <ReminderProvider>
      <div className="mx-auto max-w-xl min-h-screen pb-24">{children}</div>
      <FocusOverlay />
      <BottomNav />
    </ReminderProvider>
  );
}
