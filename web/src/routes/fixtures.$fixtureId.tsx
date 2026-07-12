import { ArrowLeft } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import type { Fixture } from '@/lib/fixtures'
import { fixtureQuery, fixtureStatusLabel, teamCrestUrl } from '@/lib/fixtures'

export const Route = createFileRoute('/fixtures/$fixtureId')({
  loader: ({ context, params }) => {
    const id = Number(params.fixtureId)
    if (!Number.isInteger(id) || id <= 0) throw notFound()
    return context.queryClient.ensureQueryData(fixtureQuery(id))
  },
  pendingComponent: FixtureSkeleton,
  errorComponent: FixtureRouteError,
  notFoundComponent: InvalidFixture,
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
  const fixture = useQuery(fixtureQuery(id))

  return (
    <main
      className='mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14'
      id='main-content'
    >
      <Link
        className='mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground'
        to='/'
      >
        <ArrowLeft aria-hidden size={16} /> Upcoming fixtures
      </Link>

      {fixture.isPending ? <FixtureSkeleton /> : null}
      {fixture.isError ? (
        <div
          className='border border-danger bg-danger-muted p-4 text-danger'
          role='alert'
        >
          Fixture unavailable. Return to fixtures and try again.
        </div>
      ) : null}
      {fixture.data ? <FixtureDetail fixture={fixture.data} /> : null}
    </main>
  )
}

function FixtureSkeleton() {
  return (
    <div aria-live='polite' role='status'>
      <span className='sr-only'>Loading fixture…</span>
      <div
        aria-hidden
        className='h-72 animate-pulse border border-border bg-muted motion-reduce:animate-none'
      />
    </div>
  )
}

function FixtureRouteError({ reset }: { reset: () => void }) {
  return (
    <main className='mx-auto w-full max-w-4xl px-4 py-14' id='main-content'>
      <div
        className='border border-danger bg-danger-muted p-5 text-danger'
        role='alert'
      >
        <h1 className='font-semibold'>Fixture unavailable</h1>
        <p className='mt-2 text-sm'>Check your connection and try again.</p>
        <button className='ui-button mt-4' onClick={reset} type='button'>
          Retry fixture
        </button>
      </div>
    </main>
  )
}

function InvalidFixture() {
  return (
    <main className='mx-auto w-full max-w-4xl px-4 py-14' id='main-content'>
      <div
        className='border border-danger bg-danger-muted p-5 text-danger'
        role='alert'
      >
        <h1 className='font-semibold'>Invalid fixture</h1>
        <p className='mt-2 text-sm'>
          Choose a fixture from the upcoming schedule.
        </p>
        <Link className='ui-button mt-4 inline-flex items-center' to='/'>
          View upcoming fixtures
        </Link>
      </div>
    </main>
  )
}

function FixtureDetail({ fixture }: { fixture: Fixture }) {
  return (
    <article className='border border-border bg-surface'>
      <header className='border-b border-border p-5 text-center'>
        <h1 className='sr-only'>
          {fixture.home_team.name} vs {fixture.away_team.name}
        </h1>
        <div className='section-kicker'>
          {fixtureStatusLabel(fixture.status)}
        </div>
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
          decoding='async'
          height='80'
          src={teamCrestUrl(id)}
          width='80'
        />
      </span>
      <h2 className='text-center text-lg font-semibold sm:text-xl'>{name}</h2>
    </div>
  )
}
