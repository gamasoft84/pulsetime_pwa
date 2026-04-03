import type { VercelResponse } from '@vercel/node'

/** Vercel `res` no incluye `res.json()` (eso es Express). */
export function sendJson(res: VercelResponse, status: number, data: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8')
  res.send(JSON.stringify(data))
}
