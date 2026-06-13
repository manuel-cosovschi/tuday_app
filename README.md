# Tuday — Tus tareas, sin olvidos

App web de **productividad personal** (PWA instalable, optimizada para iPhone) para
organizar tareas diarias/semanales, hábitos y recordatorios, con un sistema de avisos
**insistentes** que repite hasta que marcás la tarea como **hecha**, **pospuesta** o
**cancelada**.

> MVP **local-first**: funciona 100% sin backend (los datos se guardan en el dispositivo).
> Más abajo está el camino claro para escalar a Supabase con cuentas reales y Web Push.

---

## 1. Análisis general

El problema central no es "guardar tareas" (eso lo hace cualquier to-do), sino **que no
te las olvides**. Por eso la pieza más importante es el **motor de recordatorios
insistentes**, y la decisión técnica más delicada son las **limitaciones de las
notificaciones push en iOS**.

Realidad de iOS (Safari) que condiciona todo el diseño:

- Web Push **solo** funciona en iOS **16.4+** y **solo si la PWA está instalada** (añadida
  a la pantalla de inicio). En Safari "normal" no hay push.
- Aun instalada, la entrega de push con la app **cerrada** es poco fiable / puede demorarse;
  iOS no garantiza alarmas exactas para web.
- No existe un equivalente web a las alarmas nativas que suenan con el teléfono bloqueado.

**Conclusión de diseño:** las push se usan como *mejora cuando están disponibles*, pero el
recordatorio **garantizado** es el **Modo Enfoque dentro de la app** (overlay insistente +
sonido + vibración + tareas vencidas siempre visibles) que funciona apenas abrís Tuday.
Así cumplimos el requisito "que me insista" de forma realista en iPhone.

---

## 2. Stack tecnológico

| Capa | Elección (MVP) | Por qué |
|------|----------------|---------|
| Framework | **Next.js 14** (App Router) + **React 18** + **TypeScript** | SSR/estático, PWA, un solo repo front+back a futuro |
| Estilos | **Tailwind CSS** + modo claro/oscuro (`class`) | mobile-first, rápido, consistente |
| Estado/persistencia | **Zustand** + `persist` (localStorage) | simple, sin boilerplate; ideal para local-first |
| Fechas | **date-fns** | liviano, tree-shakeable |
| Iconos | **lucide-react** | set moderno y liviano |
| PWA | `manifest.webmanifest` + **Service Worker** propio + meta tags Apple | instalable en iOS, offline básico |

**Alternativa más simple aún (no elegida):** una SPA con Vite. Se descartó porque Next ya
deja el camino listo para añadir API Routes + Supabase sin migrar de framework.

**Versión "producción" (futuro):** Next.js + **Supabase** (Postgres + Auth + Edge
Functions) + **Web Push con VAPID** para notificaciones server-side.

---

## 3. Arquitectura

```
Navegador (iPhone / desktop)
│
├─ UI React (App Router)  ─ vistas: Hoy / Semana / Hábitos / Ajustes
│
├─ Zustand store ──────────► localStorage  (tareas, hábitos, historial, settings)
│
├─ ReminderProvider (motor) ─ tick cada 20s:
│     • calcula instancias del día (recurrencias)
│     • dispara avisos (10' antes, en hora, repite cada 10'/5')
│     • alimenta el FocusOverlay (insistencia en pantalla)
│     └─ usa: Notification API / SW.showNotification + beep + vibrate
│
└─ Service Worker (/sw.js) ─ caché offline + push + click → abrir app
```

Flujo de datos unidireccional: la UI dispara acciones del store → el store persiste →
el `ReminderProvider` (suscrito al store) recalcula y notifica.

---

## 4. Estructura de carpetas

```
tuday_app/
├─ public/
│  ├─ manifest.webmanifest        # PWA
│  ├─ sw.js                       # Service Worker (offline + push)
│  └─ icons/                      # iconos PNG (generados por script)
├─ scripts/
│  └─ generate-icons.mjs          # genera los PNG sin dependencias
└─ src/
   ├─ app/
   │  ├─ layout.tsx               # metadata + meta tags Apple + tema
   │  ├─ globals.css
   │  ├─ page.tsx                 # Dashboard / "Hoy"
   │  ├─ semana/page.tsx          # vista semanal
   │  ├─ habitos/page.tsx         # hábitos + rachas
   │  └─ ajustes/page.tsx         # tema, permisos, instrucciones iOS
   ├─ components/
   │  ├─ AppShell.tsx             # hidratación, auth gate, providers
   │  ├─ Login.tsx                # auth local simple
   │  ├─ ReminderProvider.tsx     # MOTOR de recordatorios
   │  ├─ FocusOverlay.tsx         # modo enfoque (insiste en pantalla)
   │  ├─ TaskCard.tsx             # tarjeta + acciones rápidas
   │  ├─ AddTaskModal.tsx         # crear/editar tarea o hábito
   │  ├─ BottomNav.tsx            # navegación inferior (mobile)
   │  └─ ui-bits.tsx              # progreso, FAB, secciones
   └─ lib/
      ├─ types.ts                 # modelo de dominio
      ├─ store.ts                 # Zustand + persistencia
      ├─ recurrence.ts            # resolución de recurrencias
      ├─ stats.ts                 # cumplimiento y rachas
      ├─ date.ts                  # helpers de fecha
      ├─ notifications.ts         # permisos, push, sonido, vibración
      └─ ui.ts                    # labels y colores por prioridad
```

