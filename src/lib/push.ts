'use client';

import { supabase } from './supabase';

// Clave pública VAPID (segura para el cliente). Puede sobrescribirse por env.
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BJF9rSGJnRIrBYqyYUf_4CX8jaxGI-IzOH5L_-nUvQQIbW0qeFalYAjyt9YaDHd5dEy96LXyTl6f9gWU6vNyh_I';

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// Suscribe este dispositivo y guarda la suscripción en Supabase.
// Devuelve true si quedó suscripto.
export async function subscribeToPush(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
    });
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return false;

  const json = sub.toJSON();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { error } = await supabase.from('tuday_push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      tz,
      user_agent: navigator.userAgent.slice(0, 300),
      last_seen: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  );
  return !error;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await supabase.from('tuday_push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
}
