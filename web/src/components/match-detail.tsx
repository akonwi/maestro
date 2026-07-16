import type { UseQueryResult } from '@tanstack/react-query'
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
import { cn } from '@/lib/utils'

/** Live/finished analysis: stats, events, lineups, and player ratings. */
export function MatchDetailPanel({
  query,
}: {
  query: UseQueryResult<MatchDetail, Error>
}) {
  if (query.isPending) {
    return (
      <div aria-live='polite' className='mt-4' role='status'>
        <span className='sr-only'>Loading match detail…</span>
        <div
          aria-hidden
          className='h-56 animate-pulse border border-border bg-muted motion-reduce:animate-none'
        />
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
    <section className='mt-4 border border-border bg-surface'>
      <div
        aria-label='Match detail'
        className='flex overflow-x-auto border-b border-border'
        role='tablist'
      >
        {MATCH_TABS.map(tab => (
          <button
            aria-controls={`${baseId}-${tab}`}
            aria-selected={active === tab}
            className={cn(
              'whitespace-nowrap border-r border-border px-4 py-3 text-xs font-bold',
              active === tab
                ? 'text-accent shadow-[inset_0_-2px_var(--color-accent)]'
                : 'text-muted-foreground',
            )}
            key={tab}
            onClick={() => setActive(tab)}
            role='tab'
            type='button'
          >
            {tab}
          </button>
        ))}
      </div>
      <div id={`${baseId}-${active}`} role='tabpanel'>
        {active === 'Stats' ? (
          <StatsPanel statistics={detail.statistics} />
        ) : null}
        {active === 'Events' ? <EventsPanel detail={detail} /> : null}
        {active === 'Lineups' ? (
          <LineupsPanel lineups={detail.lineups} />
        ) : null}
        {active === 'Players' ? <PlayersPanel teams={detail.players} /> : null}
      </div>
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
    <div className='border-b border-border px-4 py-2.5 last:border-b-0'>
      <div className='flex items-baseline justify-between font-mono text-xs font-bold tabular-nums'>
        <span>{home.value ?? '0'}</span>
        <span className='font-sans text-[.625rem] font-medium text-muted-foreground'>
          {statLabel(home.label)}
        </span>
        <span>{away?.value ?? '0'}</span>
      </div>
      <div className='mt-1.5 flex h-1 justify-between bg-border'>
        <i className='bg-foreground' style={{ width: `${homeShare}%` }} />
        <i className='bg-accent' style={{ width: `${awayShare}%` }} />
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
    <div className='grid grid-cols-[2.75rem_1.5rem_1fr] items-center gap-2.5 border-b border-border px-4 py-3 text-xs last:border-b-0'>
      <time className='font-mono text-[.625rem] font-semibold text-muted-foreground'>
        {event.minute}
        {event.extra ? `+${event.extra}` : ''}′
      </time>
      <span aria-hidden className='text-sm'>
        {eventIcon(event)}
      </span>
      <div className='min-w-0'>
        <strong className='block truncate'>{eventHeadline(event)}</strong>
        <small className='text-muted-foreground'>{eventDetail(event)}</small>
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

function LineupsPanel({ lineups }: { lineups: Lineup[] }) {
  if (lineups.length < 2) return <EmptyPanel message='No lineups yet.' />
  const [home, away] = lineups

  return (
    <div>
      <div className='grid grid-cols-2 border-b border-border'>
        <TeamLineupMeta lineup={home} />
        <TeamLineupMeta away lineup={away} />
      </div>
      <Pitch away={away} home={home} />
      <div className='grid grid-cols-2 border-t border-border'>
        <BenchList lineup={home} />
        <BenchList away lineup={away} />
      </div>
    </div>
  )
}

function TeamLineupMeta({
  away = false,
  lineup,
}: {
  away?: boolean
  lineup: Lineup
}) {
  return (
    <div
      className={cn('px-4 py-3', away && 'border-l border-border text-right')}
    >
      <strong className='block text-xs'>{lineup.team_name}</strong>
      <div className='mt-0.5 font-mono text-base font-bold'>
        {lineup.formation}
      </div>
      <small className='mt-0.5 block text-muted-foreground'>
        Coach · {lineup.coach}
      </small>
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
 * left-to-right).
 */
function Pitch({ home, away }: { home: Lineup; away: Lineup }) {
  return (
    <div className='relative m-3 flex h-[37.5rem] flex-col border border-border bg-muted md:h-[27rem] md:flex-row'>
      {/* halfway line */}
      <div
        aria-hidden
        className='absolute inset-x-0 top-1/2 border-t border-border md:inset-x-auto md:inset-y-0 md:left-1/2 md:border-l md:border-t-0'
      />
      <div
        aria-hidden
        className='absolute left-1/2 top-1/2 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border'
      />
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
    <div
      className={cn(
        'z-[1] flex flex-1 p-1.5',
        // Vertical: away on top reading GK→attack downward; home on the
        // bottom reading attack→GK downward (GK nearest own goal).
        // Horizontal: home reads GK→attack left-to-right; away mirrored.
        away ? 'flex-col md:flex-row-reverse' : 'flex-col-reverse md:flex-row',
      )}
    >
      {lines.map(players => (
        <div
          className={cn(
            'flex flex-1 items-center justify-around',
            away
              ? 'flex-row-reverse md:flex-col-reverse'
              : 'flex-row md:flex-col',
          )}
          key={players[0]?.grid ?? 'line'}
        >
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
    <div className='w-14 text-center'>
      <span
        className='mx-auto mb-0.5 grid h-6 w-7 place-items-center border border-border bg-foreground font-mono text-[.625rem] font-bold text-background'
        style={
          kit ? { backgroundColor: kit, color: number ?? '#fff' } : undefined
        }
      >
        {player.number}
      </span>
      <span className='block truncate text-[.5625rem] font-semibold'>
        {player.name}
      </span>
    </div>
  )
}

function BenchList({
  away = false,
  lineup,
}: {
  away?: boolean
  lineup: Lineup
}) {
  return (
    <div className={cn('px-4 py-3', away && 'border-l border-border')}>
      <h4 className='mb-2 text-[.6875rem] font-semibold'>
        {lineup.team_name} bench
      </h4>
      <ul className='grid gap-1'>
        {lineup.bench.map(player => (
          <li
            className='text-[.625rem] text-muted-foreground'
            key={`${player.number}-${player.name}`}
          >
            <b className='mr-1.5 font-mono text-foreground'>{player.number}</b>
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
          <header
            className={cn(
              'border-b border-border bg-muted px-4 py-2 text-[.6875rem] font-semibold',
              index > 0 && 'border-t',
            )}
          >
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
    <div className='grid grid-cols-[2.5rem_1fr_auto] items-center gap-2.5 border-b border-border px-4 py-2.5 text-xs last:border-b-0'>
      <b className='font-mono tabular-nums'>{player.rating ?? '–'}</b>
      <span className='min-w-0 truncate'>
        {player.name}
        <span className='text-muted-foreground'>
          {' '}
          · {player.minutes ?? 0} min{playerScoreline(player)}
        </span>
      </span>
      <span className='font-mono text-[.625rem] text-muted-foreground'>
        {playerHighlight(player)}
      </span>
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
  return <p className='p-4 text-sm text-muted-foreground'>{message}</p>
}
