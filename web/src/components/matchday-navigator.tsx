import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  const options = rounds.map(round => ({
    label: roundLabel(round),
    value: round,
  }))

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

      <Select
        items={options}
        onValueChange={round => round !== null && onSelect(round)}
        value={current}
      >
        <SelectTrigger
          aria-label='Select matchday'
          className='h-9! min-w-0 flex-1 justify-center border-y border-x-0 border-border text-center font-semibold'
        >
          <SelectValue>
            {value =>
              options.find(option => option.value === value)?.label ??
              roundLabel(current)
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent align='center'>
          <SelectGroup>
            {options.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

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
