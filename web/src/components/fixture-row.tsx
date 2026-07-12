import { CaretRight } from '@phosphor-icons/react'
import { Link } from '@tanstack/react-router'
import type { Fixture } from '@/lib/fixtures'
import { fixtureStatusLabel, teamCrestUrl } from '@/lib/fixtures'

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})

export function FixtureRow({ fixture }: { fixture: Fixture }) {
  return (
    <Link
      className='grid min-h-20 grid-cols-[4.75rem_minmax(0,1fr)_1.25rem] items-center gap-2 border border-border bg-surface px-3 py-3 transition-colors hover:border-foreground sm:grid-cols-[6rem_minmax(0,1fr)_2rem] sm:gap-0 sm:px-4 sm:py-0'
      params={{ fixtureId: String(fixture.id) }}
      to='/fixtures/$fixtureId'
    >
      <div>
        <div className='whitespace-nowrap font-mono text-sm font-semibold tabular-nums'>
          {timeFormatter.format(fixture.kickoff_at)}
        </div>
        <div className='mt-1 text-[.6875rem] text-muted-foreground'>
          {fixtureStatusLabel(fixture.status)}
        </div>
      </div>
      <div className='grid gap-2 sm:grid-cols-[1fr_2rem_1fr] sm:items-center'>
        <Team crestId={fixture.home_team.id} name={fixture.home_team.name} />
        <span className='hidden text-center font-mono text-[.625rem] text-muted-foreground sm:block'>
          VS
        </span>
        <Team
          away
          crestId={fixture.away_team.id}
          name={fixture.away_team.name}
        />
      </div>
      <CaretRight aria-hidden size={16} />
    </Link>
  )
}

function Team({
  away = false,
  crestId,
  name,
}: {
  away?: boolean
  crestId: number
  name: string
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2 text-sm font-semibold ${away ? 'sm:flex-row-reverse sm:justify-start' : ''}`}
    >
      <Crest id={crestId} />
      <span className='min-w-0 truncate'>{name}</span>
    </div>
  )
}

function Crest({ id }: { id: number }) {
  return (
    <span className='grid size-7 shrink-0 place-items-center border border-border bg-muted p-1'>
      <img
        alt=''
        className='max-h-full max-w-full'
        decoding='async'
        height='28'
        loading='lazy'
        src={teamCrestUrl(id)}
        width='28'
      />
    </span>
  )
}
