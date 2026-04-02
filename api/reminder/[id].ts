import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { NeonQueryFunction } from '@neondatabase/serverless'
import { getSql } from '../_lib/db'
import { rescheduleReminder } from '../_lib/remindersDb'

const KINDS = new Set([
  'credit_payment',
  'subscription_cancel',
  'card_cancel',
  'event',
  'pet_memorial',
  'other',
])

const RECURRENCES = new Set(['none', 'daily', 'weekly', 'monthly', 'yearly'])

function json(res: VercelResponse, status: number, data: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify(data))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = typeof req.query.id === 'string' ? req.query.id : req.query.id?.[0]
  if (!id) {
    json(res, 400, { error: 'id requerido' })
    return
  }

  try {
    const sql = getSql() as NeonQueryFunction

    if (req.method === 'DELETE') {
      await sql`DELETE FROM reminders WHERE id = ${id}`
      json(res, 200, { ok: true })
      return
    }

    if (req.method === 'PATCH') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      const existing = await sql`SELECT id FROM reminders WHERE id = ${id} LIMIT 1`
      if (!existing.length) {
        json(res, 404, { error: 'no encontrado' })
        return
      }

      const title = b.title !== undefined ? String(b.title).trim() : undefined
      const kind = b.kind !== undefined ? String(b.kind) : undefined
      const trigger_at = b.trigger_at !== undefined ? String(b.trigger_at) : undefined
      const recurrence = b.recurrence !== undefined ? String(b.recurrence) : undefined
      let days_before: number | null | undefined
      if (b.days_before !== undefined) {
        days_before =
          b.days_before === null || b.days_before === ''
            ? null
            : Number(b.days_before)
      }
      let reference_date: string | null | undefined
      if (b.reference_date !== undefined) {
        reference_date =
          b.reference_date === null || b.reference_date === '' ? null : String(b.reference_date)
      }
      const notes = b.notes !== undefined ? (b.notes == null ? null : String(b.notes)) : undefined
      const is_active = b.is_active !== undefined ? Boolean(b.is_active) : undefined

      if (title !== undefined && !title) {
        json(res, 400, { error: 'title vacío' })
        return
      }
      if (kind !== undefined && !KINDS.has(kind)) {
        json(res, 400, { error: 'kind inválido' })
        return
      }
      if (recurrence !== undefined && !RECURRENCES.has(recurrence)) {
        json(res, 400, { error: 'recurrence inválida' })
        return
      }
      if (trigger_at !== undefined) {
        const d = new Date(trigger_at)
        if (Number.isNaN(d.getTime())) {
          json(res, 400, { error: 'trigger_at inválido' })
          return
        }
      }
      if (days_before !== undefined && days_before !== null) {
        if (!Number.isInteger(days_before) || days_before < 0) {
          json(res, 400, { error: 'days_before inválido' })
          return
        }
      }

      await sql`
        UPDATE reminders SET
          title = COALESCE(${title ?? null}, title),
          kind = COALESCE(${kind ?? null}, kind),
          trigger_at = COALESCE(${trigger_at ? new Date(trigger_at).toISOString() : null}, trigger_at),
          recurrence = COALESCE(${recurrence ?? null}, recurrence),
          days_before = COALESCE(${days_before !== undefined ? days_before : null}, days_before),
          reference_date = COALESCE(${reference_date !== undefined ? reference_date : null}, reference_date),
          notes = COALESCE(${notes !== undefined ? notes : null}, notes),
          is_active = COALESCE(${is_active !== undefined ? is_active : null}, is_active),
          updated_at = NOW()
        WHERE id = ${id}
      `

      await rescheduleReminder(sql, id)
      const rows = await sql`
        SELECT id, title, kind, trigger_at, recurrence, days_before, reference_date, notes, is_active, created_at, updated_at
        FROM reminders WHERE id = ${id} LIMIT 1
      `
      json(res, 200, { reminder: rows[0] })
      return
    }

    res.status(405).setHeader('Allow', 'PATCH, DELETE').end()
  } catch (e) {
    console.error(e)
    json(res, 500, { error: e instanceof Error ? e.message : 'Error' })
  }
}
