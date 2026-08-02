import type { UseQueryResult } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { useId, useState } from 'react'
import type {
  GoalsPair,
  H2HResult,
  InjuryEntry,
  KeyPlayer,
  Outlook,
  TeamOutlook,
  TeamStrength,
} from '@/lib/analysis'
import { ordinal, percentValue } from '@/lib/analysis'

const h2hDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

/** Pre-match analysis: outlook probabilities plus comparison tabs. */
export function FixtureOutlook({
  query,
  kickoffAt,
}: {
  query: UseQueryResult<Outlook, Error>
  kickoffAt: number
}) {
  if (query.isPending) {
    return (
      <div aria-live='polite' role='status'>
        <span data-visually-hidden>Loading match outlook…</span>
        <div aria-hidden className='skeleton' />
      </div>
    )
  }
  // No outlook available (e.g. upstream has no data) — show nothing.
  if (query.isError) return null

  const outlook = query.data
  return (
    <m-vstack align='stretch' gap='md'>
      <OutlookProbabilities outlook={outlook} />
      <OutlookTabs kickoffAt={kickoffAt} outlook={outlook} />
      <AvailabilityPanel outlook={outlook} />
    </m-vstack>
  )
}

function OutlookProbabilities({ outlook }: { outlook: Outlook }) {
  const segments = [
    { label: outlook.home.name, percent: outlook.percent.home, kind: 'home' },
    { label: 'Draw', percent: outlook.percent.draw, kind: 'draw' },
    { label: outlook.away.name, percent: outlook.percent.away, kind: 'away' },
  ]
  return (
    <section aria-labelledby='outlook-heading' className='card'>
      <div className='panel-head'>
        <h3 id='outlook-heading'>Match Outlook</h3>
      </div>
      <div className='panel-body'>
        <div className='prob-bar'>
          {segments.map(segment => (
            <span
              className={segment.kind}
              key={segment.label}
              style={{ width: `${percentValue(segment.percent)}%` }}
            >
              {segment.percent}
            </span>
          ))}
        </div>
        <div className='prob-legend'>
          <span>{outlook.home.name}</span>
          <span>Draw</span>
          <span>{outlook.away.name}</span>
        </div>
      </div>
    </section>
  )
}

const OUTLOOK_TABS = ['Overview', 'Team form', 'Head-to-head'] as const

function OutlookTabs({
  outlook,
  kickoffAt,
}: {
  outlook: Outlook
  kickoffAt: number
}) {
  const [active, setActive] =
    useState<(typeof OUTLOOK_TABS)[number]>('Overview')
  const baseId = useId()

  return (
    <section className='card'>
      <m-tabs>
        <nav
          aria-label='Pre-match analysis'
          className='tab-rail'
          role='tablist'
        >
          {OUTLOOK_TABS.map(tab => (
            <button
              aria-controls={`${baseId}-${tab}`}
              aria-selected={active === tab}
              key={tab}
              onClick={() => setActive(tab)}
              role='tab'
              type='button'
            >
              {tab}
            </button>
          ))}
        </nav>
        <section
          className='tab-panel'
          id={`${baseId}-${active}`}
          role='tabpanel'
        >
          {active === 'Overview' ? (
            <>
              <NumbersPanel outlook={outlook} />
              <MatchupEdge outlook={outlook} />
              <KeyPlayersPanel outlook={outlook} />
            </>
          ) : null}
          {active === 'Team form' ? <TeamFormPanel outlook={outlook} /> : null}
          {active === 'Head-to-head' ? (
            <H2HPanel h2h={outlook.h2h} kickoffAt={kickoffAt} />
          ) : null}
        </section>
      </m-tabs>
    </section>
  )
}

type Better = 'home' | 'away' | null

// "1.80 · 4th of 30" — raw PPG plus league rank, or "–" below the floor.
function strengthLabel(strength: TeamStrength | null, total: number): string {
  if (strength === null) return '–'
  return `${strength.ppg.toFixed(2)} · ${ordinal(strength.rank)} of ${total}`
}

function betterSide(home: number, away: number, dir: 'high' | 'low'): Better {
  if (home === away) return null
  const homeWins = dir === 'high' ? home > away : home < away
  return homeWins ? 'home' : 'away'
}

