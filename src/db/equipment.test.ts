import { beforeEach, describe, expect, it } from 'vitest'
import { db, newId } from './db'
import { setExerciseUnit } from './equipment'
import { ensureSeed } from './seed'
import type { SessionStatus } from './types'
import { displayToKg, kgToDisplay } from '../lib/units'

const BENCH = 'x:Barbell_Bench_Press_-_Medium_Grip'
const DIP = 'x:Dips_-_Triceps_Version'

async function session(status: SessionStatus, sets: { exerciseId?: string; weight?: number; extraWeight?: number; unit?: 'kg' | 'lb'; reps?: number }[]) {
  const id = newId()
  await db.sessions.add({ id, startedAt: Date.now(), status, pausedIntervals: [], exercises: [] })
  const ids = sets.map(() => newId())
  await db.setLogs.bulkAdd(sets.map((s, i) => ({ id: ids[i], sessionId: id, exerciseId: s.exerciseId ?? BENCH, order: i, setType: 'working' as const, ...s })))
  return ids
}
const shown = async (setId: string, unit: 'kg' | 'lb', key: 'weight' | 'extraWeight' = 'weight') => {
  const v = (await db.setLogs.get(setId))?.[key]
  return v === undefined ? undefined : kgToDisplay(v, unit)
}

describe('changing an exercise’s weight unit', () => {
  beforeEach(async () => {
    await ensureSeed(db)
    await db.sessions.clear(); await db.setLogs.clear()
    await db.exercises.update(BENCH, { weightUnit: undefined })
  })

  it('keeps the numbers typed in the running workout, done or not', async () => {
    const [typed, done, blank] = await session('active', [{ weight: 122.5 }, { weight: 100, reps: 8 }, { reps: 8 }])
    await setExerciseUnit(BENCH, 'lb', 'kg')
    expect((await db.exercises.get(BENCH))?.weightUnit).toBe('lb')
    expect(await shown(typed, 'lb')).toBe(122.5)
    expect(await shown(done, 'lb')).toBe(100)
    expect((await db.setLogs.get(typed))?.unit).toBe('lb')
    expect(await db.setLogs.get(blank)).toMatchObject({ unit: 'lb' })
    expect((await db.setLogs.get(blank))?.weight).toBeUndefined()
  })

  it('a set typed in its own unit is re-read from that unit, not the old default', async () => {
    const [s] = await session('active', [{ weight: displayToKg(50, 'lb'), unit: 'lb' }])
    await setExerciseUnit(BENCH, 'kg', 'lb')
    expect(await shown(s, 'kg')).toBe(50)
    expect((await db.setLogs.get(s))?.unit).toBe('kg')
  })

  it('also in a paused workout, and only for that exercise', async () => {
    const [bench, other] = await session('paused', [{ weight: 45 }, { exerciseId: 'x:Barbell_Squat', weight: 100 }])
    await setExerciseUnit(BENCH, 'lb', 'kg')
    expect(await shown(bench, 'lb')).toBe(45)
    expect((await db.setLogs.get(other))?.weight).toBe(100)
  })

  it('never touches finished workouts (their sets keep the unit they were typed in)', async () => {
    const [old, typed] = await session('finished', [{ weight: 100, reps: 5 }, { weight: 20, unit: 'kg', reps: 8 }])
    const before = await db.setLogs.bulkGet([old, typed])
    await setExerciseUnit(BENCH, 'lb', 'kg')
    expect(await db.setLogs.bulkGet([old, typed])).toEqual(before)
  })

  it('going back to the app setting keeps the numbers again', async () => {
    const [s] = await session('active', [{ weight: displayToKg(225, 'lb') }])
    await db.exercises.update(BENCH, { weightUnit: 'lb' })
    await setExerciseUnit(BENCH, undefined, 'kg')
    expect((await db.exercises.get(BENCH))?.weightUnit).toBeUndefined()
    expect(await shown(s, 'kg')).toBe(225)
  })

  it('does nothing to sets when the unit reads the same', async () => {
    const [s] = await session('active', [{ weight: 100 }])
    await setExerciseUnit(BENCH, 'kg', 'kg')
    expect((await db.setLogs.get(s))?.weight).toBe(100)
  })

  it('keeps the added or assist weight typed too', async () => {
    const [s] = await session('active', [{ exerciseId: DIP, extraWeight: 10, reps: 8 }])
    await setExerciseUnit(DIP, 'lb', 'kg')
    expect(await shown(s, 'lb', 'extraWeight')).toBe(10)
    await db.exercises.update(DIP, { weightUnit: undefined })
  })
})
