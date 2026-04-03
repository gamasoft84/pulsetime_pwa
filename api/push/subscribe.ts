import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSql } from '../_lib/db.js'
import { sendJson } from '../_lib/http.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).setHeader('Allow', 'POST').end()
    return
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const endpoint = body?.endpoint as string | undefined
    const keys = body?.keys as { p256dh?: string; auth?: string } | undefined
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      sendJson(res, 400, { error: 'subscription inválida' })
      return
    }
    const sql = getSql()
    await sql`
      INSERT INTO push_subscriptions (endpoint, p256dh, auth)
      VALUES (${endpoint}, ${keys.p256dh}, ${keys.auth})
      ON CONFLICT (endpoint) DO UPDATE SET
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth
    `
    sendJson(res, 200, { ok: true })
  } catch (e) {
    console.error(e)
    sendJson(res, 500, { error: e instanceof Error ? e.message : 'Error' })
  }
}
