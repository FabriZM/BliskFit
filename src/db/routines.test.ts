import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { deleteRoutine } from './routines'
import type { WorkoutSession } from './types'

const session = (over: Partial<WorkoutSession>): WorkoutSession => ({
  id: 's1', startedAt: 1, endedAt: 2, status: 'finished', pausedIntervals: [], exercises: [], ...over,
})

describe('deleting a routine', () => {
  beforeEach(async () => {
    await Promise.all([db.routines.clear(), db.sessions.clear(), db.setLogs.clear(), db.programs.clear()])
    await db.routines.bulkAdd([
      { id: 'old', name: 'Push', exercises: [], archived: true },
      { id: 'keep', name: 'Pull', exercises: [], archived: false },
    ])
  })

  it('does nothing for a routine that does not exist, and can delete active or archived ones', async () => {
    expect(await deleteRoutine('nope')).toBe(false)
    expect(await db.routines.count()).toBe(2)
    expect(await deleteRoutine('keep')).toBe(true)
    expect(await deleteRoutine('old')).toBe(true)
    expect(await db.routines.count()).toBe(0)
  })

  it('removes the routine but leaves sessions and sets alone, keeping the routine name on past sessions', async () => {
    await db.sessions.bulkAdd([session({ id: 's1', routineId: 'old' }), session({ id: 's2', routineId: 'old', routineName: 'Push day' }), session({ id: 's3', routineId: 'keep' })])
    await db.setLogs.add({ id: 'l1', sessionId: 's1', exerciseId: 'e1', order: 0, setType: 'working', weight: 100, reps: 5, doneAt: 5 })
    expect(await deleteRoutine('old')).toBe(true)
    expect(await db.routines.get('old')).toBeUndefined()
    expect((await db.sessions.get('s1'))?.routineName).toBe('Push')
    expect((await db.sessions.get('s1'))?.routineId).toBe('old')
    expect((await db.sessions.get('s2'))?.routineName).toBe('Push day')
    expect((await db.sessions.get('s3'))?.routineName).toBeUndefined()
    expect(await db.sessions.count()).toBe(3)
    expect(await db.setLogs.get('l1')).toMatchObject({ weight: 100, reps: 5 })
  })

  it('drops the routine from programs but keeps the rest', async () => {
    await db.programs.add({ id: 'p', name: 'P', weeks: 1, mode: 'weekday', schedule: { 0: { 1: 'old', 3: 'keep' } } })
    await db.programs.add({ id: 'r', name: 'R', weeks: 1, mode: 'rotation', rotation: ['old', 'keep'] })
    await deleteRoutine('old')
    expect((await db.programs.get('p'))?.schedule).toEqual({ 0: { 3: 'keep' } })
    expect((await db.programs.get('r'))?.rotation).toEqual(['keep'])
  })
})
