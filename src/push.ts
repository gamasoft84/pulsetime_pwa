import { fetchVapidPublicKey, postPushSubscription } from './api'

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

function isAppleMobile(): boolean {
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

/** Safari en iOS solo expone Web Push en la PWA instalada (desde el icono), no en la pestaña normal. */
function isStandaloneDisplay(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export type PushAvailability =
  | { ok: true }
  | { ok: false; reason: 'ios-open-from-icon'; hint: string }
  | { ok: false; reason: 'no-api'; hint: string }

export function getPushAvailability(): PushAvailability {
  if (!('serviceWorker' in navigator)) {
    return {
      ok: false,
      reason: 'no-api',
      hint: 'Este navegador no soporta service worker.',
    }
  }
  if (isAppleMobile() && !isStandaloneDisplay()) {
    return {
      ok: false,
      reason: 'ios-open-from-icon',
      hint: 'En iPhone, Web Push solo funciona si añades PulseTime a la pantalla de inicio y abres la app desde el icono (no desde una pestaña de Safari).',
    }
  }
  if (!('PushManager' in window)) {
    return {
      ok: false,
      reason: 'no-api',
      hint: 'Push no está disponible en este contexto. Usa Safari en iOS 16.4+ con la app instalada, o un navegador compatible en escritorio.',
    }
  }
  return { ok: true }
}

/** @deprecated Usa getPushAvailability para mensajes claros en iOS */
export function pushSupported(): boolean {
  return getPushAvailability().ok
}

/** Permiso concedido y suscripción push local ya creada (no garantiza que el servidor la tenga). */
export async function hasActiveLocalPushSubscription(): Promise<boolean> {
  if (!getPushAvailability().ok || typeof Notification === 'undefined') return false
  if (Notification.permission !== 'granted') return false
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return !!sub
  } catch {
    return false
  }
}

export async function subscribeToPush(): Promise<'ok' | 'unsupported' | 'denied' | 'error'> {
  if (!getPushAvailability().ok) {
    return 'unsupported'
  }
  if (typeof Notification === 'undefined') {
    return 'unsupported'
  }

  /** Solo pedir el diálogo del sistema si aún está en "preguntar"; si ya es granted, no llama de nuevo. */
  if (Notification.permission === 'denied') {
    return 'denied'
  }
  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return 'denied'
  }

  try {
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      const publicKey = await fetchVapidPublicKey()
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
    }
    await postPushSubscription(sub.toJSON())
    return 'ok'
  } catch {
    return 'error'
  }
}
