import { queryOptions } from '@tanstack/react-query'

export type StandingRow = {
  rank: number
  team_id: number
  team_name: string
  played: number
  win: number
  draw: number
  lose: number
  goals_for: number
  goals_against: number
  goals_diff: number
  points: number
  form: string
  description: string
}

export type Conference = {
  name: string
  rows: StandingRow[]
}

export type Standings = {
  competition_id: number | null
  season: number
  conferences: Conference[]
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

export const standingsQuery = queryOptions({
  queryKey: ['standings'],
  queryFn: () => request<Standings>('/standings'),
  staleTime: 5 * 60 * 1000,
})

/**
 * Number of teams in the playoff zone for a conference. MLS takes the top
 * 9; we read it from the qualification descriptions when present and fall
 * back to 9.
 */
export function playoffCutoff(rows: StandingRow[]) {
  const qualifying = rows.filter(row => /play\W?off/i.test(row.description))
  return qualifying.length > 0 ? qualifying.length : 9
}

/** "Western Conference" -> "Western". */
export function conferenceLabel(name: string) {
  return name.replace(/\s*conference$/i, '')
}
