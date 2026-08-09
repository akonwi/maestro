import { Bell, BellRinging, BellSlash } from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { type ReactNode, useEffect, useState } from 'react'
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
              <NotificationsToggle />
              <AuthControls />
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

// Header bell: opt-in control for settlement notifications. Hidden when
// signed out or when the browser can't do Web Push at all.
function NotificationsToggle() {
  const token = useSessionToken()
  const [state, setState] = useState<PushState | 'loading'>('loading')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    pushState().then(current => {
      if (!cancelled) setState(current)
    })
    return () => {
      cancelled = true
    }
  }, [token])

  if (!token || state === 'loading' || state === 'unsupported') return null

  async function toggle() {
    if (!token || busy) return
    if (state === 'ios-install-required') {
      window.alert(
        'To get notifications on iPhone, add Maestro to your Home Screen first: tap the Share button, then “Add to Home Screen”.',
      )
      return
    }
    if (state === 'denied') return
    setBusy(true)
    try {
      setState(
        state === 'on' ? await disablePush(token) : await enablePush(token),
      )
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : 'Could not update notifications.',
      )
    } finally {
      setBusy(false)
    }
  }

  const label =
    state === 'on'
      ? 'Turn off result notifications'
      : state === 'denied'
        ? 'Notifications are blocked in your browser settings'
        : 'Get notified when your predictions settle'

  return (
    <button
      aria-label={label}
      aria-pressed={state === 'on'}
      className='notif-toggle plain'
      disabled={busy || state === 'denied'}
      onClick={toggle}
      title={label}
      type='button'
    >
      {state === 'on' ? (
        <BellRinging aria-hidden size={18} weight='fill' />
      ) : state === 'denied' ? (
        <BellSlash aria-hidden size={18} />
      ) : (
        <Bell aria-hidden size={18} />
      )}
    </button>
  )
}

function AuthControls() {
  const token = useSessionToken()
  const queryClient = useQueryClient()
  const user = useQuery(currentUserQuery(token))
  useEffect(() => {
    // Only a definitive rejection (401/403) invalidates the session.
    // Transient failures (network, 5xx, slow server) must never sign
    // the user out.
    if (!user.isError || !isAuthRejection(user.error)) return
    clearSessionToken()
    queryClient.removeQueries({ queryKey: ['auth'] })
    queryClient.removeQueries({ queryKey: ['groups'] })
  }, [queryClient, user.isError, user.error])

  const signOut = useMutation({
    mutationFn: () => (token ? logout(token) : Promise.resolve()),
    onSettled: () => {
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
    <button
      aria-label={`Sign out${user.data?.email ? ` ${user.data.email}` : ''}`}
      className='signout plain'
      disabled={signOut.isPending}
      onClick={() => signOut.mutate()}
      title={user.data?.email ?? 'Sign out'}
      type='button'
    >
      {signOut.isPending
        ? 'Signing out…'
        : (user.data?.display_name ?? user.data?.email ?? 'Sign out')}
    </button>
  )
}
