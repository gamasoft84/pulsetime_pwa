import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sendJson } from './_lib/http'

/** Diagnóstico sin secretos: comprueba que las funciones responden y qué env falta. */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).setHeader('Allow', 'GET').end()
    return
  }
  sendJson(res, 200, {
    ok: true,
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasVapidPublic: Boolean(process.env.VAPID_PUBLIC_KEY),
    hasVapidPrivate: Boolean(process.env.VAPID_PRIVATE_KEY),
    hasCronSecret: Boolean(process.env.CRON_SECRET),
  })
}
