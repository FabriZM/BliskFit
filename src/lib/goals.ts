import { dayDiff, weekStart } from './programs'

const pad = (n: number) => String(n).padStart(2, '0')
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fromKey = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }

/** Distinct local calendar days with a finished workout (two sessions in one day count once). */
export function trainingDayKeys(sessions: { startedAt: number; status: string }[]): Set<string> {
  return new Set(sessions.filter((s) => s.status === 'finished').map((s) => dateKey(new Date(s.startedAt))))
}

export interface WeekDay { date: Date; trained: boolean; isToday: boolean; future: boolean }
export interface WeekProgress { days: WeekDay[]; count: number; goal: number; met: boolean }

/** The week containing `today`, starting on `weekStartDay`, with which days were trained. */
export function weekProgress(keys: Set<string>, today: Date, weekStartDay: number, goal: number): WeekProgress {
  const start = weekStart(today, weekStartDay)
  const days = Array.from({ length: 7 }, (_, i): WeekDay => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const diff = dayDiff(today, date)
    return { date, trained: keys.has(dateKey(date)), isToday: diff === 0, future: diff > 0 }
  })
  const count = days.filter((d) => d.trained).length
  return { days, count, goal, met: count >= goal }
}

/**
 * Consecutive weeks (ending now) in which at least `goal` distinct days were trained. The current week counts
 * once it is met, but an unmet current week does not break the streak: it can still be completed.
 * Uses today's goal for every past week (no per-week goal history yet).
 */
export function currentStreak(keys: Set<string>, today: Date, weekStartDay: number, goal: number): number {
  if (goal < 1 || keys.size === 0) return 0
  const perWeek = new Map<string, number>()
  let earliest = today
  for (const k of keys) {
    const d = fromKey(k)
    if (d < earliest) earliest = d
    const wk = dateKey(weekStart(d, weekStartDay))
    perWeek.set(wk, (perWeek.get(wk) ?? 0) + 1)
  }
  const earliestWeek = weekStart(earliest, weekStartDay)
  let cursor = weekStart(today, weekStartDay)
  let streak = 0
  let first = true
  while (cursor >= earliestWeek) {
    const met = (perWeek.get(dateKey(cursor)) ?? 0) >= goal
    if (met) streak++
    else if (!first) break
    first = false
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 7)
  }
  return streak
}
