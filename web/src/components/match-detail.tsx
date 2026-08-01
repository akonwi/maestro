import type { UseQueryResult } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { useId, useState } from 'react'
import type {
  Lineup,
  LineupPlayer,
  MatchDetail,
  MatchEvent,
  StatLine,
  TeamPlayers,
} from '@/lib/analysis'
import { statLabel } from '@/lib/analysis'

/** Live/finished analysis: stats, events, lineups, and player ratings. */
export function MatchDetailPanel({
  query,
}: {
  query: UseQueryResult<MatchDetail, Error>
}) {
  if (query.isPending) {
    return (
      <div aria-live='polite' role='status'>
        <span className='sr-only'>Loading match detail…</span>
        <div aria-hidden className='skeleton' />
      </div>
    )
  }
  if (query.isError) return null

  const detail = query.data
  const empty =
    detail.statistics.length === 0 &&
    detail.events.length === 0 &&
    detail.lineups.length === 0 &&
    detail.players.length === 0
  if (empty) return null

  return <MatchTabs detail={detail} />
}

const MATCH_TABS = ['Stats', 'Events', 'Lineups', 'Players'] as const

function MatchTabs({ detail }: { detail: MatchDetail }) {
  const [active, setActive] = useState<(typeof MATCH_TABS)[number]>('Stats')
  const baseId = useId()

  return (
    <section className='card'>
      <m-tabs>
        <nav aria-label='Match detail' className='tab-rail' role='tablist'>
          {MATCH_TABS.map(tab => (
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
          {active === 'Stats' ? (
            <StatsPanel statistics={detail.statistics} />
          ) : null}
          {active === 'Events' ? <EventsPanel detail={detail} /> : null}
          {active === 'Lineups' ? (
            <LineupsPanel lineups={detail.lineups} />
          ) : null}
          {active === 'Players' ? (
            <PlayersPanel teams={detail.players} />
          ) : null}
        </section>
      </m-tabs>
    </section>
  )
}

// ─── Stats ───────────────────────────────────────────────────────────────

function StatsPanel({ statistics }: { statistics: MatchDetail['statistics'] }) {
  if (statistics.length < 2)
    return <EmptyPanel message='No match statistics yet.' />
  const [home, away] = statistics
  const awayByLabel = new Map(away.stats.map(line => [line.label, line]))

  return (
    <div>
      {home.stats.map(line => (
        <StatRow
          away={awayByLabel.get(line.label) ?? null}
          home={line}
          key={line.label}
        />
      ))}
    </div>
  )
}

function StatRow({ home, away }: { home: StatLine; away: StatLine | null }) {
  const homeValue = parseStat(home.value)
  const awayValue = parseStat(away?.value ?? null)
  const total = homeValue + awayValue
  const homeShare = total > 0 ? (homeValue / total) * 100 : 0
  const awayShare = total > 0 ? (awayValue / total) * 100 : 0

  return (
    <div className='stat-row'>
      <div className='vals'>
        <span>{home.value ?? '0'}</span>
        <span className='label'>{statLabel(home.label)}</span>
        <span>{away?.value ?? '0'}</span>
      </div>
      <div className='twobar'>
        <i className='home' style={{ width: `${homeShare}%` }} />
        <i className='away' style={{ width: `${awayShare}%` }} />
      </div>
    </div>
  )
}

function parseStat(value: string | null) {
  if (value === null) return 0
  const parsed = Number.parseFloat(value.replace('%', ''))
  return Number.isNaN(parsed) ? 0 : Math.max(0, parsed)
}

// ─── Events ──────────────────────────────────────────────────────────────

function EventsPanel({ detail }: { detail: MatchDetail }) {
  if (detail.events.length === 0)
    return <EmptyPanel message='No match events yet.' />
  const latestFirst = [...detail.events].reverse()
  return (
    <div>
      {latestFirst.map((event, index) => (
        <EventRow
          event={event}
          // biome-ignore lint/suspicious/noArrayIndexKey: events have no stable id
          key={index}
        />
      ))}
    </div>
  )
}

function EventRow({ event }: { event: MatchEvent }) {
  return (
    <div className='event-row'>
      <time>
        {event.minute}
        {event.extra ? `+${event.extra}` : ''}′
      </time>
      <span aria-hidden className='icon'>
        {eventIcon(event)}
      </span>
      <div className='what'>
        <strong>{eventHeadline(event)}</strong>
        <small>{eventDetail(event)}</small>
      </div>
    </div>
  )
}

function eventIcon(event: MatchEvent) {
  if (event.kind === 'Goal') return '⚽'
  if (event.kind === 'Card') return event.detail.startsWith('Red') ? '🟥' : '🟨'
  if (event.kind.toLowerCase() === 'subst') return '↔'
  return 'ⓥ'
}

function eventHeadline(event: MatchEvent) {
  if (event.kind.toLowerCase() === 'subst' && event.assist)
    return `${event.assist} for ${event.player ?? '—'}`
  return event.player ?? event.detail
}

function eventDetail(event: MatchEvent) {
  const parts: string[] = []
  if (event.kind.toLowerCase() === 'subst') {
    parts.push('Substitution')
  } else {
    parts.push(event.detail)
    if (event.kind === 'Goal' && event.assist)
      parts.push(`assist ${event.assist}`)
  }
  if (event.comments) parts.push(event.comments)
  return parts.join(' · ')
}

// ─── Lineups ─────────────────────────────────────────────────────────────

/**
 * Standalone lineups card for the pre-match view, shown once confirmed
 * XIs are published (~20–60 min before kickoff). Renders nothing until
 * both lineups are available.
 */
export function PreMatchLineups({ lineups }: { lineups: Lineup[] }) {
  if (lineups.length < 2) return null
  return (
    <section className='card'>
      <div className='panel-head'>
        <h2 className='panel-title'>Lineups</h2>
      </div>
      <LineupsPanel lineups={lineups} />
    </section>
  )
}

function LineupsPanel({ lineups }: { lineups: Lineup[] }) {
  if (lineups.length < 2) return <EmptyPanel message='No lineups yet.' />
  const [home, away] = lineups

  return (
    <div>
      <div className='lineup-grid head'>
        <TeamLineupMeta lineup={home} />
        <TeamLineupMeta lineup={away} />
      </div>
      <Pitch away={away} home={home} />
      <div className='lineup-grid foot'>
        <BenchList lineup={home} />
        <BenchList lineup={away} />
      </div>
    </div>
  )
}

function TeamLineupMeta({ lineup }: { lineup: Lineup }) {
  return (
    <div className='lineup-team'>
      <strong>{lineup.team_name}</strong>
      <div className='formation'>{lineup.formation}</div>
      <small>Coach · {lineup.coach}</small>
    </div>
  )
}

type GridPosition = { row: number; col: number }

function parseGrid(grid: string | null): GridPosition | null {
  if (!grid) return null
  const [row, col] = grid.split(':').map(Number)
  if (!Number.isInteger(row) || !Number.isInteger(col)) return null
  return { row, col }
}

/** Starters grouped into formation lines (row 1 = GK). */
function formationLines(lineup: Lineup) {
  const lines = new Map<number, (LineupPlayer & GridPosition)[]>()
  for (const player of lineup.starters) {
    const position = parseGrid(player.grid)
    if (!position) continue
    const line = lines.get(position.row)
    const entry = { ...player, ...position }
    if (line) line.push(entry)
    else lines.set(position.row, [entry])
  }
  return [...lines.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, players]) => players.sort((a, b) => a.col - b.col))
}

/**
 * Responsive pitch: vertical on mobile (away attacks down from the top,
 * home attacks up from the bottom), horizontal on md+ (home attacks
 * left-to-right). Direction flips live in app.css (.pitch-half/.pitch-line).
 */
function Pitch({ home, away }: { home: Lineup; away: Lineup }) {
  return (
    <div className='pitch'>
      <div aria-hidden className='halfway' />
      <div aria-hidden className='circle' />
      <PitchHalf away lineup={away} />
      <PitchHalf lineup={home} />
    </div>
  )
}

function PitchHalf({
  away = false,
  lineup,
}: {
  away?: boolean
  lineup: Lineup
}) {
  const lines = formationLines(lineup)
  return (
    <div className={clsx('pitch-half', away ? 'away' : 'home')}>
      {lines.map(players => (
        <div className='pitch-line' key={players[0]?.grid ?? 'line'}>
          {players.map(player => (
            <PitchPlayer key={player.number} lineup={lineup} player={player} />
          ))}
        </div>
      ))}
    </div>
  )
}

function PitchPlayer({
  lineup,
  player,
}: {
  lineup: Lineup
  player: LineupPlayer
}) {
  const kit = lineup.color_primary ? `#${lineup.color_primary}` : undefined
  const number = lineup.color_number ? `#${lineup.color_number}` : undefined
  return (
    <div className='pitch-player'>
      <span
        className='kit'
        style={
          kit ? { backgroundColor: kit, color: number ?? '#fff' } : undefined
        }
      >
        {player.number}
      </span>
      <span className='name'>{player.name}</span>
    </div>
  )
}

function BenchList({ lineup }: { lineup: Lineup }) {
  return (
    <div>
      <h4 className='small-title'>{lineup.team_name} bench</h4>
      <ul className='bench-list'>
        {lineup.bench.map(player => (
          <li key={`${player.number}-${player.name}`}>
            <b>{player.number}</b>
            {player.name}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Players ─────────────────────────────────────────────────────────────

function PlayersPanel({ teams }: { teams: TeamPlayers[] }) {
  if (teams.length === 0) return <EmptyPanel message='No player data yet.' />
  return (
    <div>
      {teams.map((team, index) => (
        <div key={team.team_id}>
          <header className={clsx('team-strip', index > 0 && 'subsequent')}>
            {team.team_name}
          </header>
          {rankedPlayers(team).map(player => (
            <PlayerRow key={player.id} player={player} />
          ))}
        </div>
      ))}
    </div>
  )
}

function rankedPlayers(team: TeamPlayers) {
  return team.players
    .filter(player => (player.minutes ?? 0) > 0)
    .sort(
      (a, b) =>
        Number.parseFloat(b.rating ?? '0') - Number.parseFloat(a.rating ?? '0'),
    )
}

function PlayerRow({ player }: { player: TeamPlayers['players'][number] }) {
  return (
    <div className='rated-row'>
      <b>{player.rating ?? '–'}</b>
      <span className='summary'>
        {player.name}
        <span>
          {' '}
          · {player.minutes ?? 0} min{playerScoreline(player)}
        </span>
      </span>
      <span className='aside'>{playerHighlight(player)}</span>
    </div>
  )
}

function playerScoreline(player: TeamPlayers['players'][number]) {
  const parts: string[] = []
  if (player.goals) parts.push(`${player.goals}G`)
  if (player.assists) parts.push(`${player.assists}A`)
  return parts.length > 0 ? ` · ${parts.join(' ')}` : ''
}

function playerHighlight(player: TeamPlayers['players'][number]) {
  if (player.saves) return `${player.saves} saves`
  if (player.key_passes) return `${player.key_passes} key passes`
  if (player.shots) return `${player.shots} shots`
  if (player.duels_won) return `${player.duels_won} duels won`
  if (player.passes) return `${player.passes} passes`
  return ''
}

function EmptyPanel({ message }: { message: string }) {
  return <p className='panel-body meta'>{message}</p>
}
