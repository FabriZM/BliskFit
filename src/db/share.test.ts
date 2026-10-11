import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { importPackage, previewImport } from './share'
import { validatePackage } from '../lib/share'

const pkg = (over: object = {}) => validatePackage({
  app: 'bliskfit-share', format: 1, kind: 'routine',
  routines: [{ name: 'Push', exercises: [
    { exerciseId: 'x:Have', targetSets: 3, supersetGroup: 'g' }, { exerciseId: 'c1', targetSets: 2, supersetGroup: 'g' },
    { exerciseId: 'x:Missing', targetSets: 4 }] }],
  exercises: [{ id: 'c1', name: 'Landmine press', trackingType: 'weight_reps', primaryMuscleIds: [], secondaryMuscleIds: [] }],
  ...over,
})

describe('importing shared routines', () => {
  beforeEach(async () => {
    await Promise.all([db.exercises.clear(), db.routines.clear(), db.programs.clear()])
    await db.exercises.add({ id: 'x:Have', name: 'Have', trackingType: 'weight_reps', primaryMuscleIds: [], secondaryMuscleIds: [], source: 'seeded' })
    await db.routines.add({ id: 'mine', name: 'Push', exercises: [], archived: false })
  })

  it('previews new custom exercises and unavailable ones', async () => {
    expect(await previewImport(pkg())).toEqual({ newExercises: ['Landmine press'], missing: 1 })
  })

  it('adds a new routine next to yours, creating custom exercises once', async () => {
    const res = await importPackage(pkg(), 1)
    expect(res.kind).toBe('routine')
    const r = await db.routines.get(res.id)
    expect(r?.exercises.map((e) => [e.exerciseId, e.targetSets, e.supersetGroup])).toEqual([['x:Have', 3, 'g'], ['c1', 2, 'g']])
    expect((await db.routines.get('mine'))?.exercises).toEqual([])
    expect((await db.exercises.get('c1'))?.source).toBe('custom')
    await importPackage(pkg(), 1)
    expect(await db.exercises.where('id').equals('c1').count()).toBe(1)
    expect((await db.routines.toArray()).map((x) => x.name).sort()).toEqual(['Push', 'Push (2)', 'Push (3)'])
  })

  it('adds a program with its own copies of the routines, inactive, starting this week', async () => {
    const now = new Date(2026, 9, 14, 12) // a Wednesday
    const p = pkg({
      kind: 'program',
      routines: [{ name: 'A', exercises: [{ exerciseId: 'x:Have', targetSets: 3 }] }, { name: 'B', exercises: [] }],
      program: { name: 'AB', weeks: 2, mode: 'weekday', schedule: { 0: { 1: 0, 3: 1 }, 1: { 1: 1 } } },
    })
    const res = await importPackage(p, 1, now)
    const prog = (await db.programs.get(res.id))!
    const byName = new Map((await db.routines.toArray()).map((r) => [r.name, r.id]))
    expect(prog.schedule).toEqual({ 0: { 1: byName.get('A'), 3: byName.get('B') }, 1: { 1: byName.get('B') } })
    expect(prog.startDate).toBe(new Date(2026, 9, 12).getTime())
    expect(prog.gymId).toBeUndefined()
    expect(await db.meta.get('activeProgramId')).toBeUndefined()

    const rot = await importPackage(pkg({ kind: 'program', routines: [{ name: 'A', exercises: [] }], program: { name: 'R', weeks: 1, mode: 'rotation', rotation: [0, 0] } }), 1)
    expect((await db.programs.get(rot.id))?.rotation).toHaveLength(1)
  })
})
