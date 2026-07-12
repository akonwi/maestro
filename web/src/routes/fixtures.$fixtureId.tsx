import { ArrowLeft } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { getFixture, teamCrestUrl } from '@/lib/fixtures'

export const Route = createFileRoute('/fixtures/$fixtureId')({
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
  const fixture = useQuery({
    queryKey: ['fixtures', id],
    queryFn: () => getFixture(id),
    enabled: Number.isInteger(id),
  })

  return (
    <main className='mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14'>
      <Link
        className='mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground'
        to='/'
      >
        <ArrowLeft aria-hidden size={16} /> Upcoming fixtures
      </Link>

      {fixture.isPending ? (
        <div className='h-72 animate-pulse border border-border bg-muted' />
      ) : null}
      {fixture.isError ? (
        <div className='border border-danger bg-danger-muted p-4 text-danger'>
          {fixture.error.message}
        </div>
      ) : null}
      {fixture.data ? <FixtureDetail fixture={fixture.data} /> : null}
    </main>
  )
}

function FixtureDetail({
  fixture,
}: {
  fixture: Awaited<ReturnType<typeof getFixture>>
}) {
  return (
    <article className='border border-border bg-surface'>
      <header className='border-b border-border p-5 text-center'>
        <div className='section-kicker'>{fixture.status}</div>
        <p className='mt-2 text-sm text-muted-foreground'>
          {kickoffFormatter.format(fixture.kickoff_at)}
        </p>
      </header>
      <div className='grid grid-cols-[1fr_3rem_1fr] items-center gap-3 p-6 sm:p-12'>
        <Team id={fixture.home_team.id} name={fixture.home_team.name} />
        <div className='text-center font-mono text-xs text-muted-foreground'>
          VS
        </div>
        <Team away id={fixture.away_team.id} name={fixture.away_team.name} />
      </div>
      <footer className='border-t border-border bg-muted p-5 text-center text-sm text-muted-foreground'>
        Predictions open until kickoff.
      </footer>
    </article>
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
      className={`flex min-w-0 flex-col items-center gap-4 ${away ? 'text-right' : 'text-left'}`}
    >
      <span className='grid size-16 place-items-center border border-border bg-muted p-2 sm:size-20'>
        <img
          alt={`${name} crest`}
          className='max-h-full max-w-full'
          src={teamCrestUrl(id)}
        />
      </span>
      <h1 className='text-center text-lg font-semibold sm:text-xl'>{name}</h1>
    </div>
  )
}
