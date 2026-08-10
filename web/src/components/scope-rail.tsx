import type { Competition } from '@/lib/fixtures'
import { competitionCode, leagueLogoUrl } from '@/lib/fixtures'

/**
 * League scope selector for fixtures views: All plus one tab per active
 * competition. The selected scope owns league context — rows drop their
 * league tags when scoped, and the matchday navigator appears.
 */
export function ScopeRail({
  competitions,
  selected,
  onSelect,
}: {
  competitions: Competition[]
  selected: number | null
  onSelect: (competitionId: number | null) => void
}) {
  return (
    <nav aria-label='League scope' className='scope-rail'>
      <button
        aria-pressed={selected === null}
        className='scope-tab'
        onClick={() => onSelect(null)}
        type='button'
      >
        All
      </button>
      {competitions.map(competition => (
        <button
          aria-pressed={selected === competition.id}
          className='scope-tab'
          key={competition.id}
          onClick={() => onSelect(competition.id)}
          type='button'
        >
          <img
            alt=''
            decoding='async'
            height='14'
            loading='lazy'
            src={leagueLogoUrl(competition.api_football_league_id)}
            width='14'
          />
          {competitionCode(competition.name)}
          <span data-visually-hidden>{competition.name}</span>
        </button>
      ))}
    </nav>
  )
}
