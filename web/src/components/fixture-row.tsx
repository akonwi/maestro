import { CaretRight } from '@phosphor-icons/react'
import { Link } from '@tanstack/react-router'
import type { Competition, Fixture } from '@/lib/fixtures'
import {
  competitionCode,
  fixtureStatusLabel,
  leagueLogoUrl,
  teamCrestUrl,
} from '@/lib/fixtures'

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})

export function FixtureRow({
  fixture,
  league,
}: {
  fixture: Fixture
  /** Shown in the time rail on cross-league lists; omit when scoped. */
  league?: Competition
}) {
  const hasScore = fixture.home_score !== null && fixture.away_score !== null
  return (
    <Link
      className='fixture-row'
      params={{ fixtureId: String(fixture.id) }}
      search={{ group: undefined }}
      to='/fixtures/$fixtureId'
    >
      <div>
        <div className='kickoff'>
          {timeFormatter.format(fixture.kickoff_at)}
        </div>
        {fixture.status === 'NS' ? null : (
          <div className='status'>{fixtureStatusLabel(fixture.status)}</div>
        )}
        {league ? (
          <div className='league-tag'>
            <img
              alt=''
              decoding='async'
              height='13'
              loading='lazy'
              src={leagueLogoUrl(league.api_football_league_id)}
              width='13'
            />
            <span>{competitionCode(league.name)}</span>
            <span data-visually-hidden>{league.name}</span>
          </div>
        ) : null}
      </div>
      <div className='teams'>
        <Team crestId={fixture.home_team.id} name={fixture.home_team.name} />
        {hasScore ? (
          <span className='score'>
            {fixture.home_score}–{fixture.away_score}
          </span>
        ) : (
          <span className='vs'>VS</span>
        )}
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
    <div className={away ? 'fixture-team away' : 'fixture-team'}>
      <Crest id={crestId} />
      <span className='name'>{name}</span>
    </div>
  )
}

function Crest({ id }: { id: number }) {
  return (
    <span className='crest'>
      <img
        alt=''
        decoding='async'
        height='28'
        loading='lazy'
        src={teamCrestUrl(id)}
        width='28'
      />
    </span>
  )
}
