import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).setHeader('Allow', 'GET').end()
    return
  }
  const publicKey = process.env.VAPID_PUBLIC_KEY
  if (!publicKey) {
    res.status(503).json({ error: 'VAPID no configurado' })
    return
  }
  res.status(200).json({ publicKey })
}
