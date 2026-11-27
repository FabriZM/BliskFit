/** Weekday names (index 0 = Sunday) in the given locale. */
export function weekdayNames(locale: string, style: 'short' | 'long' = 'long'): string[] {
  const f = new Intl.DateTimeFormat(locale, { weekday: style })
  return Array.from({ length: 7 }, (_, i) => f.format(new Date(2024, 0, 7 + i))) // Jan 7 2024 = Sunday
}

/** Weekday indexes ordered to begin at `weekStartDay`. */
export const orderedWeekdays = (weekStartDay: number) => Array.from({ length: 7 }, (_, i) => (weekStartDay + i) % 7)

export const toDateInput = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const fromDateInput = (v: string) => { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d).getTime() }

/**
 * How long ago `ms` was, in the locale's words ("today", "yesterday", "3 days ago", "2 weeks ago", "4 months ago"),
 * counted in calendar days so a session last night is "yesterday" this morning.
 */
export function timeSince(ms: number, now: number, locale: string): string {
  const day = (t: number) => { const d = new Date(t); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000 }
  const days = Math.max(0, Math.round(day(now) - day(ms)))
  const f = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (days < 14) return f.format(-days, 'day')
  if (days < 60) return f.format(-Math.floor(days / 7), 'week')
  if (days < 365) return f.format(-Math.floor(days / 30), 'month')
  return f.format(-Math.floor(days / 365), 'year')
}
