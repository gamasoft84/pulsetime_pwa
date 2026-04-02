# PulseTime PWA

PWA con **Vite + React** para recordatorios (pagos, suscripciones, eventos, mascotas) y **notificaciones Web Push** en iPhone (Safari, iOS 16.4+, app añadida a la pantalla de inicio).

Backend: **Vercel** (API serverless + Cron) y **Neon** (Postgres).

## Requisitos previos

1. Cuenta en [Neon](https://neon.tech) y proyecto Postgres.
2. Cuenta en [Vercel](https://vercel.com).
3. Crear las tablas en Neon (paso detallado abajo).

### Paso 1 detallado: ejecutar `db/schema.sql` en Neon

Este paso crea en Postgres las tablas que usa la app: **recordatorios**, **envíos programados** y **suscripciones push**.

1. **Entra en Neon**  
   Inicia sesión en [console.neon.tech](https://console.neon.tech) y abre el **proyecto** donde quieras guardar los datos (o crea uno nuevo con **Create project**).

2. **Elige la base y la rama**  
   Por defecto suele existir la base `neondb` y la rama `main`. No hace falta crear otra base salvo que tú quieras organizarlo distinto.

3. **Abre el SQL Editor**  
   En el menú lateral, entra en **SQL Editor** (a veces aparece como icono de consola / “Query”).

4. **Copia el script completo**  
   Abre en tu máquina el archivo [`db/schema.sql`](db/schema.sql) del repo, selecciona **todo** el contenido (`CREATE TABLE …` hasta el final) y cópialo.

5. **Pégalo y ejecútalo**  
   Pega el script en el editor de Neon y pulsa **Run** (o el atajo que indique la consola). Deberías ver que termina **sin errores** (mensaje de éxito o filas afectadas 0 en `CREATE TABLE IF NOT EXISTS` es normal).

6. **Comprueba que existen las tablas**  
   Opcional: en **Tables** (o el explorador de esquema) verifica que aparecen:
   - `reminders`
   - `scheduled_notifications`
   - `push_subscriptions`

7. **Copia la cadena de conexión**  
   En el proyecto Neon: **Dashboard** → **Connection details** (o “Connect”). Copia la URI **PostgreSQL**, que incluye usuario, host `ep-….neon.tech` y `sslmode=require`. Esa cadena es tu **`DATABASE_URL`** para `.env.local` y para Vercel.

**Notas**

- Si ejecutas el script **dos veces**, no pasa nada: usa `IF NOT EXISTS`.
- **`gen_random_uuid()`** viene en Postgres moderno (Neon lo trae); no hace falta activar la extensión `uuid-ossp` para este esquema.
- Alternativa por terminal (si tienes `psql` instalado):  
  `psql "TU_DATABASE_URL_AQUI" -f db/schema.sql`

## Variables de entorno

Copia [`.env.example`](.env.example) a `.env.local` para desarrollo con `vercel dev`:

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Cadena de conexión de Neon |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Generar con `npm run generate:vapid` |
| `VAPID_SUBJECT_MAIL` | Ej. `mailto:tu@email.com` |
| `CRON_SECRET` | Cadena aleatoria; Vercel la envía en `Authorization: Bearer …` al cron |

En el dashboard de Vercel, añade las mismas variables al proyecto (Production y Preview).

## Desarrollo local

Las rutas `/api/*` las sirve Vercel, no Vite. Usa dos terminales o solo `vercel dev`:

```bash
npm install
cp .env.example .env.local
# Rellena .env.local y ejecuta schema en Neon
npm run generate:vapid
```

**Opción A — todo en Vercel (recomendado):**

```bash
npm run dev:vercel
```

(Equivale a `vercel dev` usando la CLI incluida en el proyecto; si tienes Vercel instalado globalmente, también vale `vercel dev`.)

Abre la URL que indique Vercel (suele ser `http://localhost:3000`).

**Opción B — Vite + proxy:** en otra terminal `npm run dev:vercel -- --listen 3000`, luego:

```bash
npm run dev
```

Vite (5173) proxifica `/api` → `127.0.0.1:3000`.

## Producción

Si el build en Vercel falla en `npm install` por dependencias peer (Vite 8 + `vite-plugin-pwa`), el repo incluye [`.npmrc`](.npmrc) con `legacy-peer-deps=true`; asegúrate de **subir ese archivo** al repositorio.

1. Conecta el repo a Vercel o `vercel --prod`.
2. Configura las variables de entorno.
3. Ajusta el **cron** si quieres otra hora (ver abajo).

### Cron: qué te conviene

**Uso personal (“solo revisar una vez al día”)** — es lo que encaja contigo:

- Deja **un cron diario** en [`vercel.json`](vercel.json) (p. ej. `0 8 * * *` = una vez al día a las **08:00 UTC**).
- Elige la hora en **UTC** que sea tu “ventana” habitual (mañana, cuando sueles mirar el móvil). Ejemplo: si en invierno en Chile quieres ~08:00 **hora local**, eso suele ser **11:00 UTC** → usa `0 11 * * *`.
- Cada ejecución **procesa todos** los recordatorios que ya tocaron (`fire_at` en el pasado). No hace falta revisar cada 5 minutos si te basta un repaso diario; el aviso puede llegar **más tarde ese mismo día o al día siguiente** según la hora que elijas respecto a cada `trigger_at`.

**Si más adelante quieres más precisión (casi a la hora exacta):**

| Opción | Idea |
|--------|------|
| **Vercel Pro** | En `vercel.json` puedes poner `*/5 * * * *` (cada 5 minutos) u otra expresión frecuente. |
| **Plan Hobby + cron externo** | Servicio gratuito (p. ej. cron-job.org) que llame cada 5–15 min a `https://TU_DOMINIO/api/cron/dispatch` con header `Authorization: Bearer TU_CRON_SECRET`. Puedes **quitar** el bloque `crons` de `vercel.json` para no duplicar, o dejar solo el diario como respaldo. |

**Resumen:** para ti, **diario + una hora UTC acorde a tu rutina** es la opción simple, barata y alineada con Hobby. La flexibilidad “cada 5 minutos” es para quien pase a **Pro** o use un **disparador externo**.

## iPhone

1. Abre la URL de producción en **Safari**.
2. **Compartir** → **Añadir a pantalla de inicio**.
3. Abre la app desde el icono y pulsa **Activar notificaciones push**.

## Estructura útil

- `src/` — interfaz React y service worker (`sw.ts`).
- `api/` — rutas serverless (reminders, push, cron).
- `api/_lib/` — Neon, envío `web-push`, reprogramación de envíos.
