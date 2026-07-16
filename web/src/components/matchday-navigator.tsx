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
    <div className='flex items-stretch border border-border bg-surface'>
      <button
        aria-label='Previous matchday'
        className='grid w-11 shrink-0 place-items-center border-r border-border transition-colors hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent'
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
          className='min-w-0 flex-1 justify-center border-0 text-center font-semibold'
          size='lg'
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
        className='grid w-11 shrink-0 place-items-center border-l border-border transition-colors hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent'
        disabled={!hasNext}
        onClick={() => hasNext && onSelect(rounds[index + 1])}
        type='button'
      >
        <CaretRight aria-hidden size={16} />
      </button>
    </div>
  )
}
