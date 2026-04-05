import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { NeonQueryFunction } from '@neondatabase/serverless'
import { getSql } from '../_lib/db.js'
import { sendJson } from '../_lib/http.js'
import { numOrNull } from '../_lib/money.js'
import { advanceReminderAfterSend } from '../_lib/remindersDb.js'
import { sendPayloadToUserSubscriptions } from '../_lib/push.js'
import type { Recurrence } from '../_lib/schedule.js'

type DueRow = {
  sched_id: string
  sched_title: string
  sched_body: string | null
  reminder_id: string
  user_id: string
  title: string
  kind: string
  trigger_at: string
  recurrence: string
  days_before: number | null
  reference_date: string | null
  notes: string | null
  amount: unknown
  is_active: boolean
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).end()
    return
  }

  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.authorization
    if (auth !== `Bearer ${secret}`) {
      sendJson(res, 401, { error: 'Unauthorized' })
      return
    }
  }

  try {
    const sql = getSql() as NeonQueryFunction
    const due = (await sql`
      SELECT
        sn.id AS sched_id,
        sn.title AS sched_title,
        sn.body AS sched_body,
        r.id AS reminder_id,
        r.user_id,
        r.title,
        r.kind,
        r.trigger_at,
        r.recurrence,
        r.days_before,
        r.reference_date,
        r.notes,
        r.amount,
        r.is_active
      FROM scheduled_notifications sn
      INNER JOIN reminders r ON r.id = sn.reminder_id
      WHERE sn.status = 'pending'
        AND sn.fire_at <= NOW()
        AND (sn.fire_at AT TIME ZONE 'America/Mexico_City')::date = (NOW() AT TIME ZONE 'America/Mexico_City')::date
      ORDER BY sn.fire_at ASC
      LIMIT 50
    `) as DueRow[]

    let sent = 0
    for (const row of due) {
      const bodyText = (row.sched_body ?? '').trim()
      try {
        await sendPayloadToUserSubscriptions(row.user_id, {
          title: row.sched_title,
          body: bodyText,
        })
      } catch (e) {
        console.error('push batch error', e)
      }
      await sql`UPDATE scheduled_notifications SET status = 'sent' WHERE id = ${row.sched_id}`
      sent += 1

      const recurrence = row.recurrence as Recurrence
      if (recurrence !== 'none') {
        const r = {
          id: row.reminder_id,
          title: row.title,
          kind: row.kind,
          trigger_at: row.trigger_at,
          recurrence: row.recurrence,
          days_before: row.days_before,
          reference_date: row.reference_date,
          notes: row.notes,
          amount: numOrNull(row.amount),
          is_active: row.is_active,
        }
        await advanceReminderAfterSend(sql, r, recurrence)
      }
    }

    sendJson(res, 200, { processed: due.length, sent })
  } catch (e) {
    console.error(e)
    sendJson(res, 500, { error: e instanceof Error ? e.message : 'Error' })
  }
}
