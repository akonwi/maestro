import type { UseQueryResult } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { H2HResult, Outlook, TeamOutlook } from '@/lib/analysis'
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
        {active === 'Overview' ? <ComparisonPanel outlook={outlook} /> : null}
        {active === 'Team form' ? <TeamFormPanel outlook={outlook} /> : null}
        {active === 'Head-to-head' ? (
          <H2HPanel h2h={outlook.h2h} kickoffAt={kickoffAt} />
        ) : null}
      </div>
    </section>
  )
}

function ComparisonPanel({ outlook }: { outlook: Outlook }) {
  return (
    <div className='px-4 py-2'>
      {outlook.comparison.map(axis => {
        const home = percentValue(axis.home)
        const away = percentValue(axis.away)
        return (
          <div className='my-3' key={axis.label}>
            <div className='text-center text-[.625rem] font-semibold text-muted-foreground'>
              {axis.label}
            </div>
            <div className='mt-1 grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 font-mono text-[.6875rem] font-semibold tabular-nums'>
              <span>{axis.home}</span>
              <div className='flex h-1.5 justify-between bg-border'>
                <i className='bg-foreground' style={{ width: `${home}%` }} />
                <i className='bg-accent' style={{ width: `${away}%` }} />
              </div>
              <span className='text-right'>{axis.away}</span>
            </div>
          </div>
        )
      })}
    </div>
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
        <span className='font-mono text-[.5625rem] font-semibold uppercase tracking-wider text-muted-foreground'>
          Last {recent.length}
        </span>
      </header>
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
      <div className='px-4 pb-3 text-xs text-muted-foreground'>
        Per game{' '}
        <b className='font-mono text-foreground'>{team.goals_for_avg}</b> scored
        · <b className='font-mono text-foreground'>{team.goals_against_avg}</b>{' '}
        conceded
      </div>
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
