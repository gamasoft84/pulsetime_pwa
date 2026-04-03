import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { NeonQueryFunction } from '@neondatabase/serverless'
import { getSql } from './_lib/db'
import { sendJson } from './_lib/http'
import { rescheduleReminder } from './_lib/remindersDb'

const KINDS = new Set([
  'credit_payment',
  'subscription_cancel',
  'card_cancel',
  'event',
  'pet_memorial',
  'other',
])

const RECURRENCES = new Set(['none', 'daily', 'weekly', 'monthly', 'yearly'])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const sql = getSql() as NeonQueryFunction

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, title, kind, trigger_at, recurrence, days_before, reference_date, notes, is_active, created_at, updated_at
        FROM reminders ORDER BY trigger_at ASC
      `
      sendJson(res, 200, { reminders: rows })
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

      const inserted = await sql`
        INSERT INTO reminders (title, kind, trigger_at, recurrence, days_before, reference_date, notes, is_active)
        VALUES (
          ${title},
          ${kind},
          ${triggerDate.toISOString()},
          ${recurrence},
          ${days_before},
          ${reference_date},
          ${notes},
          ${is_active}
        )
        RETURNING id, title, kind, trigger_at, recurrence, days_before, reference_date, notes, is_active, created_at, updated_at
      `
      const row = inserted[0] as { id: string }
      await rescheduleReminder(sql, row.id)
      sendJson(res, 201, { reminder: inserted[0] })
      return
    }

    res.status(405).setHeader('Allow', 'GET, POST').end()
  } catch (e) {
    console.error(e)
    sendJson(res, 500, { error: e instanceof Error ? e.message : 'Error' })
  }
}
