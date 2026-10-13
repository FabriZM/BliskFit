import { describe, expect, it } from 'vitest'
import type { Exercise, SessionExercise, SetLog, WorkoutSession } from '../db/types'
import {
  FORGOTTEN_MS, elapsedMs, fillFollowing, finalizeSession, forgottenDueAt, forgottenEndTime, isFilled, isForgotten,
  muscleSetCounts, pauseSession, pickLastTime, restAfterSet, restFor, restKindAfter, resumeSession, sessionStats, shouldStartRest,
} from './workout'

const MIN = 60_000, H = 60 * MIN
const session = (extra: Partial<WorkoutSession> = {}): WorkoutSession =>
  ({ id: 's', startedAt: 0, status: 'active', pausedIntervals: [], exercises: [], ...extra })
const set = (extra: Partial<SetLog> = {}): SetLog =>
  ({ id: Math.random().toString(), sessionId: 's', exerciseId: 'e', order: 0, setType: 'working', ...extra })

describe('session time', () => {
  it('excludes paused time from the duration', () => {
    let s = session()
    s = pauseSession(s, 10 * MIN)
    expect(elapsedMs(s, 25 * MIN)).toBe(10 * MIN) // frozen while paused
    s = resumeSession(s, 30 * MIN)
    expect(elapsedMs(s, 40 * MIN)).toBe(20 * MIN)
    expect(s.status).toBe('active')
  })
  it('finishing while paused closes the interval', () => {
    const s = finalizeSession(pauseSession(session(), 10 * MIN), 50 * MIN)
    expect(s.pausedIntervals).toEqual([{ start: 10 * MIN, end: 50 * MIN }])
    expect(elapsedMs(s, 999 * MIN)).toBe(10 * MIN)
  })
  it('handles multiple pauses and a pause-after-end edge', () => {
    let s = session({ pausedIntervals: [{ start: 10 * MIN, end: 20 * MIN }, { start: 30 * MIN, end: 35 * MIN }] })
    expect(elapsedMs(s, 60 * MIN)).toBe(45 * MIN)
    s = finalizeSession(pauseSession(session(), 90 * MIN), 60 * MIN)
    expect(elapsedMs(s, 0)).toBe(60 * MIN)
  })
})

describe('forgotten session', () => {
  it('fires 2h after the last set, not the start', () => {
    const s = session()
    const sets = [set({ doneAt: 30 * MIN })]
    expect(isForgotten(s, sets, 30 * MIN + FORGOTTEN_MS - 1)).toBe(false)
    expect(isForgotten(s, sets, 30 * MIN + FORGOTTEN_MS)).toBe(true)
    expect(forgottenEndTime(s, sets)).toBe(30 * MIN)
    expect(forgottenEndTime(s, [])).toBe(0)
  })
  it('does not count paused time', () => {
    const s = session({ pausedIntervals: [{ start: 10 * MIN, end: 10 * MIN + 3 * H }] })
    expect(isForgotten(s, [], 3 * H)).toBe(false)
    expect(isForgotten(s, [], 10 * MIN + 3 * H + 2 * H - 10 * MIN)).toBe(true)
  })
  it('"keep going" restarts the clock; finished sessions never prompt', () => {
    const s = session({ forgotAckAt: 3 * H })
    expect(isForgotten(s, [], 4 * H)).toBe(false)
    expect(isForgotten(s, [], 5 * H)).toBe(true)
    expect(isForgotten(session({ status: 'finished' }), [], 99 * H)).toBe(false)
  })
  it('computes when a notification is due', () => {
    expect(forgottenDueAt(session(), [set({ doneAt: 10 * MIN })], 40 * MIN)).toBe(10 * MIN + FORGOTTEN_MS)
    expect(forgottenDueAt(pauseSession(session(), 5), [], 10)).toBeUndefined()
  })
})

