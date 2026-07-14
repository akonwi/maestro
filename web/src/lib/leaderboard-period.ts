const weekRangeFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

export function isWeekKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return (
    !Number.isNaN(date.valueOf()) &&
    date.toISOString().slice(0, 10) === value &&
    date.getUTCDay() === 2
  )
}

export function currentWeekKey(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    hour: 'numeric',
    hourCycle: 'h23',
    month: 'numeric',
    timeZone: 'America/New_York',
    weekday: 'short',
    year: 'numeric',
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map(part => [part.type, part.value]),
  )
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  const weekday = weekdays[parts.weekday] ?? 2
  let daysSinceTuesday = (weekday - 2 + 7) % 7
  if (weekday === 2 && Number(parts.hour) < 6) daysSinceTuesday = 7
  const start = new Date(
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day) - daysSinceTuesday,
    ),
  )
  return start.toISOString().slice(0, 10)
}

export function shiftWeek(week: string, days: number) {
  const date = new Date(`${week}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function weekLabel(week: string) {
  const start = new Date(`${week}T00:00:00Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  return `${weekRangeFormatter.format(start)}–${weekRangeFormatter.format(end)}`
}
