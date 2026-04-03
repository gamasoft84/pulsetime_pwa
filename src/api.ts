import type { Reminder } from './types'

const base = ''

let authTokenGetter: (() => Promise<string | null>) | null = null

export function setApiAuthTokenGetter(fn: () => Promise<string | null>) {
  authTokenGetter = fn
}

async function withAuth(init: RequestInit = {}): Promise<RequestInit> {
  const headers = new Headers(init.headers)
  if (authTokenGetter) {
    const t = await authTokenGetter()
    if (t) headers.set('Authorization', `Bearer ${t}`)
  }
  return { ...init, headers }
}

async function readApiError(res: Response): Promise<string> {
  const ct = res.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) {
    try {
      const j = (await res.json()) as { error?: string }
      if (j?.error && typeof j.error === 'string') return j.error
    } catch {
      /* ignore */
    }
  }
  const text = await res.text()
  if (text.includes('FUNCTION_INVOCATION_FAILED')) {
    return 'Error del servidor (Vercel). Revisa logs del deployment y que exista DATABASE_URL en este entorno (Production vs Preview).'
  }
  const trimmed = text.trim()
  if (trimmed.length > 280) return `${trimmed.slice(0, 280)}…`
  return trimmed || `Error HTTP ${res.status}`
}

export async function fetchReminders(): Promise<Reminder[]> {
  const r = await fetch(`${base}/api/reminders`, await withAuth())
  if (!r.ok) throw new Error(await readApiError(r))
  const j = (await r.json()) as { reminders: Reminder[] }
  return j.reminders
}

export async function createReminder(
  body: Omit<Reminder, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
): Promise<Reminder> {
  const r = await fetch(
    `${base}/api/reminders`,
    await withAuth({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  if (!r.ok) throw new Error(await readApiError(r))
  const j = (await r.json()) as { reminder: Reminder }
  return j.reminder
}

export async function updateReminder(
  id: string,
  patch: Partial<Omit<Reminder, 'id' | 'user_id' | 'created_at' | 'updated_at'>>,
): Promise<Reminder> {
  const r = await fetch(
    `${base}/api/reminder/${id}`,
    await withAuth({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  )
  if (!r.ok) throw new Error(await readApiError(r))
  const j = (await r.json()) as { reminder: Reminder }
  return j.reminder
}

export async function deleteReminder(id: string): Promise<void> {
  const r = await fetch(`${base}/api/reminder/${id}`, await withAuth({ method: 'DELETE' }))
  if (!r.ok) throw new Error(await readApiError(r))
}

export async function fetchVapidPublicKey(): Promise<string> {
  const r = await fetch(`${base}/api/vapid-public`)
  if (!r.ok) throw new Error(await readApiError(r))
  const j = (await r.json()) as { publicKey: string }
  return j.publicKey
}

export async function postPushSubscription(sub: PushSubscriptionJSON): Promise<void> {
  const r = await fetch(
    `${base}/api/push/subscribe`,
    await withAuth({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
    }),
  )
  if (!r.ok) throw new Error(await readApiError(r))
}
