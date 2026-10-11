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

import { goalForWeek, streakInfo, weeklyBars, withGoalChange, GOAL_BASE } from './goals'

describe('goal history', () => {
  it('uses the fallback until a change is recorded', () => {
    expect(goalForWeek([], '2026-10-05', 3)).toBe(3)
  })
  it('a change applies from its week onward and leaves earlier weeks alone', () => {
    const h = withGoalChange([], { oldGoal: 3, newGoal: 5, weekKey: '2026-10-05' })
    expect(h).toEqual([{ from: GOAL_BASE, goal: 3 }, { from: '2026-10-05', goal: 5 }])
    expect(goalForWeek(h, '2026-09-28', 99)).toBe(3)
    expect(goalForWeek(h, '2026-10-05', 99)).toBe(5)
    expect(goalForWeek(h, '2026-12-01', 99)).toBe(5)
  })
  it('changing twice in the same week replaces that entry; changing back collapses it', () => {
    let h = withGoalChange([], { oldGoal: 3, newGoal: 5, weekKey: '2026-10-05' })
    h = withGoalChange(h, { oldGoal: 5, newGoal: 4, weekKey: '2026-10-05' })
    expect(goalForWeek(h, '2026-10-05', 0)).toBe(4)
    h = withGoalChange(h, { oldGoal: 4, newGoal: 3, weekKey: '2026-10-05' })
    expect(h).toEqual([{ from: GOAL_BASE, goal: 3 }]) // net no change: nothing left to remember
  })
  it('no-op changes leave history untouched', () => {
    expect(withGoalChange([], { oldGoal: 3, newGoal: 3, weekKey: '2026-10-05' })).toEqual([])
  })
  it('a later change keeps every earlier goal', () => {
    let h = withGoalChange([], { oldGoal: 3, newGoal: 4, weekKey: '2026-09-14' })
    h = withGoalChange(h, { oldGoal: 4, newGoal: 2, weekKey: '2026-10-05' })
    expect([ '2026-09-07', '2026-09-14', '2026-09-28', '2026-10-05' ].map((k) => goalForWeek(h, k, 0))).toEqual([3, 4, 4, 2])
  })
})

describe('streak with per-week goals', () => {
  const today = d('2026-10-07') // Wed; weeks (Mon): Sep 21, Sep 28, Oct 5
  const k = keys('2026-09-22', '2026-09-24', '2026-09-29', '2026-10-01', '2026-10-05', '2026-10-06')
  it('a raised goal does not rewrite past weeks', () => {
    // Goal was 2 until the week of Oct 5, then raised to 3: current week (2 days) is below 3 but doesn't break; past weeks still pass at 2
    const goalFor = (ws: Date) => (dateKey(ws) >= '2026-10-05' ? 3 : 2)
    expect(streakInfo(k, today, MON, goalFor).streak).toBe(2)
    // the old behaviour (3 for everything) would have lost the history
    expect(streakInfo(k, today, MON, () => 3).streak).toBe(0)
  })
})

describe('streak freezes', () => {
  const today = d('2026-10-20') // Tue; weeks (Mon): Sep 28, Oct 5, Oct 12, Oct 19
  const freeze = (k: Set<string>, perMonth: number) => streakInfo(k, today, MON, () => 2, perMonth)
  const met = (...ws: string[]) => ws.flatMap((w) => { const x = d(w); return [dateKey(x), dateKey(new Date(x.getFullYear(), x.getMonth(), x.getDate() + 2))] })

  it('without freezes a missed week ends the streak', () => {
    const k = keys(...met('2026-09-28', '2026-10-12', '2026-10-19')) // Oct 5 week missed
    expect(freeze(k, 0).streak).toBe(2)
  })
  it('a freeze bridges one missed week without counting it', () => {
    const k = keys(...met('2026-09-28', '2026-10-12', '2026-10-19'))
    const r = freeze(k, 1)
    expect(r.streak).toBe(3)
    expect(r.frozen.map((x) => dateKey(x))).toEqual(['2026-10-05'])
  })
  it('only the freezes the month allows: a second miss in the same month breaks it', () => {
    const k = keys(...met('2026-09-21', '2026-10-19')) // Sep 28, Oct 5, Oct 12 missed; Oct 5 & 12 are both October
    expect(freeze(k, 1).streak).toBe(1) // Oct 12 is frozen (1 left), Oct 5 can't be
    expect(freeze(k, 2).streak).toBe(2) // Oct 12, Oct 5 and Sep 28 all frozen (2 in Oct, 1 in Sep), reaching Sep 21
  })
  it('allowance is per calendar month of the week start', () => {
    // Oct 5 (Oct) and Sep 28 (Sep) both missed with 1 freeze/month: each month has its own freeze
    const k = keys(...met('2026-09-21', '2026-10-12', '2026-10-19'))
    const r = freeze(k, 1)
    expect(r.streak).toBe(3)
    expect(r.frozen.map((x) => dateKey(x)).sort()).toEqual(['2026-09-28', '2026-10-05'])
  })
  it('a frozen week with nothing to protect before it is not reported or counted', () => {
    const k = keys(...met('2026-10-12', '2026-10-19')) // Oct 5 missed but nothing earlier
    const r = freeze(k, 1)
    expect(r.streak).toBe(2)
    expect(r.frozen).toEqual([])
  })
  it('the current week never needs a freeze', () => {
    const k = keys(...met('2026-10-05', '2026-10-12')) // current week (Oct 19) not met yet
    expect(freeze(k, 1).streak).toBe(2)
  })
  it('freezes can bridge a gap into the past only while the streak continues to exist', () => {
    const k = keys(...met('2026-09-28')) // far past, then two empty weeks, then the current one
    expect(freeze(k, 1).streak).toBe(0)
    expect(freeze(k, 2).streak).toBe(1) // Oct 5 + Oct 12 + Oct 19(current, unmet): current is skipped; Oct 12 and 5 frozen (2) reach Sep 28
  })
})

describe('weeklyBars', () => {
  it('lists the last N weeks oldest first, flags the current one and uses each week\'s goal', () => {
    const k = keys('2026-10-05', '2026-10-06', '2026-10-07', '2026-09-29')
    const bars = weeklyBars(k, d('2026-10-08'), MON, 3, (ws) => (dateKey(ws) >= '2026-10-05' ? 3 : 2))
    expect(bars.map((b) => [b.key, b.count, b.goal, b.met, b.current])).toEqual([
      ['2026-09-21', 0, 2, false, false], ['2026-09-28', 1, 2, false, false], ['2026-10-05', 3, 3, true, true],
    ])
  })
  it('returns empty weeks as zero bars', () => {
    const bars = weeklyBars(keys(), d('2026-10-08'), MON, 4, () => 3)
    expect(bars).toHaveLength(4)
    expect(bars.every((b) => b.count === 0 && !b.met)).toBe(true)
  })
})