describe('sets', () => {
  it('requires the right fields per tracking type', () => {
    expect(isFilled(set({ weight: 0, reps: 5 }), 'weight_reps')).toBe(true)
    expect(isFilled(set({ reps: 5 }), 'weight_reps')).toBe(false)
    expect(isFilled(set({ reps: 5 }), 'bodyweight_added')).toBe(true)
    expect(isFilled(set({ reps: 0 }), 'bodyweight_reps')).toBe(false)
    expect(isFilled(set({ durationSec: 30 }), 'duration')).toBe(true)
    expect(isFilled(set({ distanceM: 1000 }), 'cardio')).toBe(false)
  })
  it('stats skip warm-ups and undone sets; volume follows tracking type', () => {
    const sets = [
      set({ exerciseId: 'bench', weight: 100, reps: 5, doneAt: 1 }),
      set({ exerciseId: 'bench', weight: 60, reps: 10, doneAt: 2, setType: 'warmup' }),
      set({ exerciseId: 'bench', weight: 100, reps: 5 }),
      set({ exerciseId: 'pull', extraWeight: 10, reps: 6, doneAt: 3 }),
      set({ exerciseId: 'plank', durationSec: 60, doneAt: 4 }),
    ]
    const t = (id: string) => (id === 'bench' ? 'weight_reps' : id === 'pull' ? 'bodyweight_added' : 'duration') as 'weight_reps'
    expect(sessionStats(sets, t)).toEqual({ sets: 3, volume: 500 + 60, exercises: 3 })
  })
  it('counts primary fully and secondary partially, ignoring warm-ups', () => {
    const ex = new Map<string, Exercise>([['b', { id: 'b', name: 'Bench', trackingType: 'weight_reps', primaryMuscleIds: ['chest'], secondaryMuscleIds: ['triceps'], source: 'seeded' }]])
    const c = muscleSetCounts([set({ exerciseId: 'b', doneAt: 1 }), set({ exerciseId: 'b', doneAt: 2 }), set({ exerciseId: 'b', doneAt: 3, setType: 'warmup' }), set({ exerciseId: 'b' })], ex)
    expect(c.get('chest')).toBe(2)
    expect(c.get('triceps')).toBe(1)
  })
})

describe('pickLastTime', () => {
  const fin = (id: string, startedAt: number, gymId?: string): WorkoutSession => session({ id, startedAt, status: 'finished', gymId })
  const sessions = new Map([['a', fin('a', 100, 'gym1')], ['b', fin('b', 200, 'gym2')], ['c', fin('c', 300)], ['live', session({ id: 'live', startedAt: 400 })]])
  const logs = ['a', 'b', 'c', 'live'].flatMap((sid, i) => [
    set({ sessionId: sid, order: 1, weight: 10 + i, reps: 5, doneAt: 1 }),
    set({ sessionId: sid, order: 0, weight: 20 + i, reps: 5, doneAt: 1 }),
  ])
  it('with no gym uses the most recent finished session, in set order', () => {
    const l = pickLastTime({ logs, sessions, excludeSessionId: 'live' })!
    expect(l.sessionId).toBe('c')
    expect(l.sets.map((x) => x.weight)).toEqual([22, 12])
    expect(l.gymMatched).toBe(false)
  })
  it('prefers the same gym, falls back to any gym when it has no history', () => {
    expect(pickLastTime({ logs, sessions, gymId: 'gym1', excludeSessionId: 'live' })).toMatchObject({ sessionId: 'a', gymMatched: true })
    expect(pickLastTime({ logs, sessions, gymId: 'gym3', excludeSessionId: 'live' })).toMatchObject({ sessionId: 'c', gymMatched: false })
  })
  it('ignores warm-ups, undone sets and unfinished sessions', () => {
    const only = [set({ sessionId: 'a', doneAt: 1, setType: 'warmup' }), set({ sessionId: 'b' }), set({ sessionId: 'live', doneAt: 1 })]
    expect(pickLastTime({ logs: only, sessions })).toBeUndefined()
  })
})

