import { describe, expect, it } from 'vitest'
import type { Exercise, Program, Routine } from '../db/types'
import { ShareError, androidAppIntent, decodeLinkData, encodeLinkData, linkDataFrom, packProgram, packRoutine, shareFileName, validatePackage } from './share'

const custom: Exercise = {
  id: 'c1', name: 'Landmine press', trackingType: 'weight_reps', primaryMuscleIds: ['m:shoulders'], secondaryMuscleIds: [],
  source: 'custom', photo: new Blob([new Uint8Array(3)]), customDropRestSec: 77, videoUrl: 'https://youtu.be/x',
}
const seeded: Exercise = { id: 'x:Squat', name: 'Squat', trackingType: 'weight_reps', primaryMuscleIds: [], secondaryMuscleIds: [], source: 'seeded' }
const exercises = new Map([[custom.id, custom], [seeded.id, seeded]])
const routine = (id: string, name: string, exIds: string[]): Routine =>
  ({ id, name, archived: false, exercises: exIds.map((e, i) => ({ id: `${id}-${i}`, exerciseId: e, targetSets: 3, repMin: 8, repMax: 12 })) })
const reason = (fn: () => unknown) => { try { fn(); return 'ok' } catch (e) { return (e as ShareError).reason } }

describe('sharing routines and programs', () => {
  it('packs a routine with only its custom exercises, without photos, rest timers or item ids', () => {
    const p = packRoutine(routine('r', 'Push', ['x:Squat', 'c1']), exercises)
    expect(p.kind).toBe('routine')
    expect(p.routines[0]).toEqual({ name: 'Push', exercises: [
      { exerciseId: 'x:Squat', targetSets: 3, repMin: 8, repMax: 12 }, { exerciseId: 'c1', targetSets: 3, repMin: 8, repMax: 12 }] })
    expect(p.exercises).toHaveLength(1)
    expect(p.exercises[0]).not.toHaveProperty('photo')
    expect(p.exercises[0]).not.toHaveProperty('customDropRestSec')
    expect(p.exercises[0].videoUrl).toBe('https://youtu.be/x')
  })

  it('packs a program with each used routine once, as indexes, dropping deleted routines', () => {
    const routines = new Map([['a', routine('a', 'A', ['c1'])], ['b', routine('b', 'B', ['x:Squat'])], ['z', routine('z', 'Unused', [])]])
    const weekday: Program = { id: 'p', name: 'PPL', weeks: 2, mode: 'weekday', gymId: 'g', startDate: 5, schedule: { 0: { 1: 'b', 3: 'a' }, 1: { 1: 'b', 5: 'gone' } } }
    const p = packProgram(weekday, routines, exercises)
    expect(p.routines.map((r) => r.name)).toEqual(['B', 'A'])
    expect(p.program).toEqual({ name: 'PPL', weeks: 2, mode: 'weekday', schedule: { 0: { 1: 0, 3: 1 }, 1: { 1: 0 } } })
    const rot = packProgram({ id: 'p', name: 'AB', weeks: 1, mode: 'rotation', rotation: ['a', 'gone', 'b'] }, routines, exercises)
    expect(rot.program?.rotation).toEqual([0, 1])
    expect(rot.exercises.map((e) => e.id)).toEqual(['c1'])
  })

  it('round-trips through a link and finds the code in a pasted link', async () => {
    const p = packRoutine(routine('r', 'Pierna día ñ', ['x:Squat', 'c1']), exercises)
    const d = await encodeLinkData(p)
    expect(d).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(await decodeLinkData(d)).toEqual(validatePackage(JSON.parse(JSON.stringify(p))))
    expect(linkDataFrom(`  https://fabrizm.github.io/BliskFit/#/import?d=${d}\n`)).toBe(d)
    expect(linkDataFrom('hello')).toBeUndefined()
    await expect(decodeLinkData('garbage-garbage-garbage')).rejects.toBeInstanceOf(ShareError)
  })

  it('rejects other files and cleans untrusted fields', () => {
    expect(reason(() => validatePackage({ app: 'bliskfit', format: 1, tables: {} }))).toBe('backup')
    expect(reason(() => validatePackage({ app: 'nope' }))).toBe('invalid')
    expect(reason(() => validatePackage({ app: 'bliskfit-share', format: 9 }))).toBe('newer')
    const base = { app: 'bliskfit-share', format: 1, kind: 'routine', exercises: [], routines: [{ name: 'R', exercises: [{ exerciseId: 'x:Squat', targetSets: 3 }] }] }
    expect(reason(() => validatePackage({ ...base, routines: [] }))).toBe('invalid')
    expect(reason(() => validatePackage({ ...base, kind: 'program', program: { name: 'P', weeks: 1, mode: 'rotation', rotation: [1] } }))).toBe('invalid')
    expect(reason(() => validatePackage({ ...base, exercises: [{ id: 'c', name: 'X', trackingType: 'evil', primaryMuscleIds: [], secondaryMuscleIds: [] }] }))).toBe('invalid')

    const clean = validatePackage({
      ...base, extra: 1,
      routines: [{ name: 'R', exercises: [{ exerciseId: 'x:Squat', targetSets: 999, restSec: -5, evil: true }] }],
      exercises: [{ id: 'c', name: 'X', trackingType: 'duration', primaryMuscleIds: ['m:core', 4], secondaryMuscleIds: [], videoUrl: 'javascript:alert(1)', demoUrl: 'http://ok', source: 'seeded' }],
    })
    expect(clean).not.toHaveProperty('extra')
    expect(clean.routines[0].exercises[0]).toEqual({ exerciseId: 'x:Squat', targetSets: 20, restSec: 0 })
    expect(clean.exercises[0]).toEqual({ id: 'c', name: 'X', trackingType: 'duration', primaryMuscleIds: ['m:core'], secondaryMuscleIds: [], demoUrl: 'http://ok' })
  })

  it('caps program weeks and ignores days outside the week', () => {
    const p = validatePackage({
      app: 'bliskfit-share', format: 1, kind: 'program', exercises: [],
      routines: [{ name: 'R', exercises: [] }],
      program: { name: 'P', weeks: 1e9, mode: 'weekday', schedule: { 0: { 2: 0, 9: 0 } } },
    })
    expect(p.program?.weeks).toBe(12)
    expect(p.program?.schedule?.[0]).toEqual({ 2: 0 })
  })

  it('names files from the routine name', () => {
    expect(shareFileName('Push / Pull día 1')).toBe('push-pull-día-1.bliskfit.json')
    expect(shareFileName('  ')).toBe('routine.bliskfit.json')
  })
})

describe('opening shared links in the Android app', () => {
  it('builds an intent link that falls back to the install guide, and the app reads the code back', () => {
    const intent = androidAppIntent('abc_DEF-123')
    expect(intent).toBe('intent://import?d=abc_DEF-123#Intent;scheme=bliskfit;package=com.fabrizm.bliskfit;'
      + 'S.browser_fallback_url=https%3A%2F%2Fgithub.com%2FFabriZM%2FBliskFit%2Fblob%2Fmain%2FINSTALL.md;end')
    expect(linkDataFrom('bliskfit://import?d=abc_DEF-123')).toBe('abc_DEF-123')
    expect(linkDataFrom('https://fabrizm.github.io/BliskFit/#/import?d=abc_DEF-123')).toBe('abc_DEF-123')
    expect(linkDataFrom('https://fabrizm.github.io/BliskFit/')).toBeUndefined()
  })
})
