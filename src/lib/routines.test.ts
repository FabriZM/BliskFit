import { describe, expect, it } from 'vitest'
import type { Routine, RoutineExercise } from '../db/types'
import {
  addExercises, duplicateRoutine, groupPositions, linkWithNext, moveExercise,
  normalizeGroups, removeExercise, setRepRange, setRest, unlinkFromNext,
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
