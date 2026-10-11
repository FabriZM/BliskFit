import { describe, expect, it } from 'vitest'
import { GymDB, newId } from './db'
import { DEFAULT_SETTINGS } from './types'

describe('GymDB v1', () => {
  it('stores exercises with tracking types and queries by muscle', async () => {
    const db = new GymDB('test-' + newId())
    const calves = newId()
    await db.exercises.add({
      id: newId(), name: 'Seated calf raise', trackingType: 'weight_reps',
      primaryMuscleIds: [calves], secondaryMuscleIds: [], source: 'custom',
    })
    expect(await db.exercises.where('primaryMuscleIds').equals(calves).count()).toBe(1)
  })

  it('stores sessions with pause intervals and settings', async () => {
    const db = new GymDB('test-' + newId())
    const id = newId()
    await db.sessions.add({ id, startedAt: 1, status: 'paused', pausedIntervals: [{ start: 2 }], exercises: [] })
    expect((await db.sessions.get(id))?.pausedIntervals[0].start).toBe(2)
    await db.settings.put(DEFAULT_SETTINGS)
    expect((await db.settings.get('settings'))?.units).toBe('kg')
  })
})
