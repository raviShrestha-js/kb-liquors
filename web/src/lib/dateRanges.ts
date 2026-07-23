import { startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay, subDays } from 'date-fns'

export type RangeKey =
  | 'today'
  | 'yesterday'
  | 'week'
  | 'month'
  | 'year'
  | 'last7'
  | 'last30'
  | 'last90'
  | 'all'

export const RANGE_LABELS: Record<RangeKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'This week',
  month: 'This month',
  year: 'This year',
  last7: 'Last 7 days',
  last30: 'Last 30 days',
  last90: 'Last 90 days',
  all: 'All time',
}

const EPOCH = new Date(0)

export function rangeBounds(key: RangeKey, now: Date): { from: Date; to: Date } {
  switch (key) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) }
    case 'yesterday': {
      const y = subDays(now, 1)
      return { from: startOfDay(y), to: endOfDay(y) }
    }
    case 'week':
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) }
    case 'month':
      return { from: startOfMonth(now), to: endOfDay(now) }
    case 'year':
      return { from: startOfYear(now), to: endOfDay(now) }
    case 'last7':
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) }
    case 'last30':
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) }
    case 'last90':
      return { from: startOfDay(subDays(now, 89)), to: endOfDay(now) }
    case 'all':
      return { from: EPOCH, to: endOfDay(now) }
  }
}

export function inRange(dateStr: string, from: Date, to: Date): boolean {
  const d = new Date(dateStr)
  return d >= from && d <= to
}
