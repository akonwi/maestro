import { UserCircle } from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { currentUserQuery, isAuthRejection, logout } from '@/lib/auth'
import { disablePush, enablePush, type PushState, pushState } from '@/lib/push'
import { clearSessionToken, useSessionToken } from '@/lib/session'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className='app-root'>
      <a
        className='skip-link'
        data-visually-hidden='focusable'
        href='#main-content'
      >
        Skip to main content
      </a>
      <header className='app-header'>
        <m-hstack align='center' className='app-header-inner' justify='between'>
          <Link className='app-wordmark' to='/' translate='no'>
            Maestro
          </Link>
          <nav aria-label='Primary navigation' className='app-nav'>
            <m-hstack align='center' gap='md'>
              <Link
                activeProps={{ className: 'nav-active' }}
                activeOptions={{ exact: true }}
                to='/'
              >
                Fixtures
              </Link>
              <Link activeProps={{ className: 'nav-active' }} to='/table'>
                Table
              </Link>
              <Link
                activeProps={{ className: 'nav-active' }}
                search={{ mode: 'season', week: undefined }}
                to='/groups'
              >
                Groups
              </Link>
              <AccountMenu />
            </m-hstack>
          </nav>
        </m-hstack>
      </header>
      <div className='app-content'>{children}</div>
      <SiteFooter />
    </div>
  )
}

function SiteFooter() {
  return (
    <footer className='site-footer'>
      <m-hstack
        align='center'
        className='inner'
        gap='sm'
        justify='between'
        wrap
      >
        <span className='wordmark' translate='no'>
          Maestro
        </span>
        <div className='meta'>© {new Date().getFullYear()} Ngoh Technology</div>
      </m-hstack>
    </footer>
  )
}

// Account menu: the display name opens a popover with the signed-in
// identity, the push-notifications switch, and sign out. A click on the
// name only ever opens the menu — signing out is an intentional second
// click inside it.
function AccountMenu() {
  const token = useSessionToken()
  const queryClient = useQueryClient()
  const user = useQuery(currentUserQuery(token))
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // Only a definitive rejection (401/403) invalidates the session.
    // Transient failures (network, 5xx, slow server) must never sign
    // the user out.
    if (!user.isError || !isAuthRejection(user.error)) return
    clearSessionToken()
    queryClient.removeQueries({ queryKey: ['auth'] })
    queryClient.removeQueries({ queryKey: ['groups'] })
  }, [queryClient, user.isError, user.error])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const signOut = useMutation({
    mutationFn: () => (token ? logout(token) : Promise.resolve()),
    onSettled: () => {
      setOpen(false)
      clearSessionToken()
      queryClient.removeQueries({ queryKey: ['auth'] })
      queryClient.removeQueries({ queryKey: ['groups'] })
    },
  })

  if (!token) {
    return (
      <Link className='signin' to='/login'>
        Sign in
      </Link>
    )
  }

  return (
    <div className='account' ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup='dialog'
        aria-label='Account menu'
        className='account-trigger plain'
        onClick={() => setOpen(current => !current)}
        ref={triggerRef}
        type='button'
      >
        <UserCircle aria-hidden size={22} />
      </button>
      {open ? (
        <div aria-label='Account' className='account-popover' role='dialog'>
          <NotificationsRow token={token} />
          <button
            className='account-signout plain'
            disabled={signOut.isPending}
            onClick={() => signOut.mutate()}
            type='button'
          >
            {signOut.isPending ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

// The push-notifications control inside the account menu. Hidden while
// support is being probed and when the browser can't do Web Push at all;
// on iOS Safari outside a PWA it becomes an install instruction.
function NotificationsRow({ token }: { token: string }) {
  const [state, setState] = useState<PushState | 'loading'>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    pushState().then(current => {
      if (!cancelled) setState(current)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (state === 'loading' || state === 'unsupported') return null

  if (state === 'ios-install-required') {
    return (
      <div className='account-notifications'>
        <div className='account-row-label'>Result notifications</div>
        <p className='account-hint'>
          Add Maestro to your Home Screen to enable notifications: tap{' '}
          <b>Share</b>, then <b>Add to Home Screen</b>.
        </p>
      </div>
    )
  }

  async function toggle() {
    if (busy || state === 'denied') return
    setBusy(true)
    setError(null)
    try {
      setState(
        state === 'on' ? await disablePush(token) : await enablePush(token),
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not update notifications.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='account-notifications'>
      <label className='account-switch-row'>
        <span className='account-row-label'>Result notifications</span>
        <input
          aria-checked={state === 'on'}
          checked={state === 'on'}
          disabled={busy || state === 'denied'}
          onChange={toggle}
          role='switch'
          type='checkbox'
        />
      </label>
      {state === 'denied' ? (
        <p className='account-hint danger'>
          Notifications are blocked in your browser settings.
        </p>
      ) : (
        <p className='account-hint'>
          {state === 'on'
            ? "You'll get a push when your predictions settle."
            : 'Get notified when your predictions settle.'}
        </p>
      )}
      {error ? (
        <p className='account-hint danger' role='alert'>
          {error}
        </p>
      ) : null}
    </div>
  )
}
