import { describe, expect, it } from 'vitest'
import { currentStreak, dateKey, trainingDayKeys, weekProgress } from './goals'

const d = (s: string) => new Date(s + 'T12:00:00')
const keys = (...days: string[]) => new Set(days)
const MON = 1, SUN = 0

describe('trainingDayKeys', () => {
  it('counts finished sessions once per day', () => {
    const at = (s: string, h = 9) => new Date(`${s}T${String(h).padStart(2, '0')}:00:00`).getTime()
    const k = trainingDayKeys([
      { startedAt: at('2026-10-05'), status: 'finished' }, { startedAt: at('2026-10-05', 19), status: 'finished' },
      { startedAt: at('2026-10-06'), status: 'active' }, { startedAt: at('2026-10-07'), status: 'finished' },
    ])
    expect([...k].sort()).toEqual(['2026-10-05', '2026-10-07'])
  })
})

describe('weekProgress', () => {
  it('marks trained days and today, in week-start order', () => {
    // Wed 2026-10-07; Monday-start week = Oct 5..11
    const w = weekProgress(keys('2026-10-05', '2026-10-07'), d('2026-10-07'), MON, 3)
    expect(w.days.map((x) => x.date.getDate())).toEqual([5, 6, 7, 8, 9, 10, 11])
    expect(w.days.map((x) => x.trained)).toEqual([true, false, true, false, false, false, false])
    expect(w.days.findIndex((x) => x.isToday)).toBe(2)
    expect(w.days.map((x) => x.future)).toEqual([false, false, false, true, true, true, true])
    expect([w.count, w.goal, w.met]).toEqual([2, 3, false])
  })
  it('respects the configured week start', () => {
    // Sunday Oct 11 belongs to the *next* week when weeks start on Sunday
    const mon = weekProgress(keys('2026-10-11'), d('2026-10-11'), MON, 1)
    const sun = weekProgress(keys('2026-10-11'), d('2026-10-11'), SUN, 1)
    expect(mon.days[0].date.getDate()).toBe(5)
    expect(sun.days[0].date.getDate()).toBe(11)
    expect(mon.days[6].trained).toBe(true)
    expect(sun.days[0].trained).toBe(true)
  })
})

describe('currentStreak', () => {
  // goal 2/week, Monday weeks. Weeks: Sep 21, Sep 28, Oct 5 (current, today = Wed Oct 7)
  const today = d('2026-10-07')
  it('counts consecutive met weeks and the current week once met', () => {
    const k = keys('2026-09-22', '2026-09-24', '2026-09-29', '2026-10-01', '2026-10-05', '2026-10-06')
    expect(currentStreak(k, today, MON, 2)).toBe(3)
  })
  it('an unmet current week does not break the streak', () => {
    const k = keys('2026-09-22', '2026-09-24', '2026-09-29', '2026-10-01', '2026-10-05')
    expect(currentStreak(k, today, MON, 2)).toBe(2)
  })
  it('a missed past week ends it', () => {
    const k = keys('2026-09-22', '2026-09-24', '2026-09-30', '2026-10-05', '2026-10-06')
    expect(currentStreak(k, today, MON, 2)).toBe(1) // Sep 28 week has only 1 day
  })
  it('two sessions on one day are one training day', () => {
    expect(currentStreak(keys('2026-10-05'), today, MON, 2)).toBe(0)
  })
  it('no data or invalid goal gives zero', () => {
    expect(currentStreak(keys(), today, MON, 2)).toBe(0)
    expect(currentStreak(keys('2026-10-05'), today, MON, 0)).toBe(0)
  })
  it('week boundaries follow the week-start setting', () => {
    // Sun Oct 4 + Mon Oct 5: one week with Sunday start, two different weeks with Monday start
    const k = keys('2026-10-04', '2026-10-05')
    expect(currentStreak(k, d('2026-10-06'), SUN, 2)).toBe(1)
    expect(currentStreak(k, d('2026-10-06'), MON, 2)).toBe(0)
  })
  it('works across a DST change and a year boundary', () => {
    const k = keys('2026-12-28', '2026-12-30', '2027-01-04', '2027-01-06')
    expect(currentStreak(k, d('2027-01-07'), MON, 2)).toBe(2)
    const dst = keys('2026-10-26', '2026-10-28', '2026-11-02', '2026-11-04') // US DST ends Nov 1
    expect(currentStreak(dst, d('2026-11-05'), MON, 2)).toBe(2)
  })
  it('a goal change applies to all history', () => {
    const k = keys('2026-09-29', '2026-10-01', '2026-10-05', '2026-10-06', '2026-10-07')
    expect(currentStreak(k, today, MON, 2)).toBe(2)
    expect(currentStreak(k, today, MON, 3)).toBe(1) // only the current week reaches 3
  })
  it('dateKey is local', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})
