import { describe, expect, it } from 'vitest'
import type { Program } from '../db/types'
import { copyWeekToAll, dayDiff, programWeek, pruneProgram, resizeSchedule, suggestToday, weekStart } from './programs'

const d = (s: string) => new Date(s + 'T12:00:00')
const MON = 1

describe('week maths', () => {
  it('aligns to the configured week start', () => {
    expect(weekStart(d('2026-10-10'), MON).getDate()).toBe(5) // Sat -> Mon Oct 5
    expect(weekStart(d('2026-10-10'), 0).getDate()).toBe(4) // Sunday start
    expect(weekStart(d('2026-10-05'), MON).getDate()).toBe(5)
  })
  it('counts days across DST changes', () => {
    expect(dayDiff(d('2026-03-07'), d('2026-03-09'))).toBe(2)
    expect(dayDiff(d('2026-10-31'), d('2026-11-02'))).toBe(2)
  })
  it('cycles through program weeks and handles not-started', () => {
    const start = d('2026-10-07').getTime() // Wed of week starting Mon Oct 5
    expect(programWeek(start, d('2026-10-05'), MON, 2)).toBe(0)
    expect(programWeek(start, d('2026-10-11'), MON, 2)).toBe(0)
    expect(programWeek(start, d('2026-10-12'), MON, 2)).toBe(1)
    expect(programWeek(start, d('2026-10-19'), MON, 2)).toBe(0)
    expect(programWeek(start, d('2026-10-04'), MON, 2)).toBeNull()
  })
})

describe('suggestToday', () => {
  const ppl: Program = {
    id: 'p', name: 'PPL', weeks: 1, mode: 'weekday', startDate: d('2026-10-05').getTime(),
    schedule: { 0: { 1: 'push', 3: 'pull', 5: 'legs' } },
  }
  it('weekday schedule picks the routine for today, rest otherwise', () => {
    expect(suggestToday({ program: ppl, sessions: [], today: d('2026-10-05'), weekStartDay: MON }))
      .toEqual({ kind: 'routine', routineId: 'push', mode: 'schedule', trainedToday: false })
    expect(suggestToday({ program: ppl, sessions: [], today: d('2026-10-06'), weekStartDay: MON })).toEqual({ kind: 'rest' })
    expect(suggestToday({ program: ppl, sessions: [], today: d('2026-09-30'), weekStartDay: MON }).kind).toBe('notStarted')
  })
  it('flags trained-today and ignores archived routines', () => {
    const sessions = [{ routineId: 'push', status: 'finished', startedAt: d('2026-10-05').getTime() }]
    expect(suggestToday({ program: ppl, sessions, today: d('2026-10-05'), weekStartDay: MON })).toMatchObject({ trainedToday: true })
    expect(suggestToday({ program: ppl, sessions: [], today: d('2026-10-05'), weekStartDay: MON, validRoutineIds: new Set(['pull']) }))
      .toEqual({ kind: 'rest' })
  })
  it('rotation advances from the last finished session regardless of the calendar', () => {
    const abc: Program = { id: 'r', name: 'ABC', weeks: 1, mode: 'rotation', rotation: ['a', 'b', 'c'] }
    const s = (routineId: string, day: string, status = 'finished') => ({ routineId, status, startedAt: d(day).getTime() })
    const today = d('2026-10-20')
    expect(suggestToday({ program: abc, sessions: [], today, weekStartDay: MON })).toMatchObject({ routineId: 'a' })
    expect(suggestToday({ program: abc, sessions: [s('a', '2026-10-01')], today, weekStartDay: MON })).toMatchObject({ routineId: 'b' })
    expect(suggestToday({ program: abc, sessions: [s('a', '2026-10-01'), s('c', '2026-10-03')], today, weekStartDay: MON })).toMatchObject({ routineId: 'a' })
    // unfinished sessions and unrelated routines don't move the rotation
    expect(suggestToday({ program: abc, sessions: [s('a', '2026-10-01'), s('b', '2026-10-02', 'active'), s('zzz', '2026-10-03')], today, weekStartDay: MON }))
      .toMatchObject({ routineId: 'b' })
  })
})

describe('schedule helpers', () => {
  it('resizes and copies weeks', () => {
    const s = { 0: { 1: 'push' } }
    expect(resizeSchedule(s, 3)).toEqual({ 0: { 1: 'push' }, 1: {}, 2: {} })
    expect(Object.keys(resizeSchedule(resizeSchedule(s, 3), 1))).toEqual(['0'])
    expect(copyWeekToAll(s, 2)).toEqual({ 0: { 1: 'push' }, 1: { 1: 'push' } })
  })
  it('prunes archived routines', () => {
    const p: Program = { id: 'p', name: 'x', weeks: 1, mode: 'weekday', schedule: { 0: { 1: 'a', 2: 'b' } }, rotation: ['a', 'b'] }
    const out = pruneProgram(p, new Set(['a']))
    expect(out.schedule).toEqual({ 0: { 1: 'a' } })
    expect(out.rotation).toEqual(['a'])
  })
})
