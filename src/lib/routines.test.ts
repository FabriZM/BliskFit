import { describe, expect, it } from 'vitest'
import type { Routine, RoutineExercise, SessionExercise, SetLog } from '../db/types'
import {
  addExercises, duplicateRoutine, groupPositions, linkWithNext, moveExercise, replaceExercise,
  normalizeGroups, removeExercise, routineUpdate, setRepRange, setRest, unlinkFromNext,
} from './routines'

const ex = (id: string, extra: Partial<RoutineExercise> = {}): RoutineExercise => ({ id, exerciseId: 'x' + id, targetSets: 3, ...extra })
const ids = (l: RoutineExercise[]) => l.map((e) => e.id).join('')
const groups = (l: RoutineExercise[]) => l.map((e) => (e.supersetGroup ? 'G' : '-')).join('')

describe('supersets', () => {
  it('links and merges neighbours into a circuit', () => {
    let l = [ex('a'), ex('b'), ex('c'), ex('d')]
    l = linkWithNext(l, 0)
    l = linkWithNext(l, 1)
    expect(groups(l)).toBe('GGG-')
    expect(new Set(l.slice(0, 3).map((e) => e.supersetGroup)).size).toBe(1)
    expect(groupPositions(l).map((p) => p.pos)).toEqual(['start', 'middle', 'end', 'single'])
  })

  it('unlinking splits a group and drops singletons', () => {
    let l = linkWithNext(linkWithNext([ex('a'), ex('b'), ex('c')], 0), 1)
    l = unlinkFromNext(l, 0)
    expect(groups(l)).toBe('-GG')
    l = unlinkFromNext(l, 1)
    expect(groups(l)).toBe('---')
  })

  it('shares the rest timer across a group', () => {
    let l = linkWithNext([ex('a'), ex('b'), ex('c')], 0)
    l = setRest(l, 0, 120)
    expect(l.map((e) => e.restSec)).toEqual([120, 120, undefined])
    l = setRest(l, 1, 60)
    expect(l.map((e) => e.restSec)).toEqual([60, 60, undefined])
  })

  it('extending a group keeps its shared rest', () => {
    let l = setRest(linkWithNext([ex('a'), ex('b'), ex('c')], 0), 0, 120)
    l = linkWithNext(l, 1)
    expect(l.map((e) => e.restSec)).toEqual([120, 120, 120])
    expect(setRest(l, 2, undefined).map((e) => e.restSec)).toEqual([undefined, undefined, undefined])
  })

  it('normalize takes the last member rest and splits non-contiguous runs', () => {
    const l = normalizeGroups([ex('a', { supersetGroup: 'g', restSec: 30 }), ex('b', { supersetGroup: 'g', restSec: 90 }),
      ex('c'), ex('d', { supersetGroup: 'g' }), ex('e', { supersetGroup: 'g' })])
    expect(l[0].restSec).toBe(90)
    expect(l[0].supersetGroup).not.toBe(l[3].supersetGroup)
    expect(groups(l)).toBe('GG-GG')
  })

  it('moving an exercise out of a group dissolves a leftover single', () => {
    let l = linkWithNext([ex('a'), ex('b'), ex('c')], 0)
    l = moveExercise(l, 1, 2)
    expect(ids(l)).toBe('acb')
    expect(groups(l)).toBe('---')
    expect(ids(moveExercise([ex('a'), ex('b'), ex('c')], 0, 2))).toBe('bca')
  })

  it('removal keeps groups valid', () => {
    const l = removeExercise(linkWithNext([ex('a'), ex('b'), ex('c')], 0), 0)
    expect(groups(l)).toBe('--')
  })
})

describe('routine helpers', () => {
  it('rep range stays ordered', () => {
    const e = ex('a', { repMin: 8, repMax: 12 })
    expect(setRepRange(e, { repMin: 15 })).toMatchObject({ repMin: 15, repMax: 15 })
    expect(setRepRange(e, { repMax: 5 })).toMatchObject({ repMin: 5, repMax: 5 })
  })

  it('defaults depend on tracking type', () => {
    const base = { id: '1', name: 'n', primaryMuscleIds: [] as string[], secondaryMuscleIds: [] as string[], source: 'custom' as const }
    const r: Routine = { id: 'r', name: 'R', exercises: [], archived: false }
    const out = addExercises(r, [
      { ...base, id: '1', trackingType: 'weight_reps' as const }, { ...base, id: '2', trackingType: 'duration' as const },
      { ...base, id: '3', trackingType: 'cardio' as const },
    ]).exercises
    expect(out.map((e) => [e.targetSets, e.repMin])).toEqual([[3, 8], [3, undefined], [1, undefined]])
  })

  it('duplicate gets fresh ids but keeps groups intact', () => {
    const r: Routine = { id: 'r', name: 'Push', archived: true, exercises: linkWithNext([ex('a'), ex('b'), ex('c')], 0) }
    const d = duplicateRoutine(r, 'Push (copy)')
    expect(d.id).not.toBe(r.id)
    expect(d.archived).toBe(false)
    expect(d.exercises.some((e) => r.exercises.some((o) => o.id === e.id))).toBe(false)
    expect(groups(d.exercises)).toBe('GG-')
    expect(d.exercises[0].supersetGroup).not.toBe(r.exercises[0].supersetGroup)
    expect(d.exercises[0].supersetGroup).toBe(d.exercises[1].supersetGroup)
  })
})

