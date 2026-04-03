import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sendJson } from './_lib/http'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).setHeader('Allow', 'GET').end()
    return
  }
  const publicKey = process.env.VAPID_PUBLIC_KEY
  if (!publicKey) {
    sendJson(res, 503, { error: 'VAPID no configurado' })
    return
  }
  sendJson(res, 200, { publicKey })
}
