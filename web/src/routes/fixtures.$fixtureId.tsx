import { ArrowLeft } from '@phosphor-icons/react'
import type { UseQueryResult } from '@tanstack/react-query'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createFileRoute,
  Link,
  notFound,
  useNavigate,
} from '@tanstack/react-router'
import { type FormEvent, useEffect, useState } from 'react'
import { FixtureOutlook } from '@/components/fixture-outlook'
import { MatchDetailPanel } from '@/components/match-detail'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { matchDetailQuery, outlookQuery } from '@/lib/analysis'
import type { Fixture } from '@/lib/fixtures'
import { fixtureQuery, fixtureStatusLabel, teamCrestUrl } from '@/lib/fixtures'
import { groupsQuery } from '@/lib/groups'
import {
  currentPredictionQuery,
  type GroupPrediction,
  groupPredictionsQuery,
  type Prediction,
  savePrediction,
} from '@/lib/predictions'
import { useSessionToken } from '@/lib/session'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/fixtures/$fixtureId')({
  validateSearch: (search: Record<string, unknown>) => {
    const group = Number(search.group)
    return { group: Number.isInteger(group) && group > 0 ? group : undefined }
  },
  loader: ({ context, params }) => {
    const id = Number(params.fixtureId)
    if (!Number.isInteger(id) || id <= 0) throw notFound()
    return context.queryClient.ensureQueryData(fixtureQuery(id))
  },
  pendingComponent: FixtureSkeleton,
  errorComponent: FixtureRouteError,
  notFoundComponent: InvalidFixture,
  component: FixturePage,
})

const kickoffFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function FixturePage() {
  const { fixtureId } = Route.useParams()
  const id = Number(fixtureId)
  const fixture = useQuery(fixtureQuery(id))

  return (
    <main
      className='mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10'
      id='main-content'
    >
      <Link
        className='mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground'
        to='/'
      >
        <ArrowLeft aria-hidden size={16} /> Upcoming Fixtures
      </Link>

      {fixture.isPending ? <FixtureSkeleton /> : null}
      {fixture.isError ? (
        <div
          className='border border-danger bg-danger-muted p-4 text-danger'
          role='alert'
        >
          Fixture unavailable. Return to fixtures and try again.
        </div>
      ) : null}
      {fixture.data ? <FixtureDetail fixture={fixture.data} /> : null}
    </main>
  )
}

function FixtureDetail({ fixture }: { fixture: Fixture }) {
  const locked = useKickoffLocked(fixture.kickoff_at)
  const outlook = useQuery(outlookQuery(fixture.id, !locked))
  const matchDetail = useQuery(matchDetailQuery(fixture.id, locked))
  const showStatus =
    locked && fixture.status !== 'NS' && fixture.status !== 'TBD'
  return (
    <>
      <article className='border border-border bg-surface'>
        <header className='flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between'>
          <h1 className='sr-only'>
            {fixture.home_team.name} vs {fixture.away_team.name}
          </h1>
          {showStatus ? (
            <span className='font-mono text-[.625rem] font-semibold uppercase tracking-wider text-accent'>
              {fixtureStatusLabel(fixture.status)}
            </span>
          ) : (
            <span aria-hidden />
          )}
          <span className='text-sm text-muted-foreground'>
            {kickoffFormatter.format(fixture.kickoff_at)}
          </span>
        </header>
        <div className='grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-5 sm:px-6'>
          <Team id={fixture.home_team.id} name={fixture.home_team.name} />
          <div className='text-center font-mono font-semibold tabular-nums'>
            {fixture.status === 'FT' &&
            fixture.home_score !== null &&
            fixture.away_score !== null ? (
              <span className='text-lg'>
                {fixture.home_score}–{fixture.away_score}
              </span>
            ) : (
              <span className='text-xs text-muted-foreground'>VS</span>
            )}
          </div>
          <Team away id={fixture.away_team.id} name={fixture.away_team.name} />
        </div>
        {locked ? null : (
          <footer className='border-t border-border bg-muted px-4 py-2.5 text-center text-xs text-muted-foreground'>
            Predictions are open until kickoff.
          </footer>
        )}
      </article>
      <PredictionArea fixture={fixture} locked={locked} />
      {locked ? (
        <MatchDetailPanel query={matchDetail} />
      ) : (
        <FixtureOutlook kickoffAt={fixture.kickoff_at} query={outlook} />
      )}
    </>
  )
}