describe('replaceExercise', () => {
  const base = { name: 'n', primaryMuscleIds: [], secondaryMuscleIds: [], source: 'custom' as const }
  const r: Routine = { id: 'r', name: 'R', archived: false, exercises: [ex('a', { exerciseId: 'old', repMin: 5, repMax: 8 }), ex('b', { exerciseId: 'old' })] }
  it('replaces the first occurrence, or all', () => {
    expect(replaceExercise(r, 'old', { ...base, id: 'new', trackingType: 'weight_reps' }).exercises.map((e) => e.exerciseId)).toEqual(['new', 'old'])
    expect(replaceExercise(r, 'old', { ...base, id: 'new', trackingType: 'weight_reps' }, true).exercises.map((e) => e.exerciseId)).toEqual(['new', 'new'])
  })
  it('drops the rep range for time-based exercises', () => {
    const out = replaceExercise(r, 'old', { ...base, id: 'plank', trackingType: 'duration' }).exercises[0]
    expect(out.repMin).toBeUndefined()
  })
})

describe('routineUpdate', () => {
  const r = (id: string, exerciseId: string, extra: Partial<RoutineExercise> = {}): RoutineExercise => ({ id, exerciseId, targetSets: 3, repMin: 8, repMax: 12, ...extra })
  const routine: Routine = { id: 'R', name: 'Push', archived: false, exercises: [r('r1', 'bench'), r('r2', 'press', { restSec: 60 }), r('r3', 'dips')] }
  const it_ = (id: string, exerciseId: string, extra: Partial<SessionExercise> = {}): SessionExercise => ({ id, exerciseId, targetSets: 3, repMin: 8, repMax: 12, ...extra })
  const setsFor = (counts: Record<string, number>): SetLog[] =>
    Object.entries(counts).flatMap(([itemId, n]) => Array.from({ length: n }, (_, k) => ({ id: `${itemId}${k}`, sessionId: 's', itemId, exerciseId: 'x', order: k, setType: 'working' as const })))

  it('is null when the workout followed the plan, even with exercises skipped', () => {
    const items = [it_('a', 'bench'), it_('b', 'press', { skipped: true, restSec: 30 }), it_('c', 'dips')]
    expect(routineUpdate(routine, items, setsFor({ a: 3, b: 3, c: 3 }))).toBeNull()
  })

  it('reports order, added and removed exercises and set counts, keeping the routine\'s own fields', () => {
    const items = [it_('b', 'press'), it_('a', 'bench'), it_('x', 'flyes', { repMin: 10, repMax: 15 })]
    const u = routineUpdate(routine, items, setsFor({ b: 4, a: 3, x: 2 }))!
    expect(u).toMatchObject({ reordered: true, added: ['flyes'], removed: ['dips'], sets: [{ exerciseId: 'press', from: 3, to: 4 }] })
    expect(u.exercises.map((e) => [e.id === 'r2' || e.id === 'r1' ? e.id : 'new', e.exerciseId, e.targetSets])).toEqual([['r2', 'press', 4], ['r1', 'bench', 3], ['new', 'flyes', 2]])
    expect(u.exercises[0].restSec).toBe(60) // rests stay the routine's
    expect(u.exercises[2]).toMatchObject({ repMin: 10, repMax: 15 })
  })

  it('sees supersets linked during the workout as a change in order', () => {
    const items = [it_('a', 'bench', { supersetGroup: 'g' }), it_('b', 'press', { supersetGroup: 'g' }), it_('c', 'dips')]
    const u = routineUpdate(routine, items, setsFor({ a: 3, b: 3, c: 3 }))!
    expect(u.reordered).toBe(true)
    expect(u.exercises.map((e) => e.supersetGroup)).toEqual(['g', 'g', undefined])
  })
})
