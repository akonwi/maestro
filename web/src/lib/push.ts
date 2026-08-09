// Web Push subscription plumbing. The server owns VAPID keys and sends
// settlement results; this module registers the service worker, manages
// the browser subscription, and mirrors it to the server.

export type PushState =
  | 'unsupported' // browser can't do push (or iOS Safari outside a PWA)
  | 'ios-install-required' // iOS can push, but only once installed to Home Screen
  | 'denied' // user blocked notifications at the browser level
  | 'off'
  | 'on'

function supported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

function iosNeedsInstall() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    // biome-ignore lint/suspicious/noExplicitAny: iOS-only non-standard field
    (navigator as any).standalone === true
  return ios && !standalone && !supported()
}

export async function pushState(): Promise<PushState> {
  if (!supported())
    return iosNeedsInstall() ? 'ios-install-required' : 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  return subscription ? 'on' : 'off'
}

async function request(
  path: string,
  token: string,
  body: unknown,
  method: 'POST' | 'DELETE',
) {
  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const parsed = (await response.json().catch(() => null)) as {
      error?: string
    } | null
    throw new Error(
      parsed?.error ?? `Request failed with status ${response.status}`,
    )
  }
}

/** Enable push: register the SW, subscribe, and mirror to the server. */
export async function enablePush(token: string): Promise<PushState> {
  const config = (await (await fetch('/api/push/vapid-key')).json()) as {
    enabled: boolean
    key: string
  }
  if (!config.enabled)
    throw new Error('Notifications are not enabled on the server.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return pushState()

  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(config.key),
  })

  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Browser returned an incomplete push subscription.')
  }
  await request(
    '/push/subscriptions',
    token,
    { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
    'POST',
  )
  return 'on'
}

/** Disable push: drop the browser subscription and the server row. */
export async function disablePush(token: string): Promise<PushState> {
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (subscription) {
    await subscription.unsubscribe()
    await request(
      '/push/subscriptions',
      token,
      { endpoint: subscription.endpoint },
      'DELETE',
    )
  }
  return 'off'
}

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(normalized)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}
