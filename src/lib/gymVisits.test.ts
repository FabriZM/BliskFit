import { describe, expect, it } from 'vitest'
import type { GymAllowance, SetLog, WorkoutSession } from '../db/types'
import { dateKey } from './goals'
import { daysLeftIn, gymPeriods, paceHint, periodFor, programIncludesRoutine, qualifyingSessionIds, visitDays } from './gymVisits'

const d = (s: string) => new Date(s + 'T12:00:00')
const ymd = (x: Date) => dateKey(x)
const span = (date: string, startDay: number) => { const p = periodFor(d(date), startDay); return [ymd(p.start), ymd(p.end)] }

describe('periodFor', () => {
  it('calendar month (start day 1)', () => {
    expect(span('2026-10-11', 1)).toEqual(['2026-10-01', '2026-11-01'])
    expect(span('2026-10-01', 1)).toEqual(['2026-10-01', '2026-11-01']) // first day belongs to the new period
    expect(span('2026-09-30', 1)).toEqual(['2026-09-01', '2026-10-01']) // last day belongs to the old one
  })
  it('billing day in the middle of the month, across month and year boundaries', () => {
    expect(span('2026-10-14', 15)).toEqual(['2026-09-15', '2026-10-15'])
    expect(span('2026-10-15', 15)).toEqual(['2026-10-15', '2026-11-15'])
    expect(span('2027-01-05', 15)).toEqual(['2026-12-15', '2027-01-15'])
    expect(span('2026-12-20', 15)).toEqual(['2026-12-15', '2027-01-15'])
  })
  it('billing day 31 clamps to the last day of short months', () => {
    expect(span('2026-02-15', 31)).toEqual(['2026-01-31', '2026-02-28'])
    expect(span('2026-02-28', 31)).toEqual(['2026-02-28', '2026-03-31'])
    expect(span('2026-03-30', 31)).toEqual(['2026-02-28', '2026-03-31'])
    expect(span('2026-03-31', 31)).toEqual(['2026-03-31', '2026-04-30'])
    expect(span('2026-04-30', 31)).toEqual(['2026-04-30', '2026-05-31'])
    expect(span('2028-02-29', 31)).toEqual(['2028-02-29', '2028-03-31']) // leap year
  })
  it('periods are contiguous: each one ends where the next begins', () => {
    for (const sd of [1, 15, 29, 30, 31]) {
      let p = periodFor(d('2026-01-10'), sd)
      for (let i = 0; i < 24; i++) {
        const next = periodFor(p.end, sd)
        expect(ymd(next.start)).toBe(ymd(p.end))
        expect(next.end > next.start).toBe(true)
        p = next
      }
    }
  })
})

describe('visits', () => {
  const at = (day: string, h = 18) => new Date(`${day}T${String(h).padStart(2, '0')}:00:00`).getTime()
  const sess = (id: string, day: string, extra: Partial<WorkoutSession> = {}): WorkoutSession =>
    ({ id, startedAt: at(day), status: 'finished', pausedIntervals: [], exercises: [], gymId: 'g1', ...extra })
  const set = (sessionId: string, extra: Partial<SetLog> = {}): SetLog =>
    ({ id: Math.random().toString(), sessionId, exerciseId: 'e', order: 0, setType: 'working', doneAt: 1, ...extra })

  it('counts a day once however many sessions, and ignores other gyms, no gym, unfinished, empty and warm-up-only', () => {
    const sessions = [
      sess('a', '2026-10-05'), sess('a2', '2026-10-05', {}), // same day twice
      sess('b', '2026-10-06', { gymId: 'g2' }), sess('c', '2026-10-07', { gymId: undefined }),
      sess('d', '2026-10-08', { status: 'active' }), sess('e', '2026-10-09'), sess('f', '2026-10-10'),
      sess('g', '2026-10-11'),
    ]
    const sets = [
      set('a'), set('a2'), set('b'), set('c'), set('d'), set('f', { setType: 'warmup' }), set('g', { doneAt: undefined }),
      // 'e' has no sets at all
    ]
    const days = visitDays(sessions, qualifyingSessionIds(sets), 'g1')
    expect([...days]).toEqual(['2026-10-05'])
  })

  it('a session with one working set among warm-ups counts', () => {
    const sets = [set('a', { setType: 'warmup' }), set('a', { setType: 'working' })]
    expect(visitDays([sess('a', '2026-10-05')], qualifyingSessionIds(sets), 'g1').size).toBe(1)
  })

  it('moving a session to another gym or day changes the count (derived, nothing stored)', () => {
    const sets = [set('a'), set('b')]
    const q = qualifyingSessionIds(sets)
    const before = visitDays([sess('a', '2026-10-05'), sess('b', '2026-10-06')], q, 'g1')
    expect(before.size).toBe(2)
    expect(visitDays([sess('a', '2026-10-05'), sess('b', '2026-10-06', { gymId: 'g2' })], q, 'g1').size).toBe(1) // gym edited
    expect([...visitDays([sess('a', '2026-10-05'), sess('b', '2026-10-05')], q, 'g1')]).toEqual(['2026-10-05'])  // date edited onto the same day
  })
})

