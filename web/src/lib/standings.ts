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

export function standingsQuery(competitionId?: number) {
  const query =
    competitionId === undefined ? '' : `?competition_id=${competitionId}`
  return queryOptions({
    queryKey: ['standings', competitionId ?? 'default'],
    queryFn: () => request<Standings>(`/standings${query}`),
    staleTime: 5 * 60 * 1000,
  })
}

/** "Western Conference" -> "Western". */
export function conferenceLabel(name: string) {
  return name.replace(/\s*conference$/i, '')
}

// ─── Qualification zones ──────────────────────────────────────────

export type ZoneKind = 'success' | 'accent' | 'warning' | 'danger'

/**
 * Visual role for a qualification description. Order matters: MLS
 * descriptions contain both "Promotion" and "Play Offs" — playoffs win.
 */
export function zoneKind(description: string): ZoneKind | null {
  if (!description) return null
  const d = description.toLowerCase()
  if (d.includes('relegation')) return 'danger'
  if (/play\W?offs?/.test(d)) return 'accent'
  if (d.includes('champions league')) return 'accent'
  if (d.includes('europa') || d.includes('conference league')) return 'warning'
  if (d.includes('promotion')) return 'success'
  return 'accent'
}

/**
 * Legend label for a description. Upstream promotion strings carry the
 * useful part in parentheses ("Promotion - MLS (Play Offs: 1/8-finals)"
 * -> "Play Offs: 1/8-finals"); others read fine as-is.
 */
export function zoneLabel(description: string) {
  const parenthetical = /\(([^)]+)\)/.exec(description)
  return parenthetical ? parenthetical[1] : description
}

export type LegendEntry = { kind: ZoneKind; label: string }

/** Distinct qualification zones in table order, for the legend. */
export function legendEntries(rows: StandingRow[]): LegendEntry[] {
  const seen = new Set<string>()
  const out: LegendEntry[] = []
  for (const row of rows) {
    const kind = zoneKind(row.description)
    if (!kind || seen.has(row.description)) continue
    seen.add(row.description)
    out.push({ kind, label: zoneLabel(row.description) })
  }
  return out
}
