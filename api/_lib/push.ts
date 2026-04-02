import webpush from 'web-push'
import { getSql } from './db'

let configured = false

export function configurePush() {
  if (configured) return
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT_MAIL ?? 'mailto:pulsetime@example.com'
  if (!pub || !priv) throw new Error('Faltan VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY')
  webpush.setVapidDetails(subject, pub, priv)
  configured = true
}

type SubRow = { endpoint: string; p256dh: string; auth: string }

export async function sendPayloadToAllSubscriptions(payload: { title: string; body: string }) {
  configurePush()
  const sql = getSql()
  const subs = (await sql`SELECT endpoint, p256dh, auth FROM push_subscriptions`) as SubRow[]
  const data = JSON.stringify(payload)
  await Promise.allSettled(
    subs.map((s) =>
      webpush
        .sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          data,
        )
        .catch(() => undefined),
    ),
  )
}
