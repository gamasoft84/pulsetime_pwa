import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { NeonQueryFunction } from '@neondatabase/serverless'
import { getClerkUserId } from './_lib/auth.js'
import { getSql } from './_lib/db.js'
import { sendJson } from './_lib/http.js'
import { numOrNull, parseMoneyInput, roundMoney } from './_lib/money.js'
import { rescheduleReminder } from './_lib/remindersDb.js'

const KINDS = new Set([
  'credit_payment',
  'service_payment',
  'subscription_cancel',
  'card_cancel',
  'event',
  'pet_memorial',
  'other',
])

const RECURRENCES = new Set(['none', 'daily', 'weekly', 'monthly', 'yearly'])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const userId = await getClerkUserId(req.headers.authorization)
    if (!userId) {
      sendJson(res, 401, { error: 'No autorizado. Inicia sesión.' })
      return
    }

    const sql = getSql() as NeonQueryFunction

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, user_id, title, kind, trigger_at, recurrence, days_before, reference_date, notes, amount, is_active, created_at, updated_at
        FROM reminders WHERE user_id = ${userId} ORDER BY trigger_at ASC
      `
      sendJson(res, 200, {
        reminders: (rows as Record<string, unknown>[]).map((r) => ({
          ...r,
          amount: numOrNull(r.amount),
        })),
      })
      return
    }

    if (req.method === 'POST') {
      const b =
        typeof req.body === 'string'
          ? JSON.parse(req.body)
          : req.body && typeof req.body === 'object'
            ? req.body
            : {}
      const title = String(b.title ?? '').trim()
      const kind = String(b.kind ?? '')
      const trigger_at = String(b.trigger_at ?? '')
      const recurrence = String(b.recurrence ?? 'none')
      const days_before =
        b.days_before === null || b.days_before === undefined || b.days_before === ''
          ? null
          : Number(b.days_before)
      const reference_date =
        b.reference_date === null || b.reference_date === '' ? null : String(b.reference_date)
      const notes = b.notes == null ? null : String(b.notes)
      const is_active = b.is_active !== false

      if (!title) {
        sendJson(res, 400, { error: 'title requerido' })
        return
      }
      if (!KINDS.has(kind)) {
        sendJson(res, 400, { error: 'kind inválido' })
        return
      }
      if (!RECURRENCES.has(recurrence)) {
        sendJson(res, 400, { error: 'recurrence inválida' })
        return
      }
      if (!trigger_at) {
        sendJson(res, 400, { error: 'trigger_at requerido' })
        return
      }
      const triggerDate = new Date(trigger_at)
      if (Number.isNaN(triggerDate.getTime())) {
        sendJson(res, 400, { error: 'trigger_at no es una fecha válida' })
        return
      }
      if (days_before !== null && (!Number.isInteger(days_before) || days_before < 0)) {
        sendJson(res, 400, { error: 'days_before inválido' })
        return
      }

      let amount: number | null = null
      if (kind === 'service_payment') {
        const a = parseMoneyInput(b.amount)
        if (a == null || a <= 0) {
          sendJson(res, 400, { error: 'Indica un monto mayor que cero para pago de servicio.' })
          return
        }
        amount = roundMoney(a)
      }

      const inserted = await sql`
        INSERT INTO reminders (user_id, title, kind, trigger_at, recurrence, days_before, reference_date, notes, amount, is_active)
        VALUES (
          ${userId},
          ${title},
          ${kind},
          ${triggerDate.toISOString()},
          ${recurrence},
          ${days_before},
          ${reference_date},
          ${notes},
          ${amount},
          ${is_active}
        )
        RETURNING id, user_id, title, kind, trigger_at, recurrence, days_before, reference_date, notes, amount, is_active, created_at, updated_at
      `
      const row = inserted[0] as Record<string, unknown>
      await rescheduleReminder(sql, String(row.id))
      sendJson(res, 201, {
        reminder: { ...row, amount: numOrNull(row.amount) },
      })
      return
    }

    res.status(405).setHeader('Allow', 'GET, POST').end()
  } catch (e) {
    console.error(e)
    sendJson(res, 500, { error: e instanceof Error ? e.message : 'Error' })
  }
}
