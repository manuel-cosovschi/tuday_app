// Tuday — Edge Function de recordatorios Web Push.
// Se invoca cada minuto (pg_cron). Recorre las suscripciones, calcula qué tareas
// vencen (según la hora local de cada usuario) y envía notificaciones push
// insistentes: 10' antes, en la hora, y repite cada 10' (5' urgentes) hasta que
// la tarea se marca hecha/pospuesta/cancelada.
//
// Secretos (VAPID + cron) se leen de la tabla public.tuday_secrets con service role,
// así no viven en el código ni en el repo.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

type Row = Record<string, any>;

const NIGHT_START = 7 * 60; // 07:00
const NIGHT_END = 23 * 60 + 59; // 23:59
const MAX_REPEATS = 12; // tope de avisos por tarea/día
const OVERDUE_WINDOW_MIN = 6 * 60; // dejar de insistir 6h después de la hora

function localParts(tz: string, now: Date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(now)) p[part.type] = part.value;
  const year = +p.year,
    month = +p.month,
    day = +p.day;
  let hour = +p.hour;
  if (hour === 24) hour = 0;
  const minute = +p.minute;
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const minutes = hour * 60 + minute;
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { dateStr, minutes, dow, dom: day };
}

function appliesOn(task: Row, dateStr: string, dow: number, dom: number): boolean {
  switch (task.type) {
    case 'unica':
      return task.due_date === dateStr;
    case 'diaria':
      return true;
    case 'semanal':
    case 'habito':
      if (!task.days_of_week || task.days_of_week.length === 0) return true;
      return task.days_of_week.includes(dow);
    case 'mensual':
      return task.day_of_month === dom;
    default:
      return false;
  }
}

function parseTime(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  return +m[1] * 60 + +m[2];
}

Deno.serve(async (req: Request) => {
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Secretos
  const { data: secretRows } = await admin.from('tuday_secrets').select('key,value');
  const secrets: Record<string, string> = {};
  for (const r of secretRows ?? []) secrets[r.key] = r.value;

  // Auth del cron
  const provided = req.headers.get('x-tuday-cron');
  if (!secrets.cron_secret || provided !== secrets.cron_secret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  webpush.setVapidDetails(
    secrets.vapid_subject || 'mailto:noreply@tuday.app',
    secrets.vapid_public,
    secrets.vapid_private
  );

  const now = new Date();

  // Suscripciones agrupadas por usuario
  const { data: subs } = await admin.from('tuday_push_subscriptions').select('*');
  const byUser = new Map<string, Row[]>();
  for (const s of subs ?? []) {
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
    byUser.get(s.user_id)!.push(s);
  }

  let sent = 0;
  const deadEndpoints: string[] = [];
  const stateUpserts: Row[] = [];

  for (const [owner, userSubs] of byUser) {
    const tz = userSubs.find((s) => s.tz)?.tz || 'UTC';
    const { dateStr, minutes, dow, dom } = localParts(tz, now);
    if (minutes < NIGHT_START || minutes > NIGHT_END) continue; // respetar la noche

    const [{ data: tasks }, { data: logs }, { data: states }] = await Promise.all([
      admin
        .from('tuday_tasks')
        .select('*')
        .eq('owner_id', owner)
        .eq('archived', false)
        .not('task_time', 'is', null),
      admin.from('tuday_task_logs').select('*').eq('owner_id', owner).eq('date', dateStr),
      admin.from('tuday_push_state').select('*').eq('owner_id', owner).eq('date', dateStr),
    ]);

    const logMap = new Map<string, Row>();
    for (const l of logs ?? []) logMap.set(l.task_id, l);
    const stateMap = new Map<string, Row>();
    for (const st of states ?? []) stateMap.set(st.task_id, st);

    for (const task of tasks ?? []) {
      if (!appliesOn(task, dateStr, dow, dom)) continue;
      const tm = parseTime(task.task_time);
      if (tm === null) continue;

      // Estado efectivo del día
      const log = logMap.get(task.id);
      let status = task.type === 'unica' ? task.status : log?.status ?? 'pendiente';
      if (status === 'pospuesta' && log?.snoozed_until && new Date(log.snoozed_until) > now) {
        continue; // pospuesta y todavía dormida
      }
      if (status === 'completada' || status === 'cancelada') continue;

      const diff = minutes - tm; // minutos desde la hora (negativo = antes)
      const isUrgent = task.priority === 'urgente';
      const interval = isUrgent ? 5 : 10;
      const st = stateMap.get(task.id) ?? { pre_sent: false, due_count: 0, last_sent_at: null };

      let doSend = false;
      let body = '';
      let nextState: Row | null = null;

      if (diff >= -11 && diff <= -9 && !st.pre_sent) {
        // Aviso previo (~10 min antes)
        doSend = true;
        body = `En ${Math.max(1, -diff)} min: ${task.task_time}. Preparate.`;
        nextState = { ...st, pre_sent: true };
      } else if (diff >= 0 && diff <= OVERDUE_WINDOW_MIN && st.due_count < MAX_REPEATS) {
        const last = st.last_sent_at ? new Date(st.last_sent_at).getTime() : 0;
        if (now.getTime() - last >= interval * 60_000 - 20_000) {
          doSend = true;
          body =
            diff === 0
              ? 'Es la hora de esta tarea.'
              : `Pendiente hace ${diff} min. Marcala como hecha o posponé.`;
          nextState = {
            ...st,
            pre_sent: true,
            due_count: st.due_count + 1,
            last_sent_at: now.toISOString(),
          };
        }
      }

      if (!doSend) continue;

      const title = `${isUrgent ? '🔴 ' : '🔔 '}${task.title}`;
      const payload = JSON.stringify({ title, body, tag: `tuday-${task.id}`, url: '/' });

      for (const s of userSubs) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload
          );
          sent++;
        } catch (err: any) {
          const code = err?.statusCode;
          if (code === 404 || code === 410) deadEndpoints.push(s.endpoint);
        }
      }

      stateUpserts.push({
        task_id: task.id,
        date: dateStr,
        owner_id: owner,
        pre_sent: nextState!.pre_sent,
        due_count: nextState!.due_count ?? st.due_count,
        last_sent_at: nextState!.last_sent_at ?? st.last_sent_at,
      });
    }
  }

  if (stateUpserts.length) {
    await admin.from('tuday_push_state').upsert(stateUpserts, { onConflict: 'task_id,date' });
  }
  if (deadEndpoints.length) {
    await admin.from('tuday_push_subscriptions').delete().in('endpoint', deadEndpoints);
  }

  return new Response(JSON.stringify({ ok: true, sent, cleaned: deadEndpoints.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
