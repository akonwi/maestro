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
      className='flex min-h-64 flex-col border border-border bg-surface'
    >
      <header className='flex items-start justify-between gap-4 border-b border-border p-4'>
        <div className='min-w-0'>
          <h2 className='font-semibold' id={`group-${group.id}-heading`}>
            <Link
              className='hover:underline'
              params={{ groupId: String(group.id) }}
              to='/groups/$groupId'
            >
              {group.name}
            </Link>
          </h2>
          <p className='mt-1 text-xs text-muted-foreground'>
            {group.member_count}{' '}
            {group.member_count === 1 ? 'member' : 'members'}
          </p>
        </div>
        <Link
          className='shrink-0 text-sm text-muted-foreground hover:text-foreground'
          params={{ groupId: String(group.id) }}
          to='/groups/$groupId'
        >
          Manage <span aria-hidden>→</span>
        </Link>
      </header>

      {leaderboard.isPending ? <RowsSkeleton /> : null}
      {leaderboard.isError ? (
        <div
          className='grid flex-1 place-content-center gap-3 p-5 text-center'
          role='alert'
        >
          <p className='text-sm text-danger'>Standings unavailable.</p>
          <button
            className='ui-button mx-auto'
            onClick={() => leaderboard.refetch()}
            type='button'
          >
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
      <div className='grid flex-1 place-content-center p-6 text-center'>
        <p className='font-semibold'>No scored predictions yet</p>
        <p className='mt-1 text-sm text-muted-foreground'>
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
    <table className='w-full table-fixed border-collapse'>
      <thead className='bg-muted font-mono text-[.625rem] font-semibold uppercase tracking-wider text-muted-foreground'>
        <tr>
          <th className='w-12 px-3 py-2 text-left' scope='col'>
            Rank
          </th>
          <th className='px-1 py-2 text-left' scope='col'>
            Member
          </th>
          <th className='w-16 px-3 py-2 text-right' scope='col'>
            Points
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((entry, index) => {
          const isCurrent = entry.user.id === userId
          return (
            <tr
              className={cn(
                index === 3 && 'border-t-2 border-t-border',
                isCurrent && 'bg-accent-muted/40',
              )}
              key={entry.user.id}
            >
              <td
                className={cn(
                  'w-12 border-t border-border px-3 py-3 font-mono text-sm font-semibold',
                  isCurrent && 'border-l-2 border-l-accent',
                )}
              >
                {entry.rank}
              </td>
              <th
                className='min-w-0 border-t border-border px-1 py-3 text-left'
                scope='row'
              >
                <div className='truncate font-semibold'>
                  {entry.user.display_name ?? entry.user.email}
                  {isCurrent ? (
                    <span className='ml-2 text-xs font-normal text-accent'>
                      You
                    </span>
                  ) : null}
                </div>
                {isCurrent ? (
                  <div className='mt-1 truncate font-mono text-[.625rem] font-normal text-muted-foreground'>
                    {entry.exact_count} exact · {entry.outcome_count} outcome ·{' '}
                    {entry.played} played
                  </div>
                ) : null}
              </th>
              <td className='w-16 border-t border-border px-3 py-3 text-right font-mono text-lg font-semibold tabular-nums'>
                {entry.total_points}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function RowsSkeleton() {
  return (
    <div
      aria-label='Loading standings'
      className='grid gap-px bg-border'
      role='status'
    >
      {[0, 1, 2].map(row => (
        <div
          aria-hidden
          className='h-14 animate-pulse bg-muted motion-reduce:animate-none'
          key={row}
        />
      ))}
    </div>
  )
}
