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
  competitionId?: number,
) {
  const token = getSessionToken()
  if (!token) throw new Error('Sign in to view standings.')
  const params = new URLSearchParams()
  if (period === 'week' && week) params.set('week', week)
  if (competitionId !== undefined)
    params.set('competition_id', String(competitionId))
  const query = params.size > 0 ? `?${params}` : ''
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

export function seasonLeaderboardQuery(
  groupId: number,
  enabled: boolean,
  competitionId?: number,
) {
  return queryOptions({
    queryKey: [
      'groups',
      groupId,
      'leaderboard',
      'season',
      competitionId ?? 'all',
    ],
    queryFn: () => getLeaderboard(groupId, 'season', undefined, competitionId),
    enabled,
  })
}

export function weeklyLeaderboardQuery(
  groupId: number,
  week: string,
  enabled: boolean,
  competitionId?: number,
) {
  return queryOptions({
    queryKey: [
      'groups',
      groupId,
      'leaderboard',
      'week',
      week,
      competitionId ?? 'all',
    ],
    queryFn: () => getLeaderboard(groupId, 'week', week, competitionId),
    enabled,
  })
}
