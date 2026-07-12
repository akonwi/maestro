import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { FixtureRow } from '@/components/fixture-row'
import type { Fixture } from '@/lib/fixtures'
import { upcomingFixturesQuery } from '@/lib/fixtures'

export const Route = createFileRoute('/')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(upcomingFixturesQuery),
  pendingComponent: FixturesRoutePending,
  errorComponent: FixturesRouteError,
  component: FixturesPage,
})

const dayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

function FixturesRoutePending() {
  return (
    <main className='mx-auto w-full max-w-5xl px-4 py-14' id='main-content'>
      <FixtureSkeleton />
    </main>
  )
}

function FixturesRouteError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <main className='mx-auto w-full max-w-5xl px-4 py-14' id='main-content'>
      <ErrorState message={error.message} retry={reset} />
    </main>
  )
}

function FixturesPage() {
  const fixtures = useQuery(upcomingFixturesQuery)

  return (
    <main
      className='mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14'
      id='main-content'
    >
      <div className='mb-8'>
        <div className='section-kicker'>MLS / Upcoming</div>
        <h1 className='mt-3 text-balance text-3xl font-semibold tracking-tight'>
          Upcoming fixtures
        </h1>
        <p className='mt-2 text-sm text-muted-foreground'>
          Make your picks before kickoff. Exact score earns three points.
        </p>
      </div>

      {fixtures.isPending ? <FixtureSkeleton /> : null}
      {fixtures.isError ? (
        <ErrorState
          message={fixtures.error.message}
          retry={() => fixtures.refetch()}
        />
      ) : null}
      {fixtures.data?.length === 0 ? <EmptyState /> : null}
      {fixtures.data ? <FixtureGroups fixtures={fixtures.data} /> : null}
    </main>
  )
}

function FixtureGroups({ fixtures }: { fixtures: Fixture[] }) {
  const groups = new Map<string, typeof fixtures>()
  for (const fixture of fixtures) {
    const day = dayFormatter.format(fixture.kickoff_at)
    const group = groups.get(day)
    if (group) group.push(fixture)
    else groups.set(day, [fixture])
  }
  return (
    <div className='space-y-8'>
      {[...groups].map(([day, dayFixtures]) => (
        <section key={day}>
          <h2 className='mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
            {day}
          </h2>
          <div className='grid gap-2'>
            {dayFixtures.map(fixture => (
              <FixtureRow fixture={fixture} key={fixture.id} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function FixtureSkeleton() {
  return (
    <div aria-live='polite' role='status'>
      <span className='sr-only'>Loading fixtures…</span>
      <div
        aria-hidden
        className='h-48 animate-pulse border border-border bg-muted motion-reduce:animate-none'
      />
    </div>
  )
}

function EmptyState() {
  return (
    <div className='border border-border bg-surface p-8 text-center'>
      <h2 className='font-semibold'>No upcoming fixtures</h2>
      <p className='mt-2 text-sm text-muted-foreground'>
        Check back when the next matchday is scheduled.
      </p>
    </div>
  )
}

function ErrorState({
  message,
  retry,
}: {
  message: string
  retry: () => void
}) {
  return (
    <div
      className='border border-danger bg-danger-muted p-4 text-sm text-danger'
      role='alert'
    >
      <strong>Fixtures unavailable.</strong> Check your connection and try
      again.
      <details className='mt-2 text-xs'>
        <summary>Technical details</summary>
        <p className='break-words'>{message}</p>
      </details>
      <button className='ui-button mt-4' onClick={retry} type='button'>
        Retry fixtures
      </button>
    </div>
  )
}
