import { queryOptions } from '@tanstack/react-query'

export type Team = {
  id: number
  name: string
}

export type Fixture = {
  id: number
  competition_id: number
  kickoff_at: number
  status: string
  home_team: Team
  away_team: Team
  home_score: number | null
  away_score: number | null
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`/api${path}`)
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

export type CurrentRound = {
  competition_id: number | null
  round: string | null
  fixtures: Fixture[]
}

export type SeasonRounds = {
  competition_id: number | null
  rounds: string[]
  current: string | null
}

function getRound(name?: string) {
  const query = name ? `?name=${encodeURIComponent(name)}` : ''
  return request<CurrentRound>(`/fixtures/round${query}`)
}

function getFixture(id: number) {
  return request<Fixture>(`/fixtures/${id}`)
}

/** A specific round by name, or the current matchday when name is omitted. */
export function roundQuery(name?: string) {
  return queryOptions({
    queryKey: ['fixtures', 'round', name ?? 'current'],
    queryFn: () => getRound(name),
  })
}

export const seasonRoundsQuery = queryOptions({
  queryKey: ['fixtures', 'rounds'],
  queryFn: () => request<SeasonRounds>('/fixtures/rounds'),
  staleTime: 5 * 60 * 1000,
})

// API-Football round names look like "Regular Season - 28"; render the
// friendlier "Matchday 28" when the name matches that shape.
export function roundLabel(round: string) {
  const match = /^Regular Season - (\d+)$/.exec(round)
  return match ? `Matchday ${match[1]}` : round
}

export function fixtureQuery(id: number) {
  return queryOptions({
    queryKey: ['fixtures', id],
    queryFn: () => getFixture(id),
  })
}

const statusLabels: Record<string, string> = {
  NS: 'Scheduled',
  TBD: 'Time TBD',
  '1H': 'First half',
  HT: 'Half time',
  '2H': 'Second half',
  ET: 'Extra time',
  P: 'Penalties',
  FT: 'Full time',
  AET: 'After extra time',
  PEN: 'After penalties',
  PST: 'Postponed',
  CANC: 'Cancelled',
  ABD: 'Abandoned',
}

export function fixtureStatusLabel(status: string) {
  return statusLabels[status] ?? status
}

export function teamCrestUrl(teamId: number) {
  return `https://media.api-sports.io/football/teams/${teamId}.png`
}
