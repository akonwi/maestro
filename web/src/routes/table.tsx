import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import type { StandingRow } from '@/lib/standings'
import { conferenceLabel, playoffCutoff, standingsQuery } from '@/lib/standings'
import { cn } from '@/lib/utils'

type TableSearch = { c?: number }

export const Route = createFileRoute('/table')({
  validateSearch: (search: Record<string, unknown>): TableSearch => {
    const c = Number(search.c)
    return Number.isInteger(c) && c > 0 ? { c } : {}
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(standingsQuery),
  pendingComponent: TablePending,
  errorComponent: TableError,
  component: TablePage,
})

function TablePage() {
  const { c = 0 } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const standings = useQuery(standingsQuery)

  const conferences = standings.data?.conferences ?? []
  const activeIndex = c < conferences.length ? c : 0
  const active = conferences[activeIndex]
  const cutoff = active ? playoffCutoff(active.rows) : 0

  return (
    <main
      className='mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14'
      id='main-content'
    >
      <div className='mb-6'>
        <div className='section-kicker'>
          MLS
          {standings.data?.season ? ` / ${standings.data.season} season` : ''}
        </div>
        <h1 className='mt-3 text-3xl font-semibold tracking-tight'>
          League table
        </h1>
        <p className='mt-2 text-sm text-muted-foreground'>
          Conference standings and the race for the MLS Cup Playoffs.
        </p>
      </div>

      {standings.isPending ? <TableSkeleton /> : null}
      {standings.isError ? (
        <ErrorState
          message={standings.error.message}
          retry={() => standings.refetch()}
        />
      ) : null}

      {conferences.length > 0 && active ? (
        <>
          {conferences.length > 1 ? (
            <div
              aria-label='Conference'
              className='mb-4 flex border-b border-border'
              role='tablist'
            >
              {conferences.map((conference, index) => (
                <button
                  aria-selected={index === activeIndex}
                  className={cn(
                    'min-h-11 px-4 text-sm font-semibold',
                    index === activeIndex
                      ? 'text-accent shadow-[inset_0_-2px_var(--color-accent)]'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  key={conference.name}
                  onClick={() =>
                    navigate({ search: index === 0 ? {} : { c: index } })
                  }
                  role='tab'
                  type='button'
                >
                  {conferenceLabel(conference.name)}
                </button>
              ))}
            </div>
          ) : null}

          <ConferenceTable
            cutoff={cutoff}
            name={active.name}
            rows={active.rows}
          />

          <div className='mt-3 flex items-center gap-2 text-xs text-muted-foreground'>
            <span aria-hidden className='h-3 w-0.5 bg-accent' />
            Top {cutoff} qualify for the MLS Cup Playoffs
          </div>
        </>
      ) : null}
    </main>
  )
}

function ConferenceTable({
  cutoff,
  name,
  rows,
}: {
  cutoff: number
  name: string
  rows: StandingRow[]
}) {
  return (
    <section
      aria-label={`${conferenceLabel(name)} Conference standings`}
      className='border border-border bg-surface'
    >
      <div className='overflow-x-hidden'>
        <table className='w-full table-fixed text-sm'>
          <caption className='sr-only'>
            {conferenceLabel(name)} Conference standings
          </caption>
          <colgroup>
            <col className='w-9 sm:w-12' />
            <col />
            <col className='w-9 sm:w-12' />
            <col className='hidden w-11 sm:table-column' />
            <col className='hidden w-11 sm:table-column' />
            <col className='hidden w-11 sm:table-column' />
            <col className='hidden w-11 md:table-column' />
            <col className='hidden w-11 md:table-column' />
            <col className='w-11' />
            <col className='w-12' />
            <col className='hidden w-24 lg:table-column' />
          </colgroup>
          <thead className='font-mono text-[.625rem] uppercase tracking-wider text-muted-foreground'>
            <tr className='border-b border-border bg-muted/50'>
              <th className='px-2 py-2.5 text-center font-medium' scope='col'>
                #
              </th>
              <th className='py-2.5 text-left font-medium' scope='col'>
                Club
              </th>
              <NumericHeading label='Played'>P</NumericHeading>
              <NumericHeading className='hidden sm:table-cell' label='Won'>
                W
              </NumericHeading>
              <NumericHeading className='hidden sm:table-cell' label='Drawn'>
                D
              </NumericHeading>
              <NumericHeading className='hidden sm:table-cell' label='Lost'>
                L
              </NumericHeading>
              <NumericHeading
                className='hidden md:table-cell'
                label='Goals for'
              >
                GF
              </NumericHeading>
              <NumericHeading
                className='hidden md:table-cell'
                label='Goals against'
              >
                GA
              </NumericHeading>
              <NumericHeading label='Goal difference'>GD</NumericHeading>
              <NumericHeading label='Points'>Pts</NumericHeading>
              <th
                className='hidden px-3 py-2.5 text-left font-medium lg:table-cell'
                scope='col'
              >
                Form
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((team, index) => (
              <TableRow
                inPlayoffs={index < cutoff}
                key={team.team_id}
                showPlayoffLine={index === cutoff}
                team={team}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function NumericHeading({
  children,
  className,
  label,
}: {
  children: React.ReactNode
  className?: string
  label: string
}) {
  return (
    <th
      abbr={label}
      className={cn('px-1 py-2.5 text-center font-medium', className)}
      scope='col'
    >
      {children}
    </th>
  )
}

function TableRow({
  inPlayoffs,
  team,
  showPlayoffLine,
}: {
  inPlayoffs: boolean
  team: StandingRow
  showPlayoffLine: boolean
}) {
  return (
    <tr
      className={cn(
        'border-b border-border last:border-b-0',
        showPlayoffLine && 'border-t-2 border-t-accent',
      )}
    >
      <td
        className={cn(
          'border-l-2 px-1 py-2.5 text-center font-mono text-xs tabular-nums text-muted-foreground',
          inPlayoffs ? 'border-l-accent' : 'border-l-transparent',
        )}
      >
        {team.rank}
      </td>
      <th className='min-w-0 py-2 text-left font-medium' scope='row'>
        <span className='flex min-w-0 items-center gap-2'>
          <img
            alt=''
            className='size-6 shrink-0 object-contain'
            decoding='async'
            height='24'
            loading='lazy'
            src={`https://media.api-sports.io/football/teams/${team.team_id}.png`}
            width='24'
          />
          <span className='truncate'>{team.team_name}</span>
        </span>
      </th>
      <NumberCell>{team.played}</NumberCell>
      <NumberCell className='hidden sm:table-cell'>{team.win}</NumberCell>
      <NumberCell className='hidden sm:table-cell'>{team.draw}</NumberCell>
      <NumberCell className='hidden sm:table-cell'>{team.lose}</NumberCell>
      <NumberCell className='hidden md:table-cell'>{team.goals_for}</NumberCell>
      <NumberCell className='hidden md:table-cell'>
        {team.goals_against}
      </NumberCell>
      <NumberCell>
        {team.goals_diff > 0 ? `+${team.goals_diff}` : team.goals_diff}
      </NumberCell>
      <NumberCell className='font-bold text-foreground'>
        {team.points}
      </NumberCell>
      <td className='hidden px-3 py-2 font-mono text-[.6875rem] font-semibold tracking-[.12em] lg:table-cell'>
        <Form value={team.form} />
      </td>
    </tr>
  )
}

function NumberCell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <td
      className={cn(
        'px-1 py-2.5 text-center font-mono text-xs tabular-nums text-muted-foreground',
        className,
      )}
    >
      {children}
    </td>
  )
}

function Form({ value }: { value: string }) {
  return (
    <>
      {value.split('').map((result, index) => (
        <span
          className={cn(
            result === 'W' && 'text-success',
            result === 'D' && 'text-muted-foreground',
            result === 'L' && 'text-danger',
          )}
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed ordered form characters
          key={index}
        >
          {result}
        </span>
      ))}
    </>
  )
}

function TableSkeleton() {
  return (
    <div aria-live='polite' role='status'>
      <span className='sr-only'>Loading standings…</span>
      <div
        aria-hidden
        className='h-96 animate-pulse border border-border bg-muted motion-reduce:animate-none'
      />
    </div>
  )
}

function TablePending() {
  return (
    <main className='mx-auto w-full max-w-6xl px-4 py-14' id='main-content'>
      <TableSkeleton />
    </main>
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
      <strong>Standings unavailable.</strong> Check your connection and try
      again.
      <details className='mt-2 text-xs'>
        <summary>Technical details</summary>
        <p className='break-words'>{message}</p>
      </details>
      <button className='ui-button mt-4' onClick={retry} type='button'>
        Retry standings
      </button>
    </div>
  )
}

function TableError({ reset }: { reset: () => void }) {
  return (
    <main className='mx-auto w-full max-w-6xl px-4 py-14' id='main-content'>
      <ErrorState message='Something went wrong.' retry={reset} />
    </main>
  )
}
