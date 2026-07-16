import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FixtureRow } from '@/components/fixture-row'
import { MatchdayNavigator } from '@/components/matchday-navigator'
import type { Fixture } from '@/lib/fixtures'
import { roundLabel, roundQuery, seasonRoundsQuery } from '@/lib/fixtures'

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): { round?: string } =>
    typeof search.round === 'string' ? { round: search.round } : {},
  loaderDeps: ({ search }) => ({ round: search.round }),
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(seasonRoundsQuery),
      context.queryClient.ensureQueryData(roundQuery(deps.round)),
    ]),
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
  const { round: roundParam } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const season = useQuery(seasonRoundsQuery)
  const round = useQuery(roundQuery(roundParam))

  const current = season.data?.current ?? null
  const viewed = round.data?.round ?? roundParam ?? current
  const mode = matchdayMode(season.data?.rounds ?? [], current, viewed)

  function selectRound(name: string) {
    // Clearing the param keeps the default 'current matchday' view live.
    navigate({
      search: () => ({ round: name === current ? undefined : name }),
    })
  }

  return (
    <main
      className='mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14'
      id='main-content'
    >
      <div className='mb-6'>
        <div className='section-kicker'>{modeKicker(mode)}</div>
        <h1 className='mt-3 text-balance text-3xl font-semibold tracking-tight'>
          {viewed ? roundLabel(viewed) : 'Fixtures'}
        </h1>
        <p className='mt-2 text-sm text-muted-foreground'>
          {mode === 'results'
            ? 'Final scores and how the matchday played out.'
            : 'Make your picks before kickoff. Exact score earns three points.'}
        </p>
      </div>

      {season.data && season.data.rounds.length > 0 && viewed ? (
        <div className='mb-8'>
          <MatchdayNavigator
            current={viewed}
            onSelect={selectRound}
            rounds={season.data.rounds}
          />
        </div>
      ) : null}

      {round.isPending ? <FixtureSkeleton /> : null}
      {round.isError ? (
        <ErrorState
          message={round.error.message}
          retry={() => round.refetch()}
        />
      ) : null}
      {round.data?.fixtures.length === 0 ? <EmptyState /> : null}
      {round.data && round.data.fixtures.length > 0 ? (
        <FixtureGroups fixtures={round.data.fixtures} />
      ) : null}
    </main>
  )
}

type MatchdayMode = 'current' | 'results' | 'upcoming'

function matchdayMode(
  rounds: string[],
  current: string | null,
  viewed: string | null | undefined,
): MatchdayMode {
  if (!viewed || !current || viewed === current) return 'current'
  const viewedIndex = rounds.indexOf(viewed)
  const currentIndex = rounds.indexOf(current)
  if (viewedIndex < 0 || currentIndex < 0) return 'current'
  return viewedIndex < currentIndex ? 'results' : 'upcoming'
}

function modeKicker(mode: MatchdayMode) {
  if (mode === 'results') return 'MLS / Results'
  if (mode === 'upcoming') return 'MLS / Upcoming'
  return 'MLS / Current matchday'
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
      <h2 className='font-semibold'>No matchday scheduled</h2>
      <p className='mt-2 text-sm text-muted-foreground'>
        The season has no remaining fixtures. Check back when the next one kicks
        off.
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
