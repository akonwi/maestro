import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'maestro.session.v1'
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY) emitChange()
  })
}

function readToken() {
  return typeof window === 'undefined'
    ? null
    : localStorage.getItem(STORAGE_KEY)
}

export function getSessionToken() {
  return readToken()
}

export function setSessionToken(token: string) {
  localStorage.setItem(STORAGE_KEY, token)
  emitChange()
}

export function clearSessionToken() {
  localStorage.removeItem(STORAGE_KEY)
  emitChange()
}

export function useSessionToken() {
  return useSyncExternalStore(subscribe, readToken, () => null)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function emitChange() {
  for (const listener of listeners) listener()
}
