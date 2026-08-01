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
    <main className='page' id='main-content'>
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
    <main className='page' id='main-content'>
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
    <main className='page' id='main-content'>
      <m-vstack gap='lg'>
        <div>
          <div className='section-kicker'>{modeKicker(mode)}</div>
          <h1 className='page-title'>
            {viewed ? roundLabel(viewed) : 'Fixtures'}
          </h1>
          <p className='page-subtitle'>
            {mode === 'results'
              ? 'Final scores and how the matchday played out.'
              : 'Make your picks before kickoff. Exact score earns three points.'}
          </p>
        </div>

        {season.data && season.data.rounds.length > 0 && viewed ? (
          <MatchdayNavigator
            current={viewed}
            onSelect={selectRound}
            rounds={season.data.rounds}
          />
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
      </m-vstack>
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
    <m-vstack gap='xl'>
      {[...groups].map(([day, dayFixtures]) => (
        <section key={day}>
          <h2 className='day-heading'>{day}</h2>
          <m-vstack gap='xs'>
            {dayFixtures.map(fixture => (
              <FixtureRow fixture={fixture} key={fixture.id} />
            ))}
          </m-vstack>
        </section>
      ))}
    </m-vstack>
  )
}

function FixtureSkeleton() {
  return (
    <div aria-live='polite' role='status'>
      <span className='sr-only'>Loading fixtures…</span>
      <div aria-hidden className='skeleton' />
    </div>
  )
}

function EmptyState() {
  return (
    <div className='empty-state'>
      <h2>No matchday scheduled</h2>
      <p className='page-subtitle'>
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
    <div className='error-card' role='alert'>
      <m-vstack align='start' gap='sm'>
        <span>
          <strong>Fixtures unavailable.</strong> Check your connection and try
          again.
        </span>
        <details>
          <summary>Technical details</summary>
          <p>{message}</p>
        </details>
        <button onClick={retry} type='button'>
          Retry fixtures
        </button>
      </m-vstack>
    </div>
  )
}
