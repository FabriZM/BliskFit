import { describe, expect, it } from 'vitest'
import type { ExerciseLite, SessionLite } from './stats'
import {
  changeOver, exerciseSeries, exercisesAtSeveralGyms, gymComparison, gymsUsed, isPlateau, metricPoints, metricsFor, muscleCredit,
  pushPull, rangeStart, rollUp, sumMuscles, trend, underTrained, weekBuckets, weekSeries,
} from './stats'
import type { ExercisePoint } from './stats'
import type { SetLog } from '../db/types'

const DAY = 86_400_000
const at = (day: string, h = 18) => new Date(`${day}T${String(h).padStart(2, '0')}:00:00`).getTime()
let n = 0
const set = (sessionId: string, exerciseId: string, p: Partial<SetLog> = {}): SetLog => ({
  id: `s${n++}`, sessionId, exerciseId, order: 0, setType: 'working', doneAt: 1, ...p,
})
const session = (id: string, day: string, extra: Partial<SessionLite> = {}): SessionLite => ({ id, startedAt: at(day), status: 'finished', ...extra })

describe('rangeStart', () => {
  const today = new Date('2026-10-14T15:00:00')
  it('covers 4 weeks inclusive of today, months and years back, and all', () => {
    expect(rangeStart('4w', today)).toEqual(new Date('2026-09-17T00:00:00'))
    expect(rangeStart('3m', today)).toEqual(new Date('2026-07-14T00:00:00'))
    expect(rangeStart('6m', today)).toEqual(new Date('2026-04-14T00:00:00'))
    expect(rangeStart('1y', today)).toEqual(new Date('2025-10-14T00:00:00'))
    expect(rangeStart('all', today)).toBeUndefined()
  })
})

describe('exerciseSeries', () => {
  const sessions = [session('a', '2026-10-01'), session('b', '2026-10-08'), session('c', '2026-10-15', { status: 'active' })]

  it('derives max weight, e1RM, volume and reps per finished session, ignoring warm-ups and unfinished sessions', () => {
    const sets = [
      set('a', 'x', { weight: 100, reps: 5 }), set('a', 'x', { weight: 80, reps: 10 }),
      set('a', 'x', { weight: 200, reps: 1, setType: 'warmup' }),
      set('b', 'x', { weight: 110, reps: 3 }),
      set('c', 'x', { weight: 300, reps: 1 }),
      set('a', 'other', { weight: 999, reps: 1 }),
    ]
    const pts = exerciseSeries(sets, sessions, 'x', 'weight_reps')
    expect(pts.map((p) => p.sessionId)).toEqual(['a', 'b'])
    expect(pts[0].values).toMatchObject({ maxWeight: 100, volume: 1300, reps: 15 })
    expect(pts[0].values.e1rm).toBeCloseTo(116.67, 1) // 100x5 beats 80x10 (106.7)
    expect(pts[1].values.e1rm).toBeCloseTo(121, 5)    // 110x3
  })

  it('uses added weight for weighted bodyweight and the lowest assistance for assisted lifts', () => {
    const w = exerciseSeries([set('a', 'd', { extraWeight: 10, reps: 5 })], sessions, 'd', 'bodyweight_added')
    expect(w[0].values.maxWeight).toBe(10)
    const a = exerciseSeries([set('a', 'd', { extraWeight: 30, reps: 5 }), set('a', 'd', { extraWeight: 20, reps: 4 })], sessions, 'd', 'assisted_bodyweight')
    expect(a[0].values).toEqual({ minAssist: 20, reps: 9 })
    expect(metricsFor('assisted_bodyweight')).toEqual(['minAssist', 'reps'])
  })

  it('measures time, distance and pace for duration and cardio', () => {
    const d = exerciseSeries([set('a', 'p', { durationSec: 60 }), set('a', 'p', { durationSec: 90 })], sessions, 'p', 'duration')
    expect(d[0].values).toEqual({ bestDuration: 90, totalDuration: 150 })
    const c = exerciseSeries([set('a', 'r', { durationSec: 1800, distanceM: 5000 })], sessions, 'r', 'cardio')
    expect(c[0].values).toEqual({ totalDuration: 1800, distance: 5000, pace: 360 })
  })

  it('filters points to a range', () => {
    const pts = exerciseSeries([set('a', 'x', { weight: 50, reps: 5 }), set('b', 'x', { weight: 60, reps: 5 })], sessions, 'x', 'weight_reps')
    expect(metricPoints(pts, 'maxWeight', new Date('2026-10-05T00:00:00')).map((p) => p.value)).toEqual([60])
  })
})

