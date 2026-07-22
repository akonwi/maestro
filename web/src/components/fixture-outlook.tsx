import type { UseQueryResult } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type {
  H2HResult,
  InjuryEntry,
  Outlook,
  TeamOutlook,
} from '@/lib/analysis'
import { percentValue } from '@/lib/analysis'
import { cn } from '@/lib/utils'

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
      <div aria-live='polite' className='mt-4' role='status'>
        <span className='sr-only'>Loading match outlook…</span>
        <div
          aria-hidden
          className='h-40 animate-pulse border border-border bg-muted motion-reduce:animate-none'
        />
      </div>
    )
  }
  // No outlook available (e.g. upstream has no data) — show nothing.
  if (query.isError) return null

  const outlook = query.data
  return (
    <div className='mt-4 grid gap-4'>
      <OutlookProbabilities outlook={outlook} />
      <OutlookTabs kickoffAt={kickoffAt} outlook={outlook} />
      <AvailabilityPanel outlook={outlook} />
    </div>
  )
}

function OutlookProbabilities({ outlook }: { outlook: Outlook }) {
  const segments = [
    {
      label: outlook.home.name,
      percent: outlook.percent.home,
      bg: 'bg-foreground text-background',
    },
    {
      label: 'Draw',
      percent: outlook.percent.draw,
      bg: 'bg-muted-foreground text-background',
    },
    {
      label: outlook.away.name,
      percent: outlook.percent.away,
      bg: 'bg-accent text-accent-foreground',
    },
  ]
  return (
    <section
      aria-labelledby='outlook-heading'
      className='border border-border bg-surface'
    >
      <header className='border-b border-border px-4 py-3'>
        <h3 className='font-semibold' id='outlook-heading'>
          Match Outlook
        </h3>
      </header>
      <div className='p-4'>
        <div className='flex h-8 w-full font-mono text-[.625rem] font-bold'>
          {segments.map(segment => (
            <span
              className={cn('grid place-items-center', segment.bg)}
              key={segment.label}
              style={{ width: `${percentValue(segment.percent)}%` }}
            >
              {segment.percent}
            </span>
          ))}
        </div>
        <div className='mt-1.5 grid grid-cols-3 text-[.625rem] text-muted-foreground'>
          <span className='truncate'>{outlook.home.name}</span>
          <span className='text-center'>Draw</span>
          <span className='truncate text-right'>{outlook.away.name}</span>
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
    <section className='border border-border bg-surface'>
      <div
        aria-label='Pre-match analysis'
        className='flex overflow-x-auto border-b border-border'
        role='tablist'
      >
        {OUTLOOK_TABS.map(tab => (
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
        {active === 'Overview' ? <NumbersPanel outlook={outlook} /> : null}
        {active === 'Team form' ? <TeamFormPanel outlook={outlook} /> : null}
        {active === 'Head-to-head' ? (
          <H2HPanel h2h={outlook.h2h} kickoffAt={kickoffAt} />
        ) : null}
      </div>
    </section>
  )
}

type Better = 'home' | 'away' | null

function betterSide(home: number, away: number, dir: 'high' | 'low'): Better {
  if (home === away) return null
  const homeWins = dir === 'high' ? home > away : home < away
  return homeWins ? 'home' : 'away'
}

// The concrete "By the numbers" comparison. Each row shows both teams'
// value with the stronger side subtly emphasized.
function NumbersPanel({ outlook }: { outlook: Outlook }) {
  const { home, away, standings } = outlook
  const homePoints = standings.home?.points ?? null
  const awayPoints = standings.away?.points ?? null

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
      label: 'Goals for',
      home: `${home.goals_for_avg} (${home.goals_for_total})`,
      away: `${away.goals_for_avg} (${away.goals_for_total})`,
      better: betterSide(
        Number.parseFloat(home.goals_for_avg),
        Number.parseFloat(away.goals_for_avg),
        'high',
      ),
    },
    {
      label: 'Goals against',
      home: `${home.goals_against_avg} (${home.goals_against_total})`,
      away: `${away.goals_against_avg} (${away.goals_against_total})`,
      better: betterSide(
        Number.parseFloat(home.goals_against_avg),
        Number.parseFloat(away.goals_against_avg),
        'low',
      ),
    },
    {
      label: 'Clean sheets',
      home: String(home.clean_sheets),
      away: String(away.clean_sheets),
      better: betterSide(home.clean_sheets, away.clean_sheets, 'high'),
    },
  ]

  return (
    <table className='w-full text-xs'>
      <caption className='sr-only'>
        {home.name} versus {away.name} by the numbers
      </caption>
      <thead>
        <tr className='border-b border-border'>
          <th className='px-4 py-2 text-left font-semibold' scope='col'>
            {home.name}
          </th>
          <th className='px-2 py-2 text-center font-medium text-[.625rem] uppercase tracking-wider text-muted-foreground'>
            {''}
          </th>
          <th className='px-4 py-2 text-right font-semibold' scope='col'>
            {away.name}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr
            className='border-b border-border last:border-b-0'
            key={row.label}
          >
            <td
              className={cn(
                'px-4 py-2.5 text-left font-mono tabular-nums',
                row.better === 'home'
                  ? 'font-bold text-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {row.home}
            </td>
            <th
              className='px-2 py-2.5 text-center font-medium text-[.625rem] uppercase tracking-wider text-muted-foreground'
              scope='row'
            >
              {row.label}
            </th>
            <td
              className={cn(
                'px-4 py-2.5 text-right font-mono tabular-nums',
                row.better === 'away'
                  ? 'font-bold text-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {row.away}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
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
    <div className={cn(withDivider && 'border-t border-border')}>
      <header className='flex items-center justify-between border-b border-border px-4 py-3'>
        <h4 className='font-semibold'>{team.name}</h4>
        {recent.length > 0 ? (
          <span className='font-mono text-[.5625rem] font-semibold uppercase tracking-wider text-muted-foreground'>
            Last {recent.length}
          </span>
        ) : null}
      </header>
      {recent.length > 0 ? (
        <div className='px-4 py-3 font-mono text-xs font-semibold tracking-[.2em]'>
          {recent.map((result, index) => (
            <span
              className={cn(
                result === 'W' && 'text-success',
                result === 'L' && 'text-danger',
                result === 'D' && 'text-muted-foreground',
              )}
              // biome-ignore lint/suspicious/noArrayIndexKey: static ordered letters
              key={index}
            >
              {result}{' '}
            </span>
          ))}
        </div>
      ) : null}
      <div className='px-4 pb-3 text-xs text-muted-foreground'>
        Per game{' '}
        <b className='font-mono text-foreground'>{team.goals_for_avg}</b> scored
        · <b className='font-mono text-foreground'>{team.goals_against_avg}</b>{' '}
        conceded
      </div>
      <div className='px-4 pb-3 text-xs text-muted-foreground'>
        <span className='mr-3'>
          Home{' '}
          <b className='font-mono text-foreground'>
            {team.home_wins}-{team.home_draws}-{team.home_losses}
          </b>
        </span>
        <span>
          Away{' '}
          <b className='font-mono text-foreground'>
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
    <section className='border border-border bg-surface'>
      <header className='border-b border-border px-4 py-3'>
        <h3 className='font-semibold'>Team news</h3>
      </header>
      <div className='grid grid-cols-2'>
        <TeamAvailability injuries={injuries.home} name={home.name} />
        <TeamAvailability away injuries={injuries.away} name={away.name} />
      </div>
    </section>
  )
}

function TeamAvailability({
  away = false,
  injuries,
  name,
}: {
  away?: boolean
  injuries: InjuryEntry[]
  name: string
}) {
  return (
    <div className={cn('px-4 py-3', away && 'border-l border-border')}>
      <h4 className='mb-2 text-[.6875rem] font-semibold'>{name}</h4>
      {injuries.length === 0 ? (
        <p className='text-xs text-muted-foreground'>Full squad available.</p>
      ) : (
        <ul className='grid gap-1.5'>
          {injuries.map(injury => (
            <li className='text-xs' key={`${injury.player}-${injury.reason}`}>
              <span className='font-medium'>{injury.player}</span>
              <span className='text-muted-foreground'> · {injury.reason}</span>
            </li>
          ))}
        </ul>
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
    return (
      <p className='p-4 text-sm text-muted-foreground'>
        No meetings yet this season.
      </p>
    )
  return (
    <div>
      {thisSeason.map(meeting => (
        <div
          className='grid grid-cols-[4rem_1fr_auto] items-center gap-3 border-b border-border px-4 py-3 text-xs last:border-b-0'
          key={`${meeting.kickoff_at}-${meeting.home_name}`}
        >
          <time className='font-mono text-[.625rem] text-muted-foreground'>
            {h2hDateFormatter.format(meeting.kickoff_at)}
          </time>
          <span className='truncate'>
            {meeting.home_name} — {meeting.away_name}
          </span>
          <b className='font-mono text-[.8125rem] tabular-nums'>
            {meeting.home_goals ?? '–'}–{meeting.away_goals ?? '–'}
          </b>
        </div>
      ))}
    </div>
  )
}
