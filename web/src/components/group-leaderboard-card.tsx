import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { Group } from '@/lib/groups'
import type { LeaderboardEntry } from '@/lib/leaderboards'
import {
  seasonLeaderboardQuery,
  weeklyLeaderboardQuery,
} from '@/lib/leaderboards'
import { cn } from '@/lib/utils'

export function GroupLeaderboardCard({
  group,
  mode,
  userId,
  week,
}: {
  group: Group
  mode: 'season' | 'week'
  userId: number | undefined
  week: string
}) {
  const season = useQuery(seasonLeaderboardQuery(group.id, mode === 'season'))
  const weekly = useQuery(
    weeklyLeaderboardQuery(group.id, week, mode === 'week'),
  )
  const leaderboard = mode === 'week' ? weekly : season

  return (
    <article
      aria-labelledby={`group-${group.id}-heading`}
      className='board-card'
    >
      <header>
        <div className='lead'>
          <h2 className='panel-title' id={`group-${group.id}-heading`}>
            <Link params={{ groupId: String(group.id) }} to='/groups/$groupId'>
              {group.name}
            </Link>
          </h2>
          <p className='hint'>
            {group.member_count}{' '}
            {group.member_count === 1 ? 'member' : 'members'}
          </p>
        </div>
        <Link
          className='manage'
          params={{ groupId: String(group.id) }}
          to='/groups/$groupId'
        >
          Manage <span aria-hidden>→</span>
        </Link>
      </header>

      {leaderboard.isPending ? <RowsSkeleton /> : null}
      {leaderboard.isError ? (
        <div className='centered' role='alert'>
          <p className='form-error'>Standings unavailable.</p>
          <button onClick={() => leaderboard.refetch()} type='button'>
            Retry Standings
          </button>
        </div>
      ) : null}
      {leaderboard.data ? (
        <Summary entries={leaderboard.data} userId={userId} />
      ) : null}
    </article>
  )
}

function Summary({
  entries,
  userId,
}: {
  entries: LeaderboardEntry[]
  userId: number | undefined
}) {
  if (entries.length === 0) {
    return (
      <div className='centered'>
        <p className='panel-title'>No scored predictions yet</p>
        <p className='hint'>
          Standings appear after the first fixture is settled.
        </p>
      </div>
    )
  }

  const leaders = entries.slice(0, 3)
  const current = entries.find(entry => entry.user.id === userId)
  const rows =
    current && !leaders.some(entry => entry.user.id === current.user.id)
      ? [...leaders, current]
      : leaders

  return (
    <table className='board'>
      <colgroup>
        <col className='rank' />
        <col />
        <col className='points' />
      </colgroup>
      <thead>
        <tr>
          <th scope='col'>Rank</th>
          <th scope='col'>Member</th>
          <th scope='col'>Points</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((entry, index) => {
          const isCurrent = entry.user.id === userId
          return (
            <tr
              className={cn(index === 3 && 'appended', isCurrent && 'me')}
              key={entry.user.id}
            >
              <td className='rank'>{entry.rank}</td>
              <th scope='row'>
                <div className='member-name'>
                  {entry.user.display_name ?? entry.user.email}
                  {isCurrent ? <span className='you'>You</span> : null}
                </div>
                {isCurrent ? (
                  <div className='my-detail'>
                    {entry.exact_count} exact · {entry.outcome_count} outcome ·{' '}
                    {entry.played} played
                  </div>
                ) : null}
              </th>
              <td className='points'>{entry.total_points}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function RowsSkeleton() {
  return (
    <div aria-label='Loading standings' className='rows-skeleton' role='status'>
      {[0, 1, 2].map(row => (
        <div aria-hidden key={row} />
      ))}
    </div>
  )
}
