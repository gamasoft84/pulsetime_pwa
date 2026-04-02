import { fetchVapidPublicKey, postPushSubscription } from './api'

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export async function subscribeToPush(): Promise<'ok' | 'unsupported' | 'denied' | 'error'> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported'
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'

  try {
    const reg = await navigator.serviceWorker.ready
    const publicKey = await fetchVapidPublicKey()
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
    await postPushSubscription(sub.toJSON())
    return 'ok'
  } catch {
    return 'error'
  }
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window
}