describe('isPlateau', () => {
  const pts = (...vals: number[]): ExercisePoint[] => vals.map((v, i) => ({ sessionId: `s${i}`, at: i * 10 * DAY, values: { e1rm: v } }))
  it('flags a flat stretch once there are enough sessions over enough weeks', () => {
    expect(isPlateau(pts(100, 100, 100, 100, 100), 'e1rm', 5)).toBe(true)
    expect(isPlateau(pts(100, 90, 99, 98, 100, 97), 'e1rm', 5)).toBe(true) // never beat the earlier 100
  })
  it('does not flag progress', () => {
    expect(isPlateau(pts(100, 101, 102, 103, 104), 'e1rm', 5)).toBe(false)
    expect(isPlateau(pts(100, 100, 100, 100, 105), 'e1rm', 5)).toBe(false)
  })
  it('needs enough sessions spread over at least three weeks', () => {
    expect(isPlateau(pts(100, 100, 100, 100), 'e1rm', 5)).toBe(false)
    const tight = [1, 2, 3, 4, 5].map((i): ExercisePoint => ({ sessionId: `t${i}`, at: i * DAY, values: { e1rm: 100 } }))
    expect(isPlateau(tight, 'e1rm', 5)).toBe(false)
  })
  it('treats lower as better for assisted lifts', () => {
    const a = [25, 30, 25, 25, 25, 25].map((v, i): ExercisePoint => ({ sessionId: `a${i}`, at: i * 10 * DAY, values: { minAssist: v } }))
    expect(isPlateau(a, 'minAssist', 5)).toBe(true)
    const b = [30, 30, 28, 26, 24, 22].map((v, i): ExercisePoint => ({ sessionId: `b${i}`, at: i * 10 * DAY, values: { minAssist: v } }))
    expect(isPlateau(b, 'minAssist', 5)).toBe(false)
  })
})

