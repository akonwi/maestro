import { queryOptions } from '@tanstack/react-query'
import { getSessionToken } from '@/lib/session'

export type Prediction = {
  id: number
  user_id: number
  fixture_id: number
  home_score: number
  away_score: number
  points: number | null
  created_at: number
  updated_at: number
}

export type GroupPrediction = {
  user: {
    id: number
    email: string
    display_name: string | null
  }
  home_score: number
  away_score: number
  points: number | null
  updated_at: number
}

async function predictionRequest<T>(
  path: string,
  options: { method?: 'GET' | 'PUT'; body?: unknown; notFoundValue?: T } = {},
): Promise<T> {
  const token = getSessionToken()
  if (!token) throw new Error('Sign in to manage predictions.')

  const response = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body === undefined
        ? {}
        : { 'Content-Type': 'application/json' }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  if (response.status === 404 && 'notFoundValue' in options)
    return options.notFoundValue as T
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string
    } | null
    throw new Error(
      payload?.error ?? `Request failed with status ${response.status}`,
    )
  }
  return response.json() as Promise<T>
}

export function currentPredictionQuery(fixtureId: number, enabled: boolean) {
  return queryOptions({
    queryKey: ['predictions', 'mine', fixtureId],
    queryFn: () =>
      predictionRequest<Prediction | null>(
        `/fixtures/${fixtureId}/prediction`,
        {
          notFoundValue: null,
        },
      ),
    enabled,
  })
}

export function groupPredictionsQuery(
  groupId: number,
  fixtureId: number,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: ['predictions', 'group', groupId, fixtureId],
    queryFn: () =>
      predictionRequest<GroupPrediction[]>(
        `/groups/${groupId}/fixtures/${fixtureId}/predictions`,
      ),
    enabled,
    refetchInterval: enabled ? 30_000 : false,
  })
}

export function savePrediction(
  fixtureId: number,
  homeScore: number,
  awayScore: number,
) {
  return predictionRequest<Prediction>(`/fixtures/${fixtureId}/prediction`, {
    method: 'PUT',
    body: { home_score: homeScore, away_score: awayScore },
  })
}
