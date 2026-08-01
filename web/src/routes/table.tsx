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
    <main className='page wide' id='main-content'>
      <m-vstack align='stretch' gap='md'>
        <div>
          <div className='section-kicker'>
            MLS
            {standings.data?.season ? ` / ${standings.data.season} season` : ''}
          </div>
          <h1 className='page-title'>League table</h1>
          <p className='page-subtitle'>
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
          <div>
            {conferences.length > 1 ? (
              <m-tabs>
                <nav
                  aria-label='Conference'
                  className='tab-rail'
                  role='tablist'
                >
                  {conferences.map((conference, index) => (
                    <button
                      aria-selected={index === activeIndex}
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
                </nav>
              </m-tabs>
            ) : null}

            <ConferenceTable
              cutoff={cutoff}
              name={active.name}
              rows={active.rows}
            />

            <div className='legend-line'>
              <span aria-hidden className='tick' />
              Top {cutoff} qualify for the MLS Cup Playoffs
            </div>
          </div>
        ) : null}
      </m-vstack>
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
      className='card'
    >
      <table className='standings'>
        <caption className='sr-only'>
          {conferenceLabel(name)} Conference standings
        </caption>
        <colgroup>
          <col className='col-rank' />
          <col />
          <col className='col-n' />
          <col className='bp-sm col-n' />
          <col className='bp-sm col-n' />
          <col className='bp-sm col-n' />
          <col className='bp-md col-n' />
          <col className='bp-md col-n' />
          <col className='col-n' />
          <col className='col-pts' />
          <col className='bp-lg col-form' />
        </colgroup>
        <thead>
          <tr>
            <th scope='col'>#</th>
            <th className='club' scope='col'>
              Club
            </th>
            <th abbr='Played' scope='col'>
              P
            </th>
            <th abbr='Won' className='bp-sm' scope='col'>
              W
            </th>
            <th abbr='Drawn' className='bp-sm' scope='col'>
              D
            </th>
            <th abbr='Lost' className='bp-sm' scope='col'>
              L
            </th>
            <th abbr='Goals for' className='bp-md' scope='col'>
              GF
            </th>
            <th abbr='Goals against' className='bp-md' scope='col'>
              GA
            </th>
            <th abbr='Goal difference' scope='col'>
              GD
            </th>
            <th abbr='Points' scope='col'>
              Pts
            </th>
            <th className='bp-lg form-col' scope='col'>
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
    </section>
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
        inPlayoffs && 'in-playoffs',
        showPlayoffLine && 'playoff-line',
      )}
    >
      <td className='num rank'>{team.rank}</td>
      <th className='club-cell' scope='row'>
        <span className='club-inner'>
          <img
            alt=''
            decoding='async'
            height='24'
            loading='lazy'
            src={`https://media.api-sports.io/football/teams/${team.team_id}.png`}
            width='24'
          />
          <span className='name'>{team.team_name}</span>
        </span>
      </th>
      <td className='num'>{team.played}</td>
      <td className='bp-sm num'>{team.win}</td>
      <td className='bp-sm num'>{team.draw}</td>
      <td className='bp-sm num'>{team.lose}</td>
      <td className='bp-md num'>{team.goals_for}</td>
      <td className='bp-md num'>{team.goals_against}</td>
      <td className='num'>
        {team.goals_diff > 0 ? `+${team.goals_diff}` : team.goals_diff}
      </td>
      <td className='num pts'>{team.points}</td>
      <td className='bp-lg form-cell'>
        <Form value={team.form} />
      </td>
    </tr>
  )
}

function Form({ value }: { value: string }) {
  return (
    <span className='form-letters' style={{ padding: 0 }}>
      {value.split('').map((result, index) => (
        <span
          className={cn(
            result === 'W' && 'w',
            result === 'D' && 'd',
            result === 'L' && 'l',
          )}
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed ordered form characters
          key={index}
        >
          {result}
        </span>
      ))}
    </span>
  )
}

function TableSkeleton() {
  return (
    <div aria-live='polite' role='status'>
      <span className='sr-only'>Loading standings…</span>
      <div aria-hidden className='skeleton tall' />
    </div>
  )
}

function TablePending() {
  return (
    <main className='page wide' id='main-content'>
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
    <div className='error-card' role='alert'>
      <m-vstack align='start' gap='sm'>
        <span>
          <strong>Standings unavailable.</strong> Check your connection and try
          again.
        </span>
        <details>
          <summary>Technical details</summary>
          <p>{message}</p>
        </details>
        <button onClick={retry} type='button'>
          Retry standings
        </button>
      </m-vstack>
    </div>
  )
}

function TableError({ reset }: { reset: () => void }) {
  return (
    <main className='page wide' id='main-content'>
      <ErrorState message='Something went wrong.' retry={reset} />
    </main>
  )
}
