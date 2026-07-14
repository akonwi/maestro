import { queryOptions } from '@tanstack/react-query'
import { getSessionToken } from '@/lib/session'

export type LeaderboardEntry = {
  rank: number
  user: {
    id: number
    email: string
    display_name: string | null
  }
  total_points: number
  exact_count: number
  outcome_count: number
  played: number
}

async function getLeaderboard(
  groupId: number,
  period: 'season' | 'week',
  week?: string,
) {
  const token = getSessionToken()
  if (!token) throw new Error('Sign in to view standings.')
  const query =
    period === 'week' && week ? `?week=${encodeURIComponent(week)}` : ''
  const response = await fetch(
    `/api/groups/${groupId}/leaderboard/${period}${query}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  )
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string
    } | null
    throw new Error(
      payload?.error ?? `Request failed with status ${response.status}`,
    )
  }
  return response.json() as Promise<LeaderboardEntry[]>
}

export function seasonLeaderboardQuery(groupId: number, enabled: boolean) {
  return queryOptions({
    queryKey: ['groups', groupId, 'leaderboard', 'season'],
    queryFn: () => getLeaderboard(groupId, 'season'),
    enabled,
  })
}

export function weeklyLeaderboardQuery(
  groupId: number,
  week: string,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: ['groups', groupId, 'leaderboard', 'week', week],
    queryFn: () => getLeaderboard(groupId, 'week', week),
    enabled,
  })
}
