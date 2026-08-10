import { queryOptions } from '@tanstack/react-query'

// Client for the token-gated /admin surface. The admin token is unrelated
// to user sessions (magic links); it's held in sessionStorage only —
// entering it is per-browser-session, never persisted server-side.

export type AdminCompetition = {
  id: number
  api_football_league_id: number
  name: string
  kind: string
  is_active: boolean
}

export type CompetitionUpsert = {
  api_football_league_id: number
  name: string
  kind?: string
  is_active?: boolean
}

const TOKEN_KEY = 'maestro.adminToken'

export function getAdminToken() {
  return sessionStorage.getItem(TOKEN_KEY) ?? ''
}

export function setAdminToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearAdminToken() {
  sessionStorage.removeItem(TOKEN_KEY)
}

export class AdminAuthError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken()
  if (!token) throw new AdminAuthError('Admin token required.')
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  if (response.status === 401) {
    clearAdminToken()
    throw new AdminAuthError('Admin token rejected.')
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string
    } | null
    throw new Error(
      body?.error ?? `Request failed with status ${response.status}`,
    )
  }
  return response.json() as Promise<T>
}

export function adminCompetitionsQuery(enabled: boolean) {
  return queryOptions({
    queryKey: ['admin', 'competitions'],
    queryFn: () => request<AdminCompetition[]>('/admin/competitions'),
    enabled,
    retry: false,
  })
}

export function upsertCompetition(body: CompetitionUpsert) {
  return request<AdminCompetition>('/admin/competitions', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export type LeagueSearchResult = {
  league_id: number
  name: string
  type: string // 'League' | 'Cup'
  country: string
}

export function leagueSearchQuery(query: string) {
  return queryOptions({
    queryKey: ['admin', 'league-search', query],
    queryFn: () =>
      request<LeagueSearchResult[]>(
        `/admin/leagues/search?q=${encodeURIComponent(query)}`,
      ),
    enabled: query.trim().length >= 3,
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  })
}
