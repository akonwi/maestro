import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FixtureRow } from '@/components/fixture-row'
import { MatchdayNavigator } from '@/components/matchday-navigator'
import { ScopeRail } from '@/components/scope-rail'
import type { Competition, Fixture } from '@/lib/fixtures'
import {
  feedQuery,
  roundLabel,
  roundQuery,
  seasonRoundsQuery,
} from '@/lib/fixtures'

type FixturesSearch = { round?: string; c?: number }

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): FixturesSearch => {
    const out: FixturesSearch = {}
    if (typeof search.round === 'string') out.round = search.round
    const c = Number(search.c)
    if (Number.isInteger(c) && c > 0) out.c = c
    return out
  },
  loaderDeps: ({ search }) => ({ round: search.round, c: search.c }),
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(feedQuery),
      ...(deps.c === undefined
        ? []
        : [
            context.queryClient.ensureQueryData(seasonRoundsQuery(deps.c)),
            context.queryClient.ensureQueryData(
              roundQuery({ competitionId: deps.c, name: deps.round }),
            ),
          ]),
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
  const { c } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const feed = useQuery(feedQuery)
  const competitions = feed.data?.map(entry => entry.competition) ?? []

  function selectScope(competitionId: number | null) {
    navigate({
      search: () => ({
        c: competitionId ?? undefined,
        round: undefined,
      }),
    })
  }

  return (
    <main className='page' id='main-content'>
      <m-vstack gap='lg'>
        {c === undefined ? <FeedHeader /> : <ScopedHeader competitionId={c} />}

        {competitions.length > 1 ? (
          <ScopeRail
            competitions={competitions}
            onSelect={selectScope}
            selected={c ?? null}
          />
        ) : null}

        {c === undefined ? <FeedBody /> : <ScopedBody competitionId={c} />}
      </m-vstack>
    </main>
  )
}

// ─── Unified feed (unscoped) ────────────────────────────────────────────

function FeedHeader() {
  return (
    <div>
      <h1 className='page-title'>This week</h1>
      <p className='page-subtitle'>
        Make your picks before kickoff. Exact score earns three points.
      </p>
    </div>
  )
}

function FeedBody() {
  const feed = useQuery(feedQuery)

  if (feed.isPending) return <FixtureSkeleton />
  if (feed.isError)
    return (
      <ErrorState message={feed.error.message} retry={() => feed.refetch()} />
    )

  const competitionsById = new Map(
    feed.data.map(entry => [entry.competition.id, entry.competition]),
  )
  const fixtures = feed.data
    .flatMap(entry => entry.fixtures)
    .sort((a, b) => a.kickoff_at - b.kickoff_at)

  if (fixtures.length === 0) return <EmptyState />
  return (
    <FixtureGroups competitionsById={competitionsById} fixtures={fixtures} />
  )
}

// ─── League-scoped view ─────────────────────────────────────────────────

function ScopedHeader({ competitionId }: { competitionId: number }) {
  const { round: roundParam } = Route.useSearch()
  const season = useQuery(seasonRoundsQuery(competitionId))
  const round = useQuery(roundQuery({ competitionId, name: roundParam }))

  const current = season.data?.current ?? null
  const viewed = round.data?.round ?? roundParam ?? current
  const mode = matchdayMode(season.data?.rounds ?? [], current, viewed)

  return (
    <div>
      <h1 className='page-title'>{viewed ? roundLabel(viewed) : 'Fixtures'}</h1>
      <p className='page-subtitle'>
        {mode === 'results'
          ? 'Final scores and how the matchday played out.'
          : 'Make your picks before kickoff. Exact score earns three points.'}
      </p>
    </div>
  )
}

function ScopedBody({ competitionId }: { competitionId: number }) {
  const { round: roundParam } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const season = useQuery(seasonRoundsQuery(competitionId))
  const round = useQuery(roundQuery({ competitionId, name: roundParam }))

  const current = season.data?.current ?? null
  const viewed = round.data?.round ?? roundParam ?? current

  function selectRound(name: string) {
    // Clearing the param keeps the default 'current matchday' view live.
    navigate({
      search: previous => ({
        ...previous,
        round: name === current ? undefined : name,
      }),
    })
  }

  return (
    <>
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
    </>
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

// ─── Shared pieces ──────────────────────────────────────────────────────

function FixtureGroups({
  fixtures,
  competitionsById,
}: {
  fixtures: Fixture[]
  /** Present on cross-league lists; rows then carry a league tag. */
  competitionsById?: Map<number, Competition>
}) {
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
              <FixtureRow
                fixture={fixture}
                key={fixture.id}
                league={competitionsById?.get(fixture.competition_id)}
              />
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
      <span data-visually-hidden>Loading fixtures…</span>
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
