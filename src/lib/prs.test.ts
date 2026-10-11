import { describe, expect, it } from 'vitest'
import type { SetLog } from '../db/types'
import { computeAllPRs, computePRs, epley, exerciseRecords } from './prs'

let n = 0
const s = (t: number, extra: Partial<SetLog>): SetLog =>
  ({ id: `s${++n}`, sessionId: 'x', exerciseId: 'e', order: 0, setType: 'working', doneAt: t, ...extra })

describe('epley', () => {
  it('estimates 1RM and takes a single at face value', () => {
    expect(epley(100, 1)).toBe(100)
    expect(epley(100, 10)).toBeCloseTo(133.33, 2)
    expect(epley(60, 5)).toBeCloseTo(70, 5)
  })
})

describe('computePRs (weight x reps)', () => {
  it('the first sets are a baseline, not PRs', () => {
    expect(computePRs([s(1, { weight: 100, reps: 5 })], 'weight_reps').size).toBe(0)
  })

  it('flags weight, e1RM and volume for a heavier, stronger set', () => {
    const a = s(1, { weight: 100, reps: 5 })
    const b = s(2, { weight: 110, reps: 5 })
    const pr = computePRs([a, b], 'weight_reps')
    expect(pr.get(b.id)).toEqual(['weight', 'e1rm', 'volume'])
    expect(pr.has(a.id)).toBe(false)
  })

  it('flags reps only against an earlier set at the same load', () => {
    const a = s(1, { weight: 100, reps: 5 })
    const b = s(2, { weight: 100, reps: 6 })
    const c = s(3, { weight: 90, reps: 12 }) // first time at 90: no reps PR (but a lighter set can still be e1RM/volume)
    const pr = computePRs([a, b, c], 'weight_reps')
    expect(pr.get(b.id)).toContain('reps')
    expect(pr.get(c.id) ?? []).not.toContain('reps')
  })

  it('needs strictly better: ties are not PRs', () => {
    const pr = computePRs([s(1, { weight: 100, reps: 5 }), s(2, { weight: 100, reps: 5 })], 'weight_reps')
    expect(pr.size).toBe(0)
  })

  it('ignores warm-ups and undone sets, even heavy ones', () => {
    const warm = s(2, { weight: 200, reps: 5, setType: 'warmup' })
    const undone = s(3, { weight: 300, reps: 5, doneAt: undefined })
    const pr = computePRs([s(1, { weight: 100, reps: 5 }), warm, undone, s(4, { weight: 100, reps: 5 })], 'weight_reps')
    expect(pr.size).toBe(0)
  })

  it('does not depend on the order the sets are passed in', () => {
    const sets = [s(1, { weight: 100, reps: 5 }), s(2, { weight: 105, reps: 5 }), s(3, { weight: 110, reps: 3 }), s(4, { weight: 100, reps: 8 })]
    const a = computePRs(sets, 'weight_reps')
    const b = computePRs([...sets].reverse(), 'weight_reps')
    expect([...a.entries()].sort()).toEqual([...b.entries()].sort())
    expect(a.size).toBeGreaterThan(0)
  })

  it('editing history changes the flags (nothing is stored)', () => {
    const a = s(1, { weight: 100, reps: 5 })
    const b = s(2, { weight: 110, reps: 5 })
    expect(computePRs([a, b], 'weight_reps').has(b.id)).toBe(true)
    expect(computePRs([a, { ...b, weight: 90 }], 'weight_reps').has(b.id)).toBe(false) // edited down
    expect(computePRs([b], 'weight_reps').has(b.id)).toBe(false) // earlier set deleted -> baseline
    expect(computePRs([{ ...a, weight: 120 }, b], 'weight_reps').has(b.id)).toBe(false) // earlier set edited up
  })

  it('a heavier single beats a lighter high-rep set on weight but is judged on e1RM too', () => {
    const a = s(1, { weight: 80, reps: 12 }) // e1RM 112
    const b = s(2, { weight: 100, reps: 1 }) // e1RM 100: heavier, but not a stronger estimate
    expect(computePRs([a, b], 'weight_reps').get(b.id)).toEqual(['weight'])
  })

  it('handles unfilled weight or zero reps without crashing', () => {
    expect(computePRs([s(1, { reps: 5 }), s(2, { weight: 50, reps: 0 })], 'weight_reps').size).toBe(0)
  })
})

describe('other tracking types', () => {
  it('weighted bodyweight uses the added load (and bodyweight-only reps count at load 0)', () => {
    const a = s(1, { extraWeight: 0, reps: 8 })
    const b = s(2, { extraWeight: 0, reps: 10 })
    const c = s(3, { extraWeight: 10, reps: 5 })
    const pr = computePRs([a, b, c], 'bodyweight_added')
    expect(pr.get(b.id)).toEqual(['reps'])
    expect(pr.get(c.id)).toContain('weight')
  })
  it('bodyweight reps: most reps in a set', () => {
    const pr = computePRs([s(1, { reps: 10 }), s(2, { reps: 12 }), s(3, { reps: 12 })], 'bodyweight_reps')
    expect([...pr.values()]).toEqual([['reps']])
  })
  it('duration: longest hold', () => {
    const b = s(2, { durationSec: 75 })
    expect(computePRs([s(1, { durationSec: 60 }), b], 'duration').get(b.id)).toEqual(['duration'])
  })
  it('assisted and cardio have none yet', () => {
    expect(computePRs([s(1, { extraWeight: 20, reps: 5 }), s(2, { extraWeight: 10, reps: 5 })], 'assisted_bodyweight').size).toBe(0)
    expect(computePRs([s(1, { durationSec: 600 }), s(2, { durationSec: 900 })], 'cardio').size).toBe(0)
  })
})

describe('exerciseRecords', () => {
  it('reports current bests, with the earliest set holding a tied record', () => {
    const a = s(1, { weight: 100, reps: 5 })
    const b = s(2, { weight: 100, reps: 5 })
    const c = s(3, { weight: 90, reps: 10 })
    const r = exerciseRecords([c, b, a, s(4, { weight: 200, reps: 3, setType: 'warmup' })], 'weight_reps')
    expect(r.heaviest).toMatchObject({ value: 100, set: { id: a.id } })
    expect(r.e1rm?.value).toBeCloseTo(Math.max(epley(100, 5), epley(90, 10)), 5)
    expect(r.volume?.value).toBe(900)
    expect(r.repsAtLoad.map((x) => [x.load, x.reps])).toEqual([[100, 5], [90, 10]])
  })
  it('is empty without history', () => {
    expect(exerciseRecords([], 'weight_reps')).toEqual({ repsAtLoad: [] })
  })
})

describe('computeAllPRs', () => {
  it('keeps exercises separate', () => {
    const a1 = s(1, { exerciseId: 'a', weight: 100, reps: 5 }), b1 = s(2, { exerciseId: 'b', weight: 20, reps: 5 })
    const a2 = s(3, { exerciseId: 'a', weight: 110, reps: 5 }), b2 = s(4, { exerciseId: 'b', weight: 20, reps: 5 })
    const pr = computeAllPRs([a1, b1, a2, b2], () => 'weight_reps')
    expect([...pr.keys()]).toEqual([a2.id])
  })
})
