import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { type ReactNode, useEffect } from 'react'
import { currentUserQuery, logout } from '@/lib/auth'
import { clearSessionToken, useSessionToken } from '@/lib/session'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className='flex min-h-screen flex-col bg-background text-foreground'>
      <a className='skip-link' href='#main-content'>
        Skip to main content
      </a>
      <header className='app-header'>
        <div className='app-header-inner mx-auto max-w-6xl'>
          <Link className='app-wordmark' to='/' translate='no'>
            Maestro
          </Link>
          <nav
            aria-label='Primary navigation'
            className='flex items-center gap-5 text-sm'
          >
            <Link
              activeProps={{ className: 'text-accent font-semibold' }}
              activeOptions={{ exact: true }}
              to='/'
            >
              Fixtures
            </Link>
            <Link
              activeProps={{ className: 'text-accent font-semibold' }}
              to='/table'
            >
              Table
            </Link>
            <Link
              activeProps={{ className: 'text-accent font-semibold' }}
              search={{ mode: 'season', week: undefined }}
              to='/groups'
            >
              Groups
            </Link>
            <AuthControls />
          </nav>
        </div>
      </header>
      <div className='flex-1'>{children}</div>
      <SiteFooter />
    </div>
  )
}

function SiteFooter() {
  return (
    <footer className='border-t border-border'>
      <div className='mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6'>
        <span
          className='text-sm font-semibold uppercase tracking-[0.16em] text-foreground'
          translate='no'
        >
          Maestro
        </span>
        <div className='text-sm text-muted-foreground'>
          © {new Date().getFullYear()} Ngoh Technology
        </div>
      </div>
    </footer>
  )
}

function AuthControls() {
  const token = useSessionToken()
  const queryClient = useQueryClient()
  const user = useQuery(currentUserQuery(token))
  useEffect(() => {
    if (!user.isError) return
    clearSessionToken()
    queryClient.removeQueries({ queryKey: ['auth'] })
    queryClient.removeQueries({ queryKey: ['groups'] })
  }, [queryClient, user.isError])

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
      <Link className='font-semibold' to='/login'>
        Sign in
      </Link>
    )
  }

  return (
    <button
      aria-label={`Sign out${user.data?.email ? ` ${user.data.email}` : ''}`}
      className='max-w-32 truncate border-0 bg-transparent p-0 text-sm font-semibold hover:text-accent'
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
