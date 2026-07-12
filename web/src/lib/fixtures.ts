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

export function getUpcomingFixtures() {
  return request<Fixture[]>('/fixtures/upcoming')
}

export function getFixture(id: number) {
  return request<Fixture>(`/fixtures/${id}`)
}

export function teamCrestUrl(teamId: number) {
  return `https://media.api-sports.io/football/teams/${teamId}.png`
}
