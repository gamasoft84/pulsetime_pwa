import type { NeonQueryFunction } from '@neondatabase/serverless'
import { buildNotificationBody, firstFireAt, type Recurrence } from './schedule.js'

type ReminderRow = {
  id: string
  title: string
  kind: string
  trigger_at: string
  recurrence: string
  days_before: number | null
  reference_date: string | null
  notes: string | null
  is_active: boolean
}

export async function deletePendingForReminder(sql: NeonQueryFunction, reminderId: string) {
  await sql`
    DELETE FROM scheduled_notifications
    WHERE reminder_id = ${reminderId} AND status = 'pending'
  `
}

export async function insertNextSchedule(
  sql: NeonQueryFunction,
  r: ReminderRow,
  anchorOverride?: Date,
) {
  if (!r.is_active) return
  const anchor = anchorOverride ?? new Date(r.trigger_at)
  const fire = firstFireAt(anchor, r.days_before)
  const body = buildNotificationBody({
    kind: r.kind,
    title: r.title,
    notes: r.notes,
    reference_date: r.reference_date,
  })
  await sql`
    INSERT INTO scheduled_notifications (reminder_id, fire_at, title, body)
    VALUES (${r.id}, ${fire.toISOString()}, ${r.title}, ${body})
  `
}

export async function rescheduleReminder(sql: NeonQueryFunction, reminderId: string) {
  await deletePendingForReminder(sql, reminderId)
  const rows = (await sql`
    SELECT id, title, kind, trigger_at, recurrence, days_before, reference_date, notes, is_active
    FROM reminders WHERE id = ${reminderId} LIMIT 1
  `) as ReminderRow[]
  const r = rows[0]
  if (!r) return
  await insertNextSchedule(sql, r)
}

export async function advanceReminderAfterSend(
  sql: NeonQueryFunction,
  r: ReminderRow,
  recurrence: Recurrence,
) {
  const next = nextAnchorFromRow(r, recurrence)
  if (!next) return
  await sql`
    UPDATE reminders SET trigger_at = ${next.toISOString()}, updated_at = NOW()
    WHERE id = ${r.id}
  `
  const updated = { ...r, trigger_at: next.toISOString() }
  await insertNextSchedule(sql, updated)
}

function nextAnchorFromRow(r: ReminderRow, recurrence: Recurrence): Date | null {
  if (recurrence === 'none') return null
  const anchor = new Date(r.trigger_at)
  const n = new Date(anchor.getTime())
  switch (recurrence) {
    case 'daily':
      n.setUTCDate(n.getUTCDate() + 1)
      return n
    case 'weekly':
      n.setUTCDate(n.getUTCDate() + 7)
      return n
    case 'monthly':
      n.setUTCMonth(n.getUTCMonth() + 1)
      return n
    case 'yearly':
      n.setUTCFullYear(n.getUTCFullYear() + 1)
      return n
    default:
      return null
  }
}
