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

// ---- per-week goals --------------------------------------------------------------------------------

/** A goal that applies from the week starting on `from` (YYYY-MM-DD) until the next change. */
export interface GoalChange { from: string; goal: number }
export const GOAL_BASE = '0000-01-01'

/** The goal in effect for the week starting `weekStartKey`; `fallback` when no changes have ever been recorded. */
export function goalForWeek(history: GoalChange[], weekStartKey: string, fallback: number): number {
  let goal: number | undefined
  for (const c of [...history].sort((a, b) => a.from.localeCompare(b.from))) {
    if (c.from <= weekStartKey) goal = c.goal
    else if (goal === undefined) goal = c.goal // earlier than any recorded change: the oldest known goal
  }
  return goal ?? fallback
}

/** History after the goal changes from `oldGoal` to `newGoal` in the week starting `weekKey` (past weeks keep their goal). */
export function withGoalChange(history: GoalChange[], change: { oldGoal: number; newGoal: number; weekKey: string }): GoalChange[] {
  if (change.oldGoal === change.newGoal) return history
  const base = history.length ? history : [{ from: GOAL_BASE, goal: change.oldGoal }]
  const next = [...base.filter((c) => c.from !== change.weekKey), { from: change.weekKey, goal: change.newGoal }]
    .sort((a, b) => a.from.localeCompare(b.from))
  // Drop entries that don't change anything (same goal as the one before).
  return next.filter((c, i) => i === 0 || c.goal !== next[i - 1].goal)
}

// ---- weekly counts, streaks --------------------------------------------------------------------------

function perWeekCounts(keys: Set<string>, weekStartDay: number): { counts: Map<string, number>; earliest?: Date } {
  const counts = new Map<string, number>()
  let earliest: Date | undefined
  for (const k of keys) {
    const d = fromKey(k)
    if (!earliest || d < earliest) earliest = d
    const wk = dateKey(weekStart(d, weekStartDay))
    counts.set(wk, (counts.get(wk) ?? 0) + 1)
  }
  return { counts, earliest }
}

const weeksAgo = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7 * n)

export interface StreakInfo {
  streak: number
  /** Week starts bridged by a freeze (only ones that were needed to keep the streak alive). */
  frozen: Date[]
}

/**
 * Consecutive weeks (ending now) in which at least that week's goal many distinct days were trained.
 *  - The current week counts once it is met, but an unmet current week doesn't break the streak.
 *  - Freezes (per calendar month of the week's first day): a missed past week is bridged, not counted, while
 *    the month still has a freeze left. Freezes are applied automatically, so history stays derivable.
 *    A bridged week with nothing to protect before it (the streak would have ended anyway) isn't reported.
 */
export function streakInfo(
  keys: Set<string>, today: Date, weekStartDay: number,
  goalFor: (weekStart: Date) => number, freezesPerMonth = 0,
): StreakInfo {
  const { counts, earliest } = perWeekCounts(keys, weekStartDay)
  if (!earliest) return { streak: 0, frozen: [] }
  const earliestWeek = weekStart(earliest, weekStartDay)
  const used = new Map<string, number>()
  const frozen: Date[] = []
  let pending: Date[] = []
  let streak = 0
  let first = true
  for (let cursor = weekStart(today, weekStartDay); cursor >= earliestWeek; cursor = weeksAgo(cursor, 1)) {
    const goal = goalFor(cursor)
    if (goal < 1) return { streak: 0, frozen: [] }
    if ((counts.get(dateKey(cursor)) ?? 0) >= goal) {
      streak++
      frozen.push(...pending)
      pending = []
    } else if (!first) {
      const month = `${cursor.getFullYear()}-${cursor.getMonth()}`
      if ((used.get(month) ?? 0) >= freezesPerMonth) break
      used.set(month, (used.get(month) ?? 0) + 1)
      pending.push(cursor)
    }
    first = false
  }
  return { streak, frozen }
}

/** Convenience: streak with a single goal for every week. */
export const currentStreak = (keys: Set<string>, today: Date, weekStartDay: number, goal: number, freezesPerMonth = 0): number =>
  goal < 1 ? 0 : streakInfo(keys, today, weekStartDay, () => goal, freezesPerMonth).streak

export interface WeekBar { start: Date; key: string; count: number; goal: number; met: boolean; current: boolean }

/** The last `weeks` weeks (oldest first, current week last) with the goal that applied in each. */
export function weeklyBars(
  keys: Set<string>, today: Date, weekStartDay: number, weeks: number, goalFor: (weekStart: Date) => number,
): WeekBar[] {
  const { counts } = perWeekCounts(keys, weekStartDay)
  const thisWeek = weekStart(today, weekStartDay)
  return Array.from({ length: weeks }, (_, i) => {
    const start = weeksAgo(thisWeek, weeks - 1 - i)
    const key = dateKey(start)
    const count = counts.get(key) ?? 0
    const goal = goalFor(start)
    return { start, key, count, goal, met: count >= goal, current: i === weeks - 1 }
  })
}