function useKickoffLocked(kickoffAt: number) {
  const [locked, setLocked] = useState(() => kickoffAt <= Date.now())

  useEffect(() => {
    if (locked) return
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      const remaining = kickoffAt - Date.now()
      if (remaining <= 0) {
        setLocked(true)
        return
      }
      timer = setTimeout(schedule, Math.min(remaining, 2_147_483_647))
    }
    schedule()
    return () => clearTimeout(timer)
  }, [kickoffAt, locked])

  return locked
}

function PredictionArea({
  fixture,
  locked,
}: {
  fixture: Fixture
  locked: boolean
}) {
  const token = useSessionToken()
  const { group: requestedGroup } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const groups = useQuery({ ...groupsQuery, enabled: Boolean(token) })
  const mine = useQuery(currentPredictionQuery(fixture.id, Boolean(token)))
  const selectedGroup =
    groups.data?.find(group => group.id === requestedGroup) ?? groups.data?.[0]
  const groupOptions =
    groups.data?.map(group => ({ label: group.name, value: group.id })) ?? []
  const groupPredictions = useQuery(
    groupPredictionsQuery(
      selectedGroup?.id ?? 0,
      fixture.id,
      Boolean(token && selectedGroup),
    ),
  )

  useEffect(() => {
    if (!selectedGroup || requestedGroup === selectedGroup.id) return
    navigate({
      replace: true,
      search: previous => ({ ...previous, group: selectedGroup.id }),
    })
  }, [navigate, requestedGroup, selectedGroup])

  if (!token) {
    return (
      <section className='mt-6 border border-border bg-surface p-6 text-center'>
        <h2 className='font-semibold'>Sign In to Make a Prediction</h2>
        <Link
          className='ui-button ui-button-primary mt-4 inline-flex items-center'
          to='/login'
        >
          Sign In
        </Link>
      </section>
    )
  }

  return (
    <section
      className='mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(20rem,4fr)]'
      aria-labelledby='predictions-heading'
    >
      <h2 className='sr-only' id='predictions-heading'>
        Predictions
      </h2>
      <div>
        {mine.isPending ? <PredictionSkeleton /> : null}
        {mine.isError ? <PredictionError /> : null}
        {!mine.isPending && !mine.isError ? (
          <PredictionForm
            fixture={fixture}
            initial={mine.data ?? null}
            locked={locked}
          />
        ) : null}
      </div>

      <section
        className='border border-border bg-surface'
        aria-labelledby='group-predictions-heading'
      >
        <div className='flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <h3 className='font-semibold' id='group-predictions-heading'>
              Predictions
            </h3>
            <p className='mt-0.5 text-xs text-muted-foreground'>
              Visible as submitted.
            </p>
          </div>
          {selectedGroup ? (
            <div className='flex min-w-0 items-stretch bg-surface'>
              <span
                className='flex h-10 items-center border border-r-0 border-border bg-muted px-3 font-mono text-[.625rem] font-semibold uppercase tracking-wider text-muted-foreground'
                id='prediction-group-label'
              >
                Group
              </span>
              <Select
                items={groupOptions}
                onValueChange={groupId => {
                  if (groupId === null) return
                  navigate({
                    search: previous => ({ ...previous, group: groupId }),
                  })
                }}
                value={selectedGroup.id}
              >
                <SelectTrigger
                  aria-labelledby='prediction-group-label'
                  className='min-w-44 bg-surface px-3 text-sm font-semibold'
                  size='lg'
                >
                  <SelectValue>
                    {groupId =>
                      groupOptions.find(group => group.value === groupId)
                        ?.label ?? ''
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align='end'>
                  <SelectGroup>
                    {groupOptions.map(group => (
                      <SelectItem key={group.value} value={group.value}>
                        {group.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
        {groups.isPending ? <PredictionSkeleton /> : null}
        {groups.data?.length === 0 ? (
          <div className='p-5 text-sm'>
            <p>Create a group to compare predictions with other people.</p>
            <Link
              className='ui-button mt-4 inline-flex items-center'
              search={{ mode: 'season', week: undefined }}
              to='/groups'
            >
              Create a Group
            </Link>
          </div>
        ) : null}
        {selectedGroup ? (
          <GroupPredictionList query={groupPredictions} />
        ) : null}
      </section>
    </section>
  )
}

function PredictionForm({
  fixture,
  initial,
  locked,
}: {
  fixture: Fixture
  initial: Prediction | null
  locked: boolean
}) {
  const queryClient = useQueryClient()
  const [homeScore, setHomeScore] = useState(
    initial?.home_score?.toString() ?? '',
  )
  const [awayScore, setAwayScore] = useState(
    initial?.away_score?.toString() ?? '',
  )
  const save = useMutation({
    mutationFn: () =>
      savePrediction(fixture.id, Number(homeScore), Number(awayScore)),
    onSuccess: prediction => {
      queryClient.setQueryData(['predictions', 'mine', fixture.id], prediction)
      queryClient.invalidateQueries({ queryKey: ['predictions', 'group'] })
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    save.mutate()
  }

  return (
    <form className='border border-border bg-surface' onSubmit={submit}>
      <div className='flex items-center justify-between border-b border-border px-5 py-3'>
        <h3 className='font-semibold'>Your Prediction</h3>
        {locked || !initial ? (
          <span className='font-mono text-[.625rem] font-semibold uppercase tracking-wider text-muted-foreground'>
            {locked ? 'Locked' : 'Not submitted'}
          </span>
        ) : null}
      </div>
      <div className='grid grid-cols-[1fr_auto_1fr] items-end gap-4 px-5 py-6 sm:gap-8 sm:px-10'>
        <ScoreInput
          disabled={locked || save.isPending}
          label={fixture.home_team.name}
          name='home_score'
          onChange={setHomeScore}
          value={homeScore}
        />
        <span className='pb-5 font-mono text-muted-foreground'>—</span>
        <ScoreInput
          disabled={locked || save.isPending}
          label={fixture.away_team.name}
          name='away_score'
          onChange={setAwayScore}
          value={awayScore}
        />
      </div>
      {locked ? null : (
        <div className='border-t border-border p-4'>
          {save.isError ? (
            <p className='mb-3 text-sm text-danger' role='alert'>
              {save.error.message}
            </p>
          ) : null}
          <button
            className='ui-button ui-button-primary w-full'
            disabled={save.isPending}
            type='submit'
          >
            {save.isPending
              ? 'Saving prediction…'
              : initial
                ? 'Update Prediction'
                : 'Save Prediction'}
          </button>
          <p className='mt-3 text-center text-xs text-muted-foreground'>
            Open until kickoff
          </p>
        </div>
      )}
    </form>
  )
}

function ScoreInput({
  disabled,
  label,
  name,
  onChange,
  value,
}: {
  disabled: boolean
  label: string
  name: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <label className='grid min-w-0 justify-items-center gap-3 text-sm font-semibold'>
      <span className='w-full truncate text-center'>{label}</span>
      <input
        autoComplete='off'
        className='size-16 appearance-none sm:size-20 border border-foreground bg-surface text-center font-mono text-2xl font-semibold tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
        disabled={disabled}
        inputMode='numeric'
        max='99'
        min='0'
        name={name}
        onChange={event => onChange(event.target.value)}
        required
        step='1'
        type='number'
        value={value}
      />
    </label>
  )
}

function GroupPredictionList({
  query,
}: {
  query: UseQueryResult<GroupPrediction[], Error>
}) {
  if (query.isPending) return <PredictionSkeleton />
  if (query.isError) return <PredictionError />
  if (query.data.length === 0)
    return (
      <p className='p-5 text-sm text-muted-foreground'>No predictions yet.</p>
    )
  return (
    <div className='bg-surface'>
      {query.data.map(prediction => (
        <div
          className='grid grid-cols-[1fr_auto] items-center gap-4 border-b border-border p-4 last:border-b-0'
          key={prediction.user.id}
        >
          <div className='min-w-0 truncate font-semibold'>
            {prediction.user.display_name ?? prediction.user.email}
          </div>
          <div className='flex items-baseline gap-3'>
            <span className='font-mono text-lg font-semibold tabular-nums'>
              {prediction.home_score}–{prediction.away_score}
            </span>
            {prediction.points !== null ? (
              <span title={pointDescription(prediction.points)}>
                <span
                  aria-hidden
                  className={cn(
                    'block min-w-7 text-right font-mono text-sm font-semibold tabular-nums',
                    prediction.points > 0
                      ? 'text-accent'
                      : 'text-muted-foreground',
                  )}
                >
                  {prediction.points > 0 ? `+${prediction.points}` : '0'}
                </span>
                <span className='sr-only'>
                  {pointDescription(prediction.points)}
                </span>
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}

function pointDescription(points: number) {
  if (points === 3) return '3 points, exact score'
  if (points === 1) return '1 point, correct outcome'
  return '0 points'
}

function PredictionSkeleton() {
  return (
    <div
      aria-label='Loading predictions'
      className='mt-4 h-24 animate-pulse border border-border bg-muted motion-reduce:animate-none'
      role='status'
    />
  )
}

function PredictionError() {
  return (
    <p
      className='mt-4 border border-danger bg-danger-muted p-4 text-sm text-danger'
      role='alert'
    >
      Predictions are unavailable. Try again shortly.
    </p>
  )
}

function FixtureSkeleton() {
  return (
    <div aria-live='polite' role='status'>
      <span className='sr-only'>Loading fixture…</span>
      <div
        aria-hidden
        className='h-72 animate-pulse border border-border bg-muted motion-reduce:animate-none'
      />
    </div>
  )
}

function FixtureRouteError({ reset }: { reset: () => void }) {
  return (
    <main className='mx-auto w-full max-w-4xl px-4 py-14' id='main-content'>
      <div
        className='border border-danger bg-danger-muted p-5 text-danger'
        role='alert'
      >
        <h1 className='font-semibold'>Fixture Unavailable</h1>
        <p className='mt-2 text-sm'>Check your connection and try again.</p>
        <button className='ui-button mt-4' onClick={reset} type='button'>
          Retry Fixture
        </button>
      </div>
    </main>
  )
}

function InvalidFixture() {
  return (
    <main className='mx-auto w-full max-w-4xl px-4 py-14' id='main-content'>
      <div
        className='border border-danger bg-danger-muted p-5 text-danger'
        role='alert'
      >
        <h1 className='font-semibold'>Invalid Fixture</h1>
        <p className='mt-2 text-sm'>
          Choose a fixture from the upcoming schedule.
        </p>
        <Link className='ui-button mt-4 inline-flex items-center' to='/'>
          View Upcoming Fixtures
        </Link>
      </div>
    </main>
  )
}

function Team({
  away = false,
  id,
  name,
}: {
  away?: boolean
  id: number
  name: string
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-3 ${away ? 'flex-row-reverse text-right' : ''}`}
    >
      <span className='grid size-10 shrink-0 place-items-center border border-border bg-muted p-1.5 sm:size-12'>
        <img
          alt={`${name} crest`}
          className='max-h-full max-w-full'
          decoding='async'
          height='48'
          src={teamCrestUrl(id)}
          width='48'
        />
      </span>
      <h2 className='truncate text-sm font-semibold sm:text-lg'>{name}</h2>
    </div>
  )
}