describe('gymPeriods', () => {
  const plan = (extra: Partial<GymAllowance> = {}): GymAllowance => ({ visits: 12, startDay: 1, rollover: false, since: '2026-10-01', ...extra })
  const days = (...k: string[]) => new Set(k)

  it('current period: used, left, days left', () => {
    const [p] = gymPeriods(plan(), days('2026-10-02', '2026-10-05', '2026-10-09'), d('2026-10-11'))
    expect([p.used, p.total, p.left]).toEqual([3, 12, 9])
    expect(daysLeftIn(p, d('2026-10-11'))).toBe(21)
    expect(daysLeftIn(p, d('2026-10-31'))).toBe(1) // last day: today still counts
  })

  it('period boundaries: a visit on the first day counts, on the next period\'s first day it does not', () => {
    const ps = gymPeriods(plan({ since: '2026-09-01' }), days('2026-09-01', '2026-09-30', '2026-10-01'), d('2026-10-11'))
    expect(ps.map((p) => p.used)).toEqual([2, 1])
  })

  it('billing day 15: windows follow the billing day, not the calendar month', () => {
    const ps = gymPeriods(plan({ startDay: 15, since: '2026-09-15' }), days('2026-09-20', '2026-10-14', '2026-10-15', '2026-10-20'), d('2026-10-25'))
    expect(ps.map((p) => [ymd(p.start), p.used])).toEqual([['2026-09-15', 2], ['2026-10-15', 2]])
  })

  it('without rollover unused visits expire; with rollover they carry forward', () => {
    const base = plan({ since: '2026-08-01' })
    const dys = days(...['2026-08-03', '2026-08-05'], ...['2026-09-02'], ...['2026-10-02', '2026-10-04'])
    const off = gymPeriods(base, dys, d('2026-10-11')).map((p) => [p.total, p.used, p.left])
    expect(off).toEqual([[12, 2, 10], [12, 1, 11], [12, 2, 10]])
    const on = gymPeriods({ ...base, rollover: true }, dys, d('2026-10-11')).map((p) => [p.carried, p.total, p.used, p.left])
    expect(on).toEqual([[0, 12, 2, 10], [10, 22, 1, 21], [21, 33, 2, 31]])
  })

  it('over-using never goes negative and does not create negative carry', () => {
    const many = Array.from({ length: 15 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`)
    const ps = gymPeriods(plan({ since: '2026-09-01', rollover: true, visits: 12 }), days(...many), d('2026-10-11'))
    expect([ps[0].used, ps[0].left, ps[1].carried, ps[1].total]).toEqual([15, 0, 0, 12])
  })

  it('periods before the plan was set up are not counted', () => {
    const ps = gymPeriods(plan({ since: '2026-10-05' }), days('2026-09-10', '2026-10-06'), d('2026-10-11'))
    expect(ps).toHaveLength(1)
    expect(ps[0].used).toBe(1) // the visit on Sep 10 predates the plan
  })

  it('a plan set up mid-period still counts earlier visits in that same period', () => {
    const ps = gymPeriods(plan({ since: '2026-10-09' }), days('2026-10-02', '2026-10-10'), d('2026-10-11'))
    expect(ps).toHaveLength(1)
    expect(ps[0].used).toBe(2) // the window is the whole period: history keeps the card honest
  })

  it('a "since" in the future (clock change) still yields the current period', () => {
    expect(gymPeriods(plan({ since: '2027-01-01' }), days(), d('2026-10-11'))).toHaveLength(1)
  })
})

describe('paceHint', () => {
  it('describes how to use up what is left', () => {
    expect(paceHint(0, 10)).toEqual({ kind: 'done' })
    expect(paceHint(5, 0)).toEqual({ kind: 'none' })
    expect(paceHint(5, 10)).toEqual({ kind: 'every', days: 2 })
    expect(paceHint(3, 10)).toEqual({ kind: 'every', days: 3 })
    expect(paceHint(10, 10)).toEqual({ kind: 'daily' })
    expect(paceHint(12, 10)).toEqual({ kind: 'tooMany', surplus: 2 })
    expect(paceHint(1, 1)).toEqual({ kind: 'daily' })
  })
})

describe('programIncludesRoutine', () => {
  it('finds routines in a rotation or a weekday schedule', () => {
    expect(programIncludesRoutine({ rotation: ['a', 'b'] }, 'b')).toBe(true)
    expect(programIncludesRoutine({ schedule: { 0: { 1: 'push' }, 1: { 3: 'pull' } } }, 'pull')).toBe(true)
    expect(programIncludesRoutine({ schedule: { 0: { 1: 'push' } }, rotation: [] }, 'legs')).toBe(false)
    expect(programIncludesRoutine({}, 'x')).toBe(false)
  })
})
