import type { GymAllowance, ID, Program, SetLog, WorkoutSession } from '../db/types'
import { dateKey } from './goals'
import { dayDiff } from './programs'

/**
 * Gym visit plans (e.g. "12 visits a month"), entirely derived from history so edits and deletes in History keep
 * them correct. Rules:
 *  - A visit is a calendar day with at least one finished session at that gym that has a completed non-warm-up
 *    set. Two sessions on one day count once; sessions without a gym, unfinished, empty or warm-up-only ones don't.
 *  - Periods start on `startDay` of each month, clamped to short months (31 -> Feb 28/29, Apr 30...); 1 = calendar month.
 *  - With rollover, unused visits carry into the next period (they don't expire) starting from the period the
 *    plan was set up in. Periods before that aren't counted.
 */

const fromKey = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/** Day-of-month a period starts on in the given month (1..31 clamped to the month's length). */
export const periodStartDay = (year: number, month: number, startDay: number): Date =>
  new Date(year, month, Math.min(Math.max(1, startDay), new Date(year, month + 1, 0).getDate()))

export interface Period { start: Date; end: Date /* exclusive: the next period's first day */ }

export function periodFor(date: Date, startDay: number): Period {
  const d = midnight(date)
  const thisMonth = periodStartDay(d.getFullYear(), d.getMonth(), startDay)
  const start = dayDiff(thisMonth, d) >= 0 ? thisMonth : periodStartDay(d.getFullYear(), d.getMonth() - 1, startDay)
  return { start, end: periodStartDay(start.getFullYear(), start.getMonth() + 1, startDay) }
}

/** Ids of sessions that count as a gym visit on their own: they have a completed non-warm-up set. */
export const qualifyingSessionIds = (sets: SetLog[]): Set<ID> =>
  new Set(sets.filter((s) => s.doneAt !== undefined && s.setType !== 'warmup').map((s) => s.sessionId))

/** Distinct local days with a qualifying finished session at `gymId`. */
export function visitDays(
  sessions: Pick<WorkoutSession, 'id' | 'gymId' | 'startedAt' | 'status'>[], qualifying: Set<ID>, gymId: ID,
): Set<string> {
  return new Set(
    sessions
      .filter((s) => s.gymId === gymId && s.status === 'finished' && qualifying.has(s.id))
      .map((s) => dateKey(new Date(s.startedAt))),
  )
}

export interface PeriodSummary {
  start: Date
  end: Date
  /** The plan's visits per period. */
  base: number
  /** Unused visits carried in from the previous period (0 without rollover). */
  carried: number
  total: number
  used: number
  left: number
}

/** Every period from the one the plan was set up in up to the one containing `today`, oldest first. */
export function gymPeriods(allowance: GymAllowance, days: Set<string>, today: Date): PeriodSummary[] {
  const since = fromKey(allowance.since)
  const out: PeriodSummary[] = []
  let carry = 0
  let p = periodFor(since > today ? today : since, allowance.startDay)
  for (let guard = 0; guard < 1200 && dayDiff(p.start, today) >= 0; guard++) {
    let used = 0
    for (const k of days) { const d = fromKey(k); if (dayDiff(p.start, d) >= 0 && dayDiff(d, p.end) > 0) used++ }
    const carried = allowance.rollover ? carry : 0
    const total = allowance.visits + carried
    out.push({ start: p.start, end: p.end, base: allowance.visits, carried, total, used, left: Math.max(0, total - used) })
    carry = Math.max(0, total - used)
    p = periodFor(p.end, allowance.startDay)
  }
  return out
}

/** Days remaining in the period including today (1 on its last day). */
export const daysLeftIn = (period: Pick<Period, 'end'>, today: Date): number => Math.max(0, dayDiff(midnight(today), period.end))

export type PaceHint =
  | { kind: 'done' }                      // nothing left to use
  | { kind: 'every'; days: number }       // "about every N days"
  | { kind: 'daily' }                     // as many left as days: every day
  | { kind: 'tooMany'; surplus: number }  // more visits left than days: some will go unused
  | { kind: 'none' }                      // period over

export function paceHint(left: number, daysLeft: number): PaceHint {
  if (left <= 0) return { kind: 'done' }
  if (daysLeft <= 0) return { kind: 'none' }
  if (left > daysLeft) return { kind: 'tooMany', surplus: left - daysLeft }
  if (left === daysLeft) return { kind: 'daily' }
  return { kind: 'every', days: Math.max(1, Math.floor(daysLeft / left)) }
}

/** Does this routine belong to the program (schedule or rotation)? Used for the program's default gym. */
export function programIncludesRoutine(program: Pick<Program, 'rotation' | 'schedule'>, routineId: ID): boolean {
  if (program.rotation?.includes(routineId)) return true
  return Object.values(program.schedule ?? {}).some((week) => Object.values(week).includes(routineId))
}
