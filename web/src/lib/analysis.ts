import { queryOptions } from '@tanstack/react-query'

export type ComparisonAxis = {
  label: string
  home: string // "62%"
  away: string
}

export type TeamOutlook = {
  id: number
  name: string
  form: string // "DWWWW..." most recent last
  goals_for_avg: string
  goals_against_avg: string
}

export type H2HResult = {
  kickoff_at: number
  home_name: string
  away_name: string
  home_goals: number | null
  away_goals: number | null
}

export type Outlook = {
  percent: { home: string; draw: string; away: string }
  comparison: ComparisonAxis[]
  home: TeamOutlook
  away: TeamOutlook
  h2h: H2HResult[]
}

export type StatLine = {
  label: string
  value: string | null
}

export type TeamStats = {
  team_id: number
  team_name: string
  stats: StatLine[]
}

export type MatchEvent = {
  minute: number
  extra: number | null
  team_id: number
  kind: string // Goal | Card | subst | Var
  detail: string
  player: string | null
  assist: string | null
  comments: string | null
}

export type LineupPlayer = {
  id: number | null
  name: string
  number: number
  pos: string | null
  grid: string | null // "row:col"
}

export type Lineup = {
  team_id: number
  team_name: string
  formation: string
  coach: string
  color_primary: string | null // hex without '#'
  color_number: string | null
  starters: LineupPlayer[]
  bench: LineupPlayer[]
}

export type PlayerLine = {
  id: number
  name: string
  position: string | null
  rating: string | null
  minutes: number | null
  goals: number | null
  assists: number | null
  saves: number | null
  shots: number | null
  shots_on: number | null
  passes: number | null
  key_passes: number | null
  tackles: number | null
  duels: number | null
  duels_won: number | null
  dribbles_attempted: number | null
  dribbles_won: number | null
  yellow: number | null
  red: number | null
}

export type TeamPlayers = {
  team_id: number
  team_name: string
  players: PlayerLine[]
}

export type MatchDetail = {
  statistics: TeamStats[]
  events: MatchEvent[]
  lineups: Lineup[]
  players: TeamPlayers[]
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

export function outlookQuery(fixtureId: number, enabled: boolean) {
  return queryOptions({
    queryKey: ['fixtures', fixtureId, 'outlook'],
    queryFn: () => request<Outlook>(`/fixtures/${fixtureId}/outlook`),
    staleTime: 10 * 60 * 1000,
    enabled,
    retry: false,
  })
}

export function matchDetailQuery(fixtureId: number, enabled: boolean) {
  return queryOptions({
    queryKey: ['fixtures', fixtureId, 'match'],
    queryFn: () => request<MatchDetail>(`/fixtures/${fixtureId}/match`),
    staleTime: 60 * 1000,
    enabled,
  })
}

/** Percent string ("62%") to a bounded number for bar widths. */
export function percentValue(percent: string) {
  const parsed = Number.parseFloat(percent)
  if (Number.isNaN(parsed)) return 0
  return Math.min(100, Math.max(0, parsed))
}

const statLabels: Record<string, string> = {
  'Ball Possession': 'Possession',
  expected_goals: 'Expected goals (xG)',
  goals_prevented: 'Goals prevented',
  'Corner Kicks': 'Corners',
  'Total passes': 'Passes',
  'Passes accurate': 'Passes accurate',
  'Passes %': 'Pass accuracy',
  'Goalkeeper Saves': 'Saves',
  'Shots insidebox': 'Shots inside box',
  'Shots outsidebox': 'Shots outside box',
}

export function statLabel(label: string) {
  return statLabels[label] ?? label
}