describe('weekly buckets and muscle credit', () => {
  const chest = 'm:chest', triceps = 'm:triceps', shoulders = 'm:shoulders', biceps = 'm:biceps', lats = 'm:lats'
  const muscles = [
    { id: chest }, { id: shoulders }, { id: 'm:arms' }, { id: triceps, parentId: 'm:arms' }, { id: biceps, parentId: 'm:arms' },
    { id: 'm:back' }, { id: lats, parentId: 'm:back' },
  ]
  const ex = new Map<string, ExerciseLite>([
    ['bench', { id: 'bench', trackingType: 'weight_reps', primaryMuscleIds: [chest], secondaryMuscleIds: [triceps, shoulders] }],
    ['row', { id: 'row', trackingType: 'weight_reps', primaryMuscleIds: [lats], secondaryMuscleIds: [biceps] }],
    ['pull', { id: 'pull', trackingType: 'bodyweight_reps', primaryMuscleIds: [lats], secondaryMuscleIds: [] }],
  ])

  it('gives primary muscles full credit and secondary ones half; primary wins when both', () => {
    expect(Object.fromEntries(muscleCredit({ primaryMuscleIds: ['a'], secondaryMuscleIds: ['a', 'b'] }))).toEqual({ a: 1, b: 0.5 })
  })

  it('splits sets and volume by credit and groups them by the week the session started (weeks start Monday)', () => {
    const sessions = [session('a', '2026-10-05'), session('b', '2026-10-11'), session('c', '2026-10-12'), session('d', '2026-10-13', { status: 'active' })]
    const sets = [
      set('a', 'bench', { weight: 100, reps: 10 }), set('a', 'bench', { weight: 100, reps: 10 }),
      set('b', 'row', { weight: 50, reps: 10 }),
      set('c', 'pull', { reps: 8 }),
      set('d', 'bench', { weight: 100, reps: 10 }),
    ]
    const buckets = weekBuckets(sessions, sets, ex, 1, new Set([sets[0].id]))
    expect([...buckets.keys()].sort()).toEqual(['2026-10-05', '2026-10-12'])
    const w1 = buckets.get('2026-10-05')!
    expect(w1.sessions).toBe(2) // Mon 5th and Sun 11th share a week
    expect(w1.sets).toBe(3)
    expect(w1.prs).toBe(1)
    expect(w1.volume).toBe(2500)
    expect(w1.muscle.get(chest)).toEqual({ sets: 2, volume: 2000 })
    expect(w1.muscle.get(triceps)).toEqual({ sets: 1, volume: 1000 })
    expect(w1.muscle.get(lats)).toEqual({ sets: 1, volume: 500 })
    expect(buckets.get('2026-10-12')!.sets).toBe(1) // the active session is ignored
    expect(buckets.get('2026-10-12')!.volume).toBe(0) // bodyweight reps carry no volume
  })

  it('fills empty weeks in a series and respects the range start', () => {
    const buckets = weekBuckets([session('a', '2026-09-21')], [set('a', 'bench', { weight: 1, reps: 1 })], ex, 1)
    const all = weekSeries(buckets, 1, new Date('2026-10-14T12:00:00'))
    expect(all.map((w) => w.key)).toEqual(['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12'])
    expect(all.map((w) => w.sets)).toEqual([1, 0, 0, 0])
    expect(weekSeries(buckets, 1, new Date('2026-10-14T12:00:00'), new Date('2026-10-01T00:00:00')).map((w) => w.key)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12'])
    expect(weekSeries(new Map(), 1, new Date('2026-10-14T12:00:00')).map((w) => w.key)).toEqual(['2026-10-12'])
  })

  it('rolls muscles up into their groups, finds under-trained groups and the push/pull split', () => {
    const buckets = weekBuckets([session('a', '2026-10-05')], [
      ...Array.from({ length: 4 }, () => set('a', 'bench', { weight: 1, reps: 1 })),
      ...Array.from({ length: 6 }, () => set('a', 'row', { weight: 1, reps: 1 })),
    ], ex, 1)
    const direct = sumMuscles([...buckets.values()])
    const totals = rollUp(direct, muscles)
    expect(totals.get('m:arms')!.sets).toBe(2 + 3) // triceps from bench, biceps from row
    expect(totals.get('m:back')!.sets).toBe(6)
    expect(totals.get(chest)!.sets).toBe(4)
    expect(underTrained(totals, muscles, 1, 5).map((u) => u.muscleId)).toEqual([shoulders, chest]) // arms has exactly 5
    expect(underTrained(totals, muscles, 1, 5).find((u) => u.muscleId === 'm:back')).toBeUndefined()
    expect(underTrained(totals, muscles, 2, 5).find((u) => u.muscleId === 'm:back')?.perWeek).toBe(3)
    // push: chest 4 + triceps 2 + shoulders 2; pull: lats 6 + biceps 3
    expect(pushPull(direct, muscles)).toEqual({ push: 8, pull: 9 })
  })
})

describe('trend and change', () => {
  it('smooths with an exponential moving average so one odd weigh-in barely moves the line', () => {
    const pts = [80, 80, 80, 85, 80].map((value, i) => ({ at: i * DAY, value }))
    const t = trend(pts)
    expect(t[0].value).toBe(80)
    expect(t[3].value).toBeCloseTo(81, 5)
    expect(Math.max(...t.map((p) => p.value))).toBeLessThan(82)
    expect(t).toHaveLength(5)
  })
  it('reports the change between first and last point', () => {
    expect(changeOver([])).toBeUndefined()
    expect(changeOver([{ at: 1, value: 80 }, { at: 2, value: 78.5 }])).toEqual({ first: 80, last: 78.5, delta: -1.5 })
  })
})

describe('gym comparison', () => {
  const sessions = [session('a', '2026-10-01', { gymId: 'g1' }), session('b', '2026-10-02', { gymId: 'g2' }), session('c', '2026-10-03'), session('d', '2026-10-04', { gymId: 'g1' })]
  const sets = [
    set('a', 'x', { weight: 100, reps: 5 }), set('b', 'x', { weight: 90, reps: 5 }), set('c', 'x', { weight: 200, reps: 5 }),
    set('d', 'x', { weight: 110, reps: 5 }), set('a', 'y', { weight: 10, reps: 5 }),
  ]
  it('knows how many gyms were used and which exercises were done at two or more', () => {
    expect(gymsUsed(sessions).sort()).toEqual(['g1', 'g2'])
    expect(gymsUsed([sessions[0], sessions[2]])).toEqual(['g1'])
    expect([...exercisesAtSeveralGyms(sets, sessions)]).toEqual(['x'])
  })
  it('compares best set, e1RM and volume per gym and leaves out sessions without a gym', () => {
    const r = gymComparison(sets, sessions, 'x', 'weight_reps')
    expect(r.map((g) => g.gymId)).toEqual(['g1', 'g2'])
    expect(r[0].sessions).toBe(2)
    expect(r[0].bestSet?.weight).toBe(110)
    expect(r[0].bestE1rm).toBeCloseTo(110 * (1 + 5 / 30), 5)
    expect(r[0].avgVolume).toBe((500 + 550) / 2)
    expect(r[1].bestSet?.weight).toBe(90)
  })
})
