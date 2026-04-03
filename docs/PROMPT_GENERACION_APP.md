# Prompt detallado para generar PulseTime PWA (referencia)

Este documento describe la aplicación con el máximo detalle útil para **reconstruirla o evolucionarla** con un asistente de IA, e incluye **requisitos técnicos críticos** (Vercel + ESM) que suelen olvidarse.

---

## Rol y objetivo

Eres un desarrollador experto en frontend y backend serverless. Debes crear **PulseTime**, una **PWA** (Progressive Web App) para **uso personal** que permita:

- Gestionar **recordatorios** con notificaciones **Web Push** en **iPhone** (Safari, iOS 16.4+, app instalada desde “Añadir a pantalla de inicio”).
- Casos de uso: pagos de tarjetas, cancelación de suscripciones/tarjetas, eventos, aniversarios de mascotas (con texto tipo “hace X años”), etc.
- **No** se requiere panel de administración separado ni multi-usuario en el MVP: la propia PWA es el CRUD.

---

## Stack obligatorio

| Capa | Tecnología |
|------|------------|
| UI + build | **Vite** + **React** + **TypeScript** |
| PWA | **vite-plugin-pwa** con estrategia **injectManifest** y un **service worker** propio (`src/sw.ts`) que maneje eventos **push** y **notificationclick** (Workbox: precache + `clientsClaim` / `skipWaiting`). |
| Hosting + API | **Vercel**: sitio estático (`dist`) + funciones en carpeta **`/api`** (runtime Node, no Edge para estas rutas). |
| Base de datos | **Neon** (Postgres serverless), driver **`@neondatabase/serverless`** con la función **`neon()`** y queries con template literals. |
| Push en servidor | Librería **`web-push`** + par **VAPID** (pública en cliente, privada solo en servidor). |
| Programación de envíos | **Vercel Cron** llamando a una ruta tipo `/api/cron/dispatch` que consulte filas pendientes y envíe push. Plan **Hobby**: como mucho **un cron al día** (ej. `0 8 * * *` en UTC); en Pro se puede cada 5 minutos o usar cron externo con el mismo endpoint. |

---

## Variables de entorno

- `DATABASE_URL` — URI Postgres de Neon (`sslmode=require`).
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — generar con `web-push generate-vapid-keys` o script propio.
- `VAPID_SUBJECT_MAIL` — `mailto:usuario@dominio.com` (requerido por el estándar).
- `CRON_SECRET` — secreto compartido; Vercel envía `Authorization: Bearer <CRON_SECRET>` al invocar el cron (validar en el handler).

Archivo de ejemplo: `.env.example`. Desarrollo local: **`vercel dev`** o CLI `vercel` como devDependency + script `npm run dev:vercel`.

---

## Esquema SQL (Neon)

Ejecutar una vez en Neon (archivo `db/schema.sql`):

1. **`reminders`**: `id` UUID, `title`, `kind` (texto enum en app), `trigger_at` timestamptz, `recurrence` (`none|daily|weekly|monthly|yearly`), `days_before` int nullable, `reference_date` date nullable, `notes` text nullable, `is_active` boolean, timestamps.
2. **`scheduled_notifications`**: `id` UUID, `reminder_id` FK a `reminders` ON DELETE CASCADE, `fire_at` timestamptz, `title`, `body` text nullable, `status` (`pending|sent|…`), `created_at`.
3. **`push_subscriptions`**: `endpoint` unique, `p256dh`, `auth`, `created_at`.
4. Índice parcial en `scheduled_notifications (fire_at)` donde `status = 'pending'`.

Lógica: al crear/actualizar un recordatorio, recalcular y escribir filas `pending` en `scheduled_notifications` (primer `fire_at` según `trigger_at` y `days_before`). El cron marca como enviado y, si hay recurrencia, avanza `trigger_at` e inserta la siguiente ocurrencia.

---

## API HTTP (Vercel `/api`)

- `GET/POST /api/reminders` — listar y crear.
- `PATCH/DELETE /api/reminder/[id]` — actualizar parcial (COALESCE en SQL o equivalente) y borrar.
- `POST /api/push/subscribe` — guardar suscripción (upsert por `endpoint`).
- `GET /api/vapid-public` — devolver solo la clave pública VAPID.
- `GET /api/health` — diagnóstico sin secretos: flags `hasDatabaseUrl`, `hasVapidPublic`, etc.
- `GET|POST /api/cron/dispatch` — si `CRON_SECRET` está definido, exigir `Authorization: Bearer …`; seleccionar notificaciones due, enviar `web-push` a todas las suscripciones, actualizar estado y recurrencia.

