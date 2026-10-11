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
