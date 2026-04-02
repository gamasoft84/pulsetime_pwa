/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare type PrecacheEntry = string | { url: string; revision?: string | null }

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: PrecacheEntry[] }

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
self.skipWaiting()
clientsClaim()

self.addEventListener('push', (event: PushEvent) => {
  let title = 'PulseTime'
  let body = ''
  try {
    if (event.data) {
      const j = event.data.json() as { title?: string; body?: string }
      title = j.title ?? title
      body = j.body ?? ''
    }
  } catch {
    const t = event.data?.text()
    if (t) body = t
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
    }),
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const c of clientsArr) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) {
          return c.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow('/')
    }),
  )
})