// The concrete "By the numbers" comparison. Each row shows both teams'
// value with the stronger side subtly emphasized.
function NumbersPanel({ outlook }: { outlook: Outlook }) {
  const { home, away, standings, goals, strength } = outlook
  const homePoints = standings.home?.points ?? null
  const awayPoints = standings.away?.points ?? null
  const homeStrength = strength.home
  const awayStrength = strength.away

  const rows: {
    label: string
    home: string
    away: string
    better: Better
  }[] = [
    {
      label: 'Points',
      home: homePoints === null ? '–' : String(homePoints),
      away: awayPoints === null ? '–' : String(awayPoints),
      better:
        homePoints === null || awayPoints === null
          ? null
          : betterSide(homePoints, awayPoints, 'high'),
    },
    {
      label: 'PPG (last 10)',
      home: strengthLabel(homeStrength, strength.total),
      away: strengthLabel(awayStrength, strength.total),
      better:
        homeStrength === null || awayStrength === null
          ? null
          : betterSide(homeStrength.ppg, awayStrength.ppg, 'high'),
    },
    {
      label: 'W-D-L',
      home: `${home.wins}-${home.draws}-${home.losses}`,
      away: `${away.wins}-${away.draws}-${away.losses}`,
      better: betterSide(home.wins, away.wins, 'high'),
    },
    {
      label: 'At venue',
      home: `${home.home_wins}-${home.home_draws}-${home.home_losses} home`,
      away: `${away.away_wins}-${away.away_draws}-${away.away_losses} away`,
      better: betterSide(home.home_wins, away.away_wins, 'high'),
    },
    {
      label: 'Clean sheets',
      home: String(home.clean_sheets),
      away: String(away.clean_sheets),
      better: betterSide(home.clean_sheets, away.clean_sheets, 'high'),
    },
  ]

  return (
    <table className='compare-table'>
      <caption data-visually-hidden>
        {home.name} versus {away.name} by the numbers, including goals scored
        and conceded per game
      </caption>
      <thead>
        <tr>
          <th scope='col'>{home.name}</th>
          <th scope='col'>{''}</th>
          <th scope='col'>{away.name}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.label}>
            <td className={clsx(row.better === 'home' && 'strong')}>
              {row.home}
            </td>
            <th scope='row'>{row.label}</th>
            <td className={clsx(row.better === 'away' && 'strong')}>
              {row.away}
            </td>
          </tr>
        ))}
        <tr className='total'>
          <td>
            {home.goals_for_total} / {home.goals_against_total}
          </td>
          <th scope='row'>Goals (For/Against)</th>
          <td>
            {away.goals_for_total} / {away.goals_against_total}
          </td>
        </tr>
        {GOAL_SLICES.map(slice => (
          <tr className={clsx(slice.emphasize && 'emph')} key={slice.key}>
            <GoalsPairCell pair={goals.home[slice.key]} />
            <th scope='row'>{slice.label}</th>
            <GoalsPairCell pair={goals.away[slice.key]} />
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Goals matrix ──────────────────────────────────────────────────────

const GOAL_SLICES = [
  { label: 'Season', key: 'season' as const, emphasize: false },
  { label: 'At venue', key: 'venue' as const, emphasize: true },
  { label: 'Last 5', key: 'last5' as const, emphasize: false },
]

function MatchupEdge({ outlook }: { outlook: Outlook }) {
  const { home, away, goals } = outlook
  return (
    <p className='edge-note'>
      Matchup edge: {home.name} score <b>{goals.home.venue.for}</b> at home;{' '}
      {away.name} concede <b>{goals.away.venue.against}</b> away.
    </p>
  )
}

function GoalsPairCell({ pair }: { pair: GoalsPair }) {
  return (
    <td>
      {pair.for} / {pair.against}
    </td>
  )
}

// ─── Key players ───────────────────────────────────────────────────────

function KeyPlayersPanel({ outlook }: { outlook: Outlook }) {
  const { home, away, key_players } = outlook
  return (
    <section style={{ borderTop: '1px solid var(--color-border)' }}>
      <div className='panel-head plain'>
        <h4>Key players</h4>
        <span className='chip'>League leaders · season</span>
      </div>
      <div className='split-2'>
        <KeyPlayerList name={home.name} players={key_players.home} />
        <KeyPlayerList name={away.name} players={key_players.away} />
      </div>
    </section>
  )
}

function KeyPlayerList({
  name,
  players,
}: {
  name: string
  players: KeyPlayer[]
}) {
  return (
    <div>
      <h5 className='small-title'>{name}</h5>
      {players.length === 0 ? (
        <p className='hint'>No {name} players rank among the league leaders.</p>
      ) : (
        <m-vstack gap='xs'>
          {players.slice(0, 3).map(player => (
            <div className='player-line' key={player.player_id}>
              <div className='who'>{player.name}</div>
              <div className='role'>{playerRole(player)}</div>
              <div className='stats'>
                <span>
                  <b>{player.goals}</b> G
                </span>
                <span>
                  <b>{player.assists}</b> A
                </span>
                <span className='rating'>{player.rating}</span>
              </div>
            </div>
          ))}
        </m-vstack>
      )}
    </div>
  )
}

function playerRole(player: KeyPlayer) {
  if (player.is_scorer && player.is_assister) return 'Top scorer · assister'
  if (player.is_scorer) return 'Top scorer'
  return 'Top assister'
}

function TeamFormPanel({ outlook }: { outlook: Outlook }) {
  return (
    <div>
      <TeamFormSection team={outlook.home} />
      <TeamFormSection team={outlook.away} withDivider />
    </div>
  )
}

function TeamFormSection({
  team,
  withDivider = false,
}: {
  team: TeamOutlook
  withDivider?: boolean
}) {
  const recent = team.form.slice(-10).split('')
  return (
    <div
      style={
        withDivider ? { borderTop: '1px solid var(--color-border)' } : undefined
      }
    >
      <div className='panel-head'>
        <h4>{team.name}</h4>
        {recent.length > 0 ? (
          <span className='chip'>Last {recent.length}</span>
        ) : null}
      </div>
      {recent.length > 0 ? (
        <div className='form-letters'>
          {recent.map((result, index) => (
            <span
              className={clsx(
                result === 'W' && 'w',
                result === 'L' && 'l',
                result === 'D' && 'd',
              )}
              // biome-ignore lint/suspicious/noArrayIndexKey: static ordered letters
              key={index}
            >
              {result}{' '}
            </span>
          ))}
        </div>
      ) : null}
      <div className='note-line'>
        Per game <b>{team.goals_for_avg}</b> scored ·{' '}
        <b>{team.goals_against_avg}</b> conceded
      </div>
      <div className='note-line'>
        <span className='gap'>
          Home{' '}
          <b>
            {team.home_wins}-{team.home_draws}-{team.home_losses}
          </b>
        </span>
        <span>
          Away{' '}
          <b>
            {team.away_wins}-{team.away_draws}-{team.away_losses}
          </b>
        </span>
      </div>
    </div>
  )
}

function AvailabilityPanel({ outlook }: { outlook: Outlook }) {
  const { home, away, injuries } = outlook
  // Nothing to say if neither team reports absences.
  if (injuries.home.length === 0 && injuries.away.length === 0) return null
  return (
    <section className='card'>
      <div className='panel-head'>
        <h3>Team news</h3>
      </div>
      <div className='split-2'>
        <TeamAvailability injuries={injuries.home} name={home.name} />
        <TeamAvailability injuries={injuries.away} name={away.name} />
      </div>
    </section>
  )
}

function TeamAvailability({
  injuries,
  name,
}: {
  injuries: InjuryEntry[]
  name: string
}) {
  return (
    <div>
      <h4 className='small-title'>{name}</h4>
      {injuries.length === 0 ? (
        <p className='hint'>Full squad available.</p>
      ) : (
        <m-vstack gap='2xs'>
          {injuries.map(injury => (
            <div
              className='player-line'
              key={`${injury.player}-${injury.reason}`}
            >
              <span className='who'>{injury.player}</span>
              <span className='hint'> · {injury.reason}</span>
            </div>
          ))}
        </m-vstack>
      )}
    </div>
  )
}

function H2HPanel({ h2h, kickoffAt }: { h2h: H2HResult[]; kickoffAt: number }) {
  // MLS seasons are calendar years, so "this season" = the fixture's
  // kickoff year. Revisit for cross-year seasons (European leagues).
  const seasonYear = new Date(kickoffAt).getFullYear()
  const thisSeason = h2h.filter(
    meeting => new Date(meeting.kickoff_at).getFullYear() === seasonYear,
  )
  if (thisSeason.length === 0)
    return <p className='panel-body meta'>No meetings yet this season.</p>
  return (
    <div>
      {thisSeason.map(meeting => (
        <div
          className='h2h-row'
          key={`${meeting.kickoff_at}-${meeting.home_name}`}
        >
          <time>{h2hDateFormatter.format(meeting.kickoff_at)}</time>
          <span className='match'>
            {meeting.home_name} — {meeting.away_name}
          </span>
          <b>
            {meeting.home_goals ?? '–'}–{meeting.away_goals ?? '–'}
          </b>
        </div>
      ))}
    </div>
  )
}
