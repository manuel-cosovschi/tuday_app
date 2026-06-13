'use client';

// Helpers de notificaciones web + fallbacks (sonido/vibración) para iOS.

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

// iOS sólo permite Web Push / Notification cuando la PWA está INSTALADA
// (añadida a pantalla de inicio) y en iOS 16.4+. En Safari normal no funciona.
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari legacy
    (window.navigator as any).standalone === true
  );
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iP(hone|ad|od)/.test(navigator.userAgent) ||
    // iPadOS se reporta como Mac con touch
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

interface NotifyOptions {
  body?: string;
  tag?: string;
  renotify?: boolean;
  requireInteraction?: boolean;
}

// Muestra notificación de sistema. Prefiere el Service Worker (necesario en
// móviles); cae a `new Notification` en desktop.
export async function showSystemNotification(title: string, opts: NotifyOptions = {}) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false;
  const options: NotificationOptions & { renotify?: boolean } = {
    body: opts.body,
    tag: opts.tag,
    renotify: opts.renotify,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge.png',
    requireInteraction: opts.requireInteraction ?? true,
    data: { url: '/' },
  };
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, options);
        return true;
      }
    }
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

// Fallbacks que funcionan con la app abierta (clave en iPhone).
export function vibrate(pattern: number | number[] = [200, 100, 200]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* noop */
  }
}

let audioCtx: AudioContext | null = null;
export function beep(durationMs = 400) {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx ?? new Ctx();
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch {
    /* noop */
  }
}

export async function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    /* el SW es opcional para el funcionamiento básico */
  }
}
