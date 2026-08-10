import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { feedQuery } from '@/lib/fixtures'
import type { StandingRow } from '@/lib/standings'
import {
  conferenceLabel,
  legendEntries,
  standingsQuery,
  zoneKind,
} from '@/lib/standings'

type TableSearch = { c?: number; conf?: number }

export const Route = createFileRoute('/table')({
  validateSearch: (search: Record<string, unknown>): TableSearch => {
    const out: TableSearch = {}
    const c = Number(search.c)
    if (Number.isInteger(c) && c > 0) out.c = c
    const conf = Number(search.conf)
    if (Number.isInteger(conf) && conf > 0) out.conf = conf
    return out
  },
  loaderDeps: ({ search }) => ({ c: search.c }),
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(feedQuery),
      context.queryClient.ensureQueryData(standingsQuery(deps.c)),
    ]),
  pendingComponent: TablePending,
  errorComponent: TableError,
  component: TablePage,
})

function TablePage() {
  const { c, conf = 0 } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const feed = useQuery(feedQuery)
  const standings = useQuery(standingsQuery(c))

  const competitions = feed.data?.map(entry => entry.competition) ?? []
  const selectedCompetition =
    competitions.find(
      competition => competition.id === (c ?? standings.data?.competition_id),
    ) ?? null

  const conferences = standings.data?.conferences ?? []
  const activeIndex = conf < conferences.length ? conf : 0
  const active = conferences[activeIndex]
  const legend = active ? legendEntries(active.rows) : []

  return (
    <main className='page wide' id='main-content'>
      <m-vstack align='stretch' gap='md'>
        <div>
          <h1 className='page-title'>League table</h1>
          <p className='page-subtitle'>
            {selectedCompetition
              ? `${selectedCompetition.name} · ${standings.data?.season ?? ''} season`
              : 'Standings and the qualification picture.'}
          </p>
        </div>

        {competitions.length > 1 ? (
          <div className='select-affix'>
            <span id='table-league-label'>League</span>
            <select
              aria-labelledby='table-league-label'
              onChange={event => {
                const id = Number(event.target.value)
                navigate({
                  search: () => ({ c: id, conf: undefined }),
                })
              }}
              value={selectedCompetition?.id ?? ''}
            >
              {competitions.map(competition => (
                <option key={competition.id} value={competition.id}>
                  {competition.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

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
                        navigate({
                          search: previous => ({
                            ...previous,
                            conf: index === 0 ? undefined : index,
                          }),
                        })
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

            <StandingsTable name={active.name} rows={active.rows} />

            {legend.map(entry => (
              <div className='legend-line' key={entry.label}>
                <span aria-hidden className={`tick ${entry.kind}`} />
                {entry.label}
              </div>
            ))}
          </div>
        ) : null}
      </m-vstack>
    </main>
  )
}

function StandingsTable({ name, rows }: { name: string; rows: StandingRow[] }) {
  return (
    <section aria-label={`${conferenceLabel(name)} standings`} className='card'>
      <table className='standings'>
        <caption data-visually-hidden>
          {conferenceLabel(name)} standings
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
          {rows.map(team => (
            <TableRow key={team.team_id} team={team} />
          ))}
        </tbody>
      </table>
    </section>
  )
}

function TableRow({ team }: { team: StandingRow }) {
  const kind = zoneKind(team.description)
  return (
    <tr className={clsx(kind && `zone-${kind}`)}>
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
          className={clsx(
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
      <span data-visually-hidden>Loading standings…</span>
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
