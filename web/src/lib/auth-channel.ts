// Cross-tab coordination for magic-link sign-in.
//
// The email link almost always opens in a new tab, leaving the original
// "check your inbox" tab behind. This channel lets the verifying tab hand
// off to the original tab: the original navigates into the app and acks,
// and the verifying tab shows a "you can close this" message instead of
// loading a second copy of the app. No ack (e.g. link opened on another
// device) means the verifying tab enters the app itself.

export type AuthMessage = { type: 'signed-in' } | { type: 'ack' }

const CHANNEL_NAME = 'maestro-auth'

/** A BroadcastChannel for the handoff, or null when unsupported / SSR. */
export function createAuthChannel(): BroadcastChannel | null {
  if (
    typeof window === 'undefined' ||
    typeof BroadcastChannel === 'undefined'
  ) {
    return null
  }
  return new BroadcastChannel(CHANNEL_NAME)
}

export function isAuthMessage(data: unknown): data is AuthMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    (data.type === 'signed-in' || data.type === 'ack')
  )
}
