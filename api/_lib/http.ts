import type { VercelResponse } from '@vercel/node'

function safeStringify(data: unknown): string {
  return JSON.stringify(data, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  )
}

/** Vercel `res` no incluye `res.json()` (eso es Express). */
export function sendJson(res: VercelResponse, status: number, data: unknown) {
  try {
    res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8')
    res.send(safeStringify(data))
  } catch (e) {
    console.error('sendJson', e)
    if (!res.headersSent) {
      res.status(500).setHeader('Content-Type', 'application/json; charset=utf-8')
      res.send(safeStringify({ error: 'Error al serializar respuesta' }))
    }
  }
}