describe('rest', () => {
  const item = (extra: Partial<SessionExercise> = {}): SessionExercise => ({ id: 'i', exerciseId: 'e', targetSets: 3, ...extra })
  const ex = (extra: Partial<Exercise> = {}): Exercise => ({ id: 'e', name: 'x', trackingType: 'weight_reps', primaryMuscleIds: [], secondaryMuscleIds: [], source: 'custom', ...extra })
  const D = { working: 90, drop: 15, warmup: 45 }
  it('your saved "always" value beats the exercise default, but not a routine/session override', () => {
    expect(restFor(item({ restSec: 45 }), ex({ customRestSec: 150 }), D)).toEqual({ sec: 45, source: 'routine' })
    expect(restFor(item(), ex({ customRestSec: 150, defaultRestSec: 60 }), D)).toEqual({ sec: 150, source: 'custom' })
    expect(restFor(item(), ex({ customRestSec: 0 }), D)).toEqual({ sec: 0, source: 'custom' }) // 0 = no timer, not "unset"
    expect(restFor(item(), ex({ defaultRestSec: 60 }), D)).toEqual({ sec: 60, source: 'exercise' })
    expect(restFor(item(), undefined, D)).toEqual({ sec: 90, source: 'default' })
  })
  it('drop and warm-up timers resolve the same way, each on its own', () => {
    const e = ex({ customRestSec: 150, customDropRestSec: 5, defaultRestSec: 60 })
    expect(restFor(item(), e, D, 'drop')).toEqual({ sec: 5, source: 'custom' })
    expect(restFor(item(), e, D, 'warmup')).toEqual({ sec: 45, source: 'default' }) // the exercise default is for working sets
    expect(restFor(item({ restSec: 30, warmupRestSec: 20 }), e, D, 'warmup')).toEqual({ sec: 20, source: 'routine' })
  })
  it('times the rest for the set coming next; failure sets are working sets', () => {
    const sorted = [set({ id: 'w1', setType: 'warmup' }), set({ id: 'w2', setType: 'warmup' }), set({ id: 'a', failure: true }), set({ id: 'd', setType: 'drop' })]
    expect([0, 1, 2, 3].map((i) => restKindAfter(sorted, i))).toEqual(['warmup', 'working', 'drop', 'working'])
    const it_ = item({ id: 'x' })
    expect(restAfterSet(sorted, 1, it_, ex({ customWarmupRestSec: 30 }), D, [it_])).toBe(90) // the last warm-up gets the full rest
    expect(restAfterSet(sorted, 2, it_, ex({ customDropRestSec: 0 }), D, [it_])).toBeNull() // 0 = no timer
  })
  it('rests once per round of a superset, after its last member', () => {
    const items = [item({ id: 'a', supersetGroup: 'g' }), item({ id: 'b', supersetGroup: 'g' }), item({ id: 'c' })]
    expect(shouldStartRest(items, 'a')).toBe(false)
    expect(shouldStartRest(items, 'b')).toBe(true)
    expect(shouldStartRest(items, 'c')).toBe(true)
    expect(shouldStartRest([items[0], { ...items[1], skipped: true }], 'a')).toBe(true)
  })
})

describe('fillFollowing', () => {
  const s = (id: string, extra: Partial<SetLog> = {}): SetLog => ({ id, sessionId: 'x', exerciseId: 'e', order: 0, setType: 'working', ...extra })

  it('copies a typed value to later blank sets of the same type, marked as copied', () => {
    const sorted = [s('w', { setType: 'warmup' }), s('a'), s('b', { reps: 5 }), s('c', { doneAt: 1 }), s('d', { setType: 'drop' }), s('e', { weight: 70 }), s('f')]
    // A done set with no weight doesn't stop it; e's own weight does (f copies e from now on).
    expect(fillFollowing(sorted, 1, { weight: 80, unit: 'kg' })).toEqual([{ id: 'b', patch: { weight: 80, unit: 'kg', copied: ['weight'] } }])
    expect(fillFollowing(sorted, 1, { reps: 8 })).toEqual([]) // b typed its own reps: the ones after follow b
  })

  it('keeps copies in step, but never a value typed on the set itself, even an equal one', () => {
    const sorted = [s('a', { weight: 8 }), s('b', { weight: 8, copied: ['weight'] }), s('c', { weight: 8 })]
    expect(fillFollowing(sorted, 0, { weight: 80 })).toEqual([{ id: 'b', patch: { weight: 80, copied: ['weight'] } }])
    expect(fillFollowing(sorted, 0, { weight: undefined })).toEqual([{ id: 'b', patch: { weight: undefined, copied: undefined } }])
  })

  it('stops at a set with its own value (typed or done): the copies after it are that set\'s', () => {
    const sorted = [s('a'), s('b', { weight: 85 }), s('c', { weight: 85, copied: ['weight'] })]
    expect(fillFollowing(sorted, 0, { weight: 90 })).toEqual([])
    const done = [s('a'), s('b', { weight: 85, copied: ['weight'], doneAt: 1 }), s('c', { weight: 85, copied: ['weight'] })]
    expect(fillFollowing(done, 0, { weight: 90 })).toEqual([])
  })

  it('never touches earlier sets, and warm-ups only fill warm-ups', () => {
    expect(fillFollowing([s('a'), s('b')], 1, { weight: 80 })).toEqual([])
    const sorted = [s('w1', { setType: 'warmup' }), s('w2', { setType: 'warmup' }), s('a')]
    expect(fillFollowing(sorted, 0, { weight: 40 }).map((x) => x.id)).toEqual(['w2'])
  })
})
