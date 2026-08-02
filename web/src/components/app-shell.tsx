import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { type ReactNode, useEffect } from 'react'
import { currentUserQuery, isAuthRejection, logout } from '@/lib/auth'
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