---

## 5. Modelo de datos

En el MVP vive en localStorage; el modelo está pensado para mapear 1:1 a tablas Postgres.

**`Task`** (tarea o plantilla recurrente / hábito)
- `id`, `title`, `description?`, `category`, `priority` (`baja|media|alta|urgente`)
- `type` (`unica|diaria|semanal|mensual|habito`)
- `dueDate?` (única), `time?` (HH:mm), `durationMin?`
- `daysOfWeek?` (semanal/hábito), `dayOfMonth?` (mensual)
- `status` (para únicas), `createdAt`, `archived?`

**`DayRecord`** — qué pasó con una recurrente en una fecha concreta
- `status`, `completedAt?`, `snoozedUntil?`, `postponeCount`
- Se guardan en `completions[taskId][yyyy-MM-dd]` → habilita **historial** y **rachas**
  sin materializar miles de instancias.

**`UserProfile`**: `name`, `email?`, `createdAt`
**`Settings`**: tema, notificaciones on/off, sonido, vibración, modo enfoque, cadencia de
repetición (normal / urgente), minutos de pre-aviso.

### Esquema Postgres equivalente (para la versión Supabase)

```sql
users(id pk, email unique, name, created_at)
categories(id pk, user_id fk, name, color)
tasks(id pk, user_id fk, title, description, category_id fk,
      priority, type, due_date, time, duration_min,
      days_of_week int[], day_of_month int, status, archived, created_at)
task_logs(id pk, task_id fk, date date, status,
          completed_at, snoozed_until, postpone_count,
          unique(task_id, date))           -- = DayRecord / historial
habits  -> se modelan como tasks.type='habito' (+ task_logs para racha/historial)
reminders(id pk, task_id fk, fire_at, channel, sent_at)  -- para push server-side
push_subscriptions(id pk, user_id fk, endpoint, p256dh, auth)
settings(user_id pk fk, theme, notifications_enabled, sound, vibration,
         focus_mode, repeat_every_min, repeat_urgent_min, pre_notify_min)
```

Relaciones: `users 1—N tasks`, `tasks 1—N task_logs`, `users 1—N push_subscriptions`,
`users 1—1 settings`.

---

## 6. Flujo de tareas y notificaciones

```
Tarea con fecha+hora
   │
   ├─ now ≥ hora − 10'   → aviso "está por vencer" (1 vez)
   ├─ now ≥ hora          → aviso "es la hora"  ──► entra al Modo Enfoque
   │                         repite cada 10' (urgente: cada 5')
   │
   ├─ usuario "Hecha"     → status=completada, frena avisos
   ├─ usuario "Posponer"  → snoozedUntil = +15'/+1h/mañana 09:00, postponeCount++
   │                         al vencer el snooze vuelve a "pendiente" y reanuda
   ├─ usuario "Cancelar"  → status=cancelada, frena avisos
   │
   └─ pasa el día sin acción → queda "Vencida": SIEMPRE visible (rojo + pulso)
                                hasta que tomes una acción.

Recurrentes (diaria/semanal/mensual/hábito): no se duplican filas; cada día se
"resuelve" qué corresponde y su estado se lee/escribe en completions[taskId][fecha].
```

El motor (`ReminderProvider`) corre cada **20s** y también al volver a la pestaña
(`visibilitychange`), por lo que apenas abrís la app te pone al día.

---

## 7. Pantallas principales

- **Hoy / Dashboard** (`/`): saludo + fecha, % cumplimiento diario y semanal, y secciones
  ordenadas por importancia: **Vencidas** → **Urgentes** → **Por horario** → **Sin
  horario** → **Venís posponiendo** → **Completadas hoy**. Botón **+** flotante.
- **Semana** (`/semana`): lunes a domingo, navegación entre semanas, cumplimiento y
  conteo de vencidas por día.
