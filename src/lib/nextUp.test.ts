import { describe, expect, it } from 'vitest'
import type { SessionExercise, SetLog } from '../db/types'
import { nextSet, setName, valuesToLog } from './nextUp'
import type { LastTime } from './workout'

let n = 0
const item = (id: string, extra: Partial<SessionExercise> = {}): SessionExercise => ({ id, exerciseId: `e-${id}`, targetSets: 3, ...extra })
const set = (itemId: string, order: number, extra: Partial<SetLog> = {}): SetLog =>
  ({ id: `${itemId}${order}${extra.setType ?? ''}`, sessionId: 's', exerciseId: `e-${itemId}`, itemId, order, setType: 'working', ...extra })
const done = (s: SetLog): SetLog => ({ ...s, doneAt: ++n })

describe('nextSet', () => {
  it('continues the exercise of the last done set, else the first set not done in plan order', () => {
    const items = [item('a'), item('b')]
    const a = [set('a', 0), set('a', 1)], b = [set('b', 0), set('b', 1)]
    expect(nextSet(items, [...a, ...b])?.id).toBe('a0')
    // Started with b: stays on b even though a has sets left.
    expect(nextSet(items, [...a, done(b[0]), b[1]])?.id).toBe('b1')
    // b finished: back to the first set left.
    expect(nextSet(items, [...a, done(b[0]), done(b[1])])?.id).toBe('a0')
    expect(nextSet(items, [...a, ...b].map(done))).toBeUndefined()
  })

  it('alternates within a superset round by round (A1, B1, A2…)', () => {
    const items = [item('a', { supersetGroup: 'g' }), item('b', { supersetGroup: 'g' }), item('c')]
    const a = [set('a', 0), set('a', 1)], b = [set('b', 0), set('b', 1)]
    expect(nextSet(items, [done(a[0]), a[1], ...b])?.id).toBe('b0')
    expect(nextSet(items, [done(a[0]), a[1], done(b[0]), b[1]])?.id).toBe('a1')
  })

  it('leaves skipped exercises out', () => {
    expect(nextSet([item('a', { skipped: true }), item('b')], [set('a', 0), set('b', 0)])?.id).toBe('b0')
  })
})

describe('setName and valuesToLog', () => {
  const sets = [set('a', 0, { setType: 'warmup' }), set('a', 1), set('a', 2), set('a', 3, { setType: 'drop' })]
  const last: LastTime = { sessionId: 'old', startedAt: 0, gymMatched: true, sets: [
    set('x', 0, { weight: 80, reps: 8 }), set('x', 1, { weight: 85, reps: 6, unit: 'lb' }),
  ] }

  it('names working sets by number among non-warm-ups', () => {
    expect(sets.map((s) => setName(s, sets))).toEqual([{ kind: 'warmup' }, { kind: 'working', n: 1 }, { kind: 'working', n: 2 }, { kind: 'drop' }])
  })

  it('logs what was typed, else last time\'s matching set, else nothing', () => {
    expect(valuesToLog({ ...sets[1], weight: 60, reps: 10 }, sets, 'weight_reps', last, 'kg')).toMatchObject({ weight: 60, reps: 10 })
    expect(valuesToLog(sets[1], sets, 'weight_reps', last, 'kg')).toEqual({ weight: 80, reps: 8, unit: 'kg' })
    expect(valuesToLog(sets[2], sets, 'weight_reps', last, 'kg')).toMatchObject({ weight: 85, unit: 'lb' })
    expect(valuesToLog(sets[0], sets, 'weight_reps', last, 'kg')).toBeUndefined() // warm-ups have no "previous"
    expect(valuesToLog(sets[1], sets, 'weight_reps', undefined, 'kg')).toBeUndefined()
  })
})
