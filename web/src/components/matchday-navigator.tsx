import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { roundLabel } from '@/lib/fixtures'

/**
 * Prev/next round pager with a picker for larger jumps. `rounds` is the
 * full season order; `current` is the round currently being viewed.
 */
export function MatchdayNavigator({
  rounds,
  current,
  onSelect,
}: {
  rounds: string[]
  current: string
  onSelect: (round: string) => void
}) {
  const index = rounds.indexOf(current)
  const hasPrev = index > 0
  const hasNext = index >= 0 && index < rounds.length - 1

  return (
    <div className='flex'>
      <button
        aria-label='Previous matchday'
        className='w-11 shrink-0 px-0'
        disabled={!hasPrev}
        onClick={() => hasPrev && onSelect(rounds[index - 1])}
        type='button'
      >
        <CaretLeft aria-hidden size={16} />
      </button>

      <select
        aria-label='Select matchday'
        className='min-w-0 flex-1 border-x-0 text-center font-semibold'
        onChange={event => onSelect(event.target.value)}
        value={current}
      >
        {rounds.map(round => (
          <option key={round} value={round}>
            {roundLabel(round)}
          </option>
        ))}
      </select>

      <button
        aria-label='Next matchday'
        className='w-11 shrink-0 px-0'
        disabled={!hasNext}
        onClick={() => hasNext && onSelect(rounds[index + 1])}
        type='button'
      >
        <CaretRight aria-hidden size={16} />
      </button>
    </div>
  )
}