- **Hábitos** (`/habitos`): racha actual 🔥, mejor racha 🏆, % (30 días) y mini-historial
  visual; check rápido del día.
- **Ajustes** (`/ajustes`): tema claro/oscuro/auto, activar push, sonido/vibración/modo
  enfoque, cadencia de repetición, instrucciones de instalación en iPhone y logout.

Diseño: mobile-first, tarjetas, **color por prioridad** (azul/ámbar/naranja/rojo),
acciones rápidas (Hecha / +15m / +1h / Mañana / Cancelar), safe-areas para el notch.

---

## 8. Plan MVP paso a paso (lo implementado)

1. ✅ Proyecto Next.js + TS + Tailwind + PWA (manifest, SW, iconos, meta Apple).
2. ✅ Modelo de dominio y store con persistencia local.
3. ✅ Login simple + sesión persistente.
4. ✅ CRUD de tareas (crear, editar, eliminar) + tipos recurrentes.
5. ✅ Acciones: completar, posponer (15m/1h/mañana), cancelar.
6. ✅ Vista Hoy (dashboard) y vista Semanal.
7. ✅ Hábitos con rachas e historial.
8. ✅ Motor de recordatorios insistente + Modo Enfoque + sonido/vibración.
9. ✅ Notificaciones push web (donde el SO lo permita) con fallback iOS.
10. ✅ Responsive / mobile-first / claro-oscuro.

---

## 9. Instalar y correr

Requisitos: **Node 18+** (probado en Node 22).

```bash
npm install
npm run icons     # (opcional) regenera los iconos PNG
npm run dev       # http://localhost:3000
```

Producción:

```bash
npm run build
npm start
```

**Probar como app en iPhone:** abrí la URL en **Safari** → botón **Compartir** →
**“Agregar a pantalla de inicio”** → abrí Tuday desde el ícono → en **Ajustes** activá las
notificaciones (iOS 16.4+).

> El Service Worker y las notificaciones requieren **HTTPS** (o `localhost`). En el deploy
> ya viene HTTPS; en desarrollo local usá `localhost`.

---

## 10. Deploy recomendado

- **Vercel** (ideal para Next.js): conectás el repo y listo, HTTPS automático → la PWA es
  instalable y el SW funciona. Es el camino más corto.
- Alternativas: Netlify, Cloudflare Pages.
- Cuando agregues backend: **Supabase** (DB + Auth) y, para push server-side, Edge
  Functions con **web-push** (claves VAPID).

---

## 11. Limitaciones técnicas de las push web (y cómo las resolvemos)

| Plataforma | Push con app cerrada | Notas |
|------------|----------------------|-------|
| Android Chrome | ✅ confiable | mejor caso; soporta `requireInteraction` |
| Desktop Chrome/Edge/Firefox | ✅ confiable | requiere permiso |
| **iOS Safari** | ⚠️ solo PWA instalada, iOS 16.4+ | entrega no garantizada/diferida; sin alarmas exactas |
| iOS no instalada | ❌ | no hay push en Safari normal |

**Mitigaciones implementadas (funcionan con la app abierta, clave en iPhone):**
- **Modo Enfoque**: overlay que insiste con la tarea más urgente y no se va hasta que actúes.
- **Sonido** (WebAudio) y **vibración** (`navigator.vibrate`) en cada repetición.
- **Tareas vencidas siempre visibles** con borde rojo y animación de pulso.
- **Re-chequeo al volver a la app** (`visibilitychange`) para ponerte al día al instante.
- Badges/contadores y orden por prioridad para saber al toque qué hacer.

---

## 12. Próximas mejoras

- **Supabase**: cuentas reales, recuperación de contraseña, sync multi-dispositivo (RLS por
  usuario), y migración del store local a la nube (ya mapeado en la sección 5).
- **Web Push server-side** con VAPID + tabla `reminders` para avisar con la app cerrada
  donde el SO lo permita.
- Arrastre inteligente de recurrentes vencidas y "reprogramar semana".
- Subtareas, etiquetas, adjuntos y notas.
- Estadísticas avanzadas (tendencias, mejor horario, heatmap anual de hábitos).
- Integración con Google/Apple Calendar y recordatorios por email/WhatsApp.
- Drag & drop para reordenar la semana.

---

## Notas de diseño del código

- **Local-first**: cero backend para arrancar; el modelo ya está listo para Postgres.
- Las recurrencias **no se materializan**: se resuelven por fecha (`recurrence.ts`), lo que
  mantiene el almacenamiento chico y el historial/rachas exactos.
- El "último aviso" para la cadencia vive **en memoria** en el motor (no se persiste): así
  no ensucia el almacenamiento y se reinicia limpio en cada sesión.
```
