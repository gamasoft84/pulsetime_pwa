import type { Reminder } from './types'

const base = ''

export async function fetchReminders(): Promise<Reminder[]> {
  const r = await fetch(`${base}/api/reminders`)
  if (!r.ok) throw new Error(await r.text())
  const j = (await r.json()) as { reminders: Reminder[] }
  return j.reminders
}

export async function createReminder(
  body: Omit<Reminder, 'id' | 'created_at' | 'updated_at'>,
): Promise<Reminder> {
  const r = await fetch(`${base}/api/reminders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(await r.text())
  const j = (await r.json()) as { reminder: Reminder }
  return j.reminder
}

export async function updateReminder(
  id: string,
  patch: Partial<Omit<Reminder, 'id' | 'created_at' | 'updated_at'>>,
): Promise<Reminder> {
  const r = await fetch(`${base}/api/reminder/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!r.ok) throw new Error(await r.text())
  const j = (await r.json()) as { reminder: Reminder }
  return j.reminder
}

export async function deleteReminder(id: string): Promise<void> {
  const r = await fetch(`${base}/api/reminder/${id}`, { method: 'DELETE' })
  if (!r.ok) throw new Error(await r.text())
}

export async function fetchVapidPublicKey(): Promise<string> {
  const r = await fetch(`${base}/api/vapid-public`)
  if (!r.ok) throw new Error('VAPID no disponible')
  const j = (await r.json()) as { publicKey: string }
  return j.publicKey
}

export async function postPushSubscription(sub: PushSubscriptionJSON): Promise<void> {
  const r = await fetch(`${base}/api/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub),
  })
  if (!r.ok) throw new Error(await r.text())
}
