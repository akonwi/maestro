import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { FixtureRow } from '@/components/fixture-row'
import { getUpcomingFixtures } from '@/lib/fixtures'

export const Route = createFileRoute('/')({ component: FixturesPage })

const dayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

function FixturesPage() {
  const fixtures = useQuery({
    queryKey: ['fixtures', 'upcoming'],
    queryFn: getUpcomingFixtures,
  })

  return (
    <main className='mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14'>
      <div className='mb-8'>
        <div className='section-kicker'>MLS / Upcoming</div>
        <h1 className='mt-3 text-3xl font-semibold tracking-tight'>
          Upcoming fixtures
        </h1>
        <p className='mt-2 text-sm text-muted-foreground'>
          Make your picks before kickoff. Exact score earns three points.
        </p>
      </div>

      {fixtures.isPending ? <FixtureSkeleton /> : null}
      {fixtures.isError ? (
        <ErrorState message={fixtures.error.message} />
      ) : null}
      {fixtures.data?.length === 0 ? <EmptyState /> : null}
      {fixtures.data ? <FixtureGroups fixtures={fixtures.data} /> : null}
    </main>
  )
}

function FixtureGroups({
  fixtures,
}: {
  fixtures: Awaited<ReturnType<typeof getUpcomingFixtures>>
}) {
  const groups = new Map<string, typeof fixtures>()
  for (const fixture of fixtures) {
    const day = dayFormatter.format(fixture.kickoff_at)
    groups.set(day, [...(groups.get(day) ?? []), fixture])
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
  return <div className='h-48 animate-pulse border border-border bg-muted' />
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

function ErrorState({ message }: { message: string }) {
  return (
    <div className='border border-danger bg-danger-muted p-4 text-sm text-danger'>
      <strong>Fixtures unavailable.</strong> {message}
    </div>
  )
}