**Importante — respuestas JSON en Vercel Node:** el objeto `res` de `@vercel/node` **no** incluye `res.json()` (eso es Express). Usar siempre algo como:

```ts
res.status(code).setHeader('Content-Type', 'application/json; charset=utf-8')
res.send(JSON.stringify(data))
```

Opcional: helper compartido `sendJson(res, status, data)` con `JSON.stringify` que convierta `bigint` a string por si acaso.

---

## Punto crítico: `"type": "module"` y resolución de imports en Vercel

El `package.json` del proyecto debe incluir **`"type": "module"`** para alinear ESM con Vite y el ecosistema actual.

**Consecuencia en Node ESM (incluido el bundle que ejecuta Vercel para `/api`):** los **imports relativos entre archivos propios** deben llevar **extensión `.js`** en el **código fuente TypeScript**, porque en tiempo de ejecución los archivos son `.js` y el resolvedor de Node **no** añade extensiones automáticamente.

**Regla práctica:** dentro de la carpeta `api/` (y subcarpetas como `api/_lib/`), escribir:

```ts
import { getSql } from './_lib/db.js'
import { sendJson } from './_lib/http.js'
```

aunque en disco el archivo sea `db.ts` / `http.ts`. TypeScript resuelve correctamente el `.js` al compilar/revisar tipos si el proyecto está configurado para ello; Vercel emite JS y Node encuentra `./_lib/db.js`.

**Si se omiten las extensiones `.js`**, en producción aparece:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/api/_lib/db'
imported from /var/task/api/reminders.js
```

**Aplicar la misma convención** a todos los imports relativos entre archivos del propio `api/` (incluidos `../_lib/...` desde `api/push/subscribe.ts` o `api/cron/dispatch.ts`).

Los paquetes npm (`@vercel/node`, `@neondatabase/serverless`, `web-push`) siguen importándose **sin** extensión.

---

## npm y dependencias peer

Si se usa **Vite 8** y **vite-plugin-pwa** con peer antigua (solo declara Vite hasta 7), `npm install` falla sin `--legacy-peer-deps`. Solución recomendada: archivo **`.npmrc`** en la raíz con:

```ini
legacy-peer-deps=true
```

Así Vercel y local instalan sin error.

---

## `vercel.json` (orientativo)

- `installCommand`: `npm install` (respeta `.npmrc`).
- `buildCommand`: `npm run build` (típicamente `tsc -b && vite build`).
- `outputDirectory`: `dist`.
- `framework`: `null` o detección explícita según necesidad.
- **Rewrites** SPA: una regla que envíe al `index.html` todo lo que **no** sea `/api/*` (cuidado con no capturar rutas de API).
- **Crons**: según plan Vercel (Hobby = diario como máximo).

---

## Frontend (React)

- Pantalla principal: lista de recordatorios, formulario crear/editar con campos alineados al modelo (`kind`, fechas, recurrencia, `days_before`, `reference_date` para mascotas, notas, activo).
- Onboarding claro para **iPhone**: Web Push **no** está disponible en pestaña normal de Safari; hace falta **Añadir a pantalla de inicio** y abrir desde el **icono** (modo standalone). Detectar con `display-mode: standalone` / `navigator.standalone` y mostrar mensaje contextual.
- Cliente HTTP: `fetch` a `/api/...`; ante errores, si la respuesta es JSON con `{ error }`, mostrarlo; si es HTML de error de Vercel, mensaje amigable.
- Registro del SW: `virtual:pwa-register` en `main.tsx`.

---

## Manifest y meta PWA

- `manifest` en plugin PWA: nombre, `short_name`, `standalone`, iconos 192/512, `theme_color` / `background_color`.
- `index.html`: `apple-mobile-web-app-capable`, `apple-touch-icon`, `theme-color`, `lang="es"`.

---

## Comprobaciones finales

1. `npm run build` local sin errores.
2. Deploy en Vercel: build verde.
3. `GET /api/health` devuelve JSON y `hasDatabaseUrl: true` en el entorno correcto (Production vs Preview).
4. `GET /api/reminders` devuelve `{ reminders: [] }` o datos.
5. En iPhone: PWA instalada → permisos de notificación → suscripción guardada en Neon.

---

## Resumen del recordatorio ESM + Vercel

> Con **`"type": "module"`**, en las funciones **`/api`** de Vercel todos los **imports relativos entre archivos del proyecto** deben usar sufijo **`.js`** (`./_lib/db.js`, `../_lib/http.js`, etc.) para evitar **`ERR_MODULE_NOT_FOUND`** en runtime. **`res.json()` no existe** en el `res` de Vercel Node: usar **`res.send(JSON.stringify(...))`** o un helper equivalente.
