'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  requestNotificationPermission,
  notificationPermission,
  isIOS,
  isStandalone,
  showSystemNotification,
  beep,
  vibrate,
} from '@/lib/notifications';
import { Bell, Moon, Sun, Smartphone, LogOut, Volume2, Vibrate, Target, Share } from 'lucide-react';

export default function SettingsPage() {
  const profile = useStore((s) => s.profile);
  const logout = useStore((s) => s.logout);
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);

  const [perm, setPerm] = useState<string>('default');
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(true);

  useEffect(() => {
    setPerm(notificationPermission());
    setIos(isIOS());
    setStandalone(isStandalone());
  }, []);

  async function enableNotifications() {
    const res = await requestNotificationPermission();
    setPerm(res);
    update({ notificationsEnabled: res === 'granted' });
    if (res === 'granted') {
      showSystemNotification('Tuday', { body: '¡Notificaciones activadas! Te vamos a avisar.' });
    }
  }

  return (
    <main className="px-4 pt-6 space-y-5">
      <h1 className="text-2xl font-bold">Ajustes</h1>

      {/* Perfil */}
      <div className="card p-4">
        <p className="text-xs text-slate-500">Sesión</p>
        <p className="mt-0.5 font-semibold">{profile?.name}</p>
        {profile?.email && <p className="text-sm text-slate-400">{profile.email}</p>}
        <button
          onClick={logout}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        >
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </button>
      </div>

      {/* Tema */}
      <div className="card p-4">
        <p className="mb-2 text-sm font-semibold">Apariencia</p>
        <div className="grid grid-cols-3 gap-2">
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button
              key={t}
              onClick={() => update({ theme: t })}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium capitalize ${
                settings.theme === t
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {t === 'light' && <Sun className="h-4 w-4" />}
              {t === 'dark' && <Moon className="h-4 w-4" />}
              {t === 'light' ? 'Claro' : t === 'dark' ? 'Oscuro' : 'Auto'}
            </button>
          ))}
        </div>
      </div>

      {/* Notificaciones */}
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-indigo-500" />
          <p className="text-sm font-semibold">Recordatorios</p>
        </div>

        <button
          onClick={enableNotifications}
          className="mt-3 w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white"
        >
          {perm === 'granted'
            ? 'Notificaciones activadas ✓'
            : 'Activar notificaciones push'}
        </button>
        <p className="mt-2 text-[11px] text-slate-400">
          Estado del permiso: <b>{perm}</b>
        </p>

        <Toggle
          icon={<Target className="h-4 w-4" />}
          label="Modo enfoque (insiste en pantalla)"
          checked={settings.focusMode}
          onChange={(v) => update({ focusMode: v })}
        />
        <Toggle
          icon={<Volume2 className="h-4 w-4" />}
          label="Sonido"
          checked={settings.soundEnabled}
          onChange={(v) => {
            update({ soundEnabled: v });
            if (v) beep();
          }}
        />
        <Toggle
          icon={<Vibrate className="h-4 w-4" />}
          label="Vibración"
          checked={settings.vibrationEnabled}
          onChange={(v) => {
            update({ vibrationEnabled: v });
            if (v) vibrate();
          }}
        />

        <div className="mt-3 grid grid-cols-2 gap-3">
          <NumberField
            label="Repetir cada (min)"
            value={settings.repeatEveryMin}
            onChange={(n) => update({ repeatEveryMin: n })}
          />
          <NumberField
            label="Urgentes cada (min)"
            value={settings.repeatEveryUrgentMin}
            onChange={(n) => update({ repeatEveryUrgentMin: n })}
          />
        </div>
      </div>

      {/* Aviso iOS */}
      {ios && (
        <div className="card border border-amber-300/50 bg-amber-50 p-4 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-300">
            <Smartphone className="h-5 w-5" /> Estás en iPhone / iPad
          </div>
          {!standalone ? (
            <div className="mt-2 space-y-1 text-amber-800 dark:text-amber-200">
              <p className="font-medium">Para recibir notificaciones push en iOS necesitás instalar la app:</p>
              <ol className="ml-4 list-decimal space-y-0.5 text-[13px]">
                <li>Tocá <Share className="inline h-3.5 w-3.5" /> <b>Compartir</b> en Safari.</li>
                <li>Elegí <b>“Agregar a pantalla de inicio”</b>.</li>
                <li>Abrí Tuday desde el ícono y activá las notificaciones.</li>
              </ol>
              <p className="mt-1 text-[12px]">
                iOS sólo permite Web Push (16.4+) cuando la app está instalada. Mientras tanto,
                el <b>modo enfoque</b>, el sonido y la vibración funcionan con la app abierta.
              </p>
            </div>
          ) : (
            <p className="mt-2 text-[13px] text-amber-800 dark:text-amber-200">
              App instalada ✓. Activá las notificaciones arriba. Recordá: en iOS las push pueden
              demorarse o no llegar con la app cerrada; el modo enfoque garantiza el aviso al abrir.
            </p>
          )}
        </div>
      )}

      <p className="pb-4 text-center text-[11px] text-slate-400">Tuday · MVP local-first</p>
    </main>
  );
}

function Toggle({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="mt-3 flex w-full items-center justify-between"
    >
      <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        {icon}
        {label}
      </span>
      <span
        className={`relative h-6 w-11 rounded-full transition ${
          checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(Math.max(1, Number(e.target.value)))}
        className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 outline-none focus:border-indigo-500 dark:border-slate-700"
      />
    </label>
  );
}
