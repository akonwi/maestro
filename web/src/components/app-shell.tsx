import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className='min-h-screen bg-background text-foreground'>
      <header className='app-header'>
        <div className='app-header-inner mx-auto max-w-6xl'>
          <Link className='app-wordmark' to='/'>
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
            <span className='text-muted-foreground'>Groups</span>
          </nav>
        </div>
      </header>
      {children}
    </div>
  )
}
