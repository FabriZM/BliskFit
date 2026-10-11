import type { Exercise } from '../db/types'
import { describe, expect, it } from 'vitest'
import { GymDB, newId } from '../db/db'
import { ensureSeed } from '../db/seed'
import { filterExercises } from './exerciseFilter'
import { orderMuscles, withDescendants } from './muscles'
import { inferTrackingType } from './seed'

describe('inferTrackingType', () => {
  const t = (n: string, c = 'strength', e: string | null = 'barbell') => inferTrackingType({ n, c, e })
  it('maps the special types', () => {
    expect(t('Bicycling', 'cardio', 'other')).toBe('cardio')
    expect(t('Plank', 'strength', 'body only')).toBe('duration')
    expect(t('Calf Stretch', 'stretching', null)).toBe('duration')
    expect(t('Band Assisted Pull-Up', 'strength', 'other')).toBe('assisted_bodyweight')
    expect(t('Weighted Pull Ups', 'strength', 'body only')).toBe('bodyweight_added')
    expect(t('Pushups', 'strength', 'body only')).toBe('bodyweight_reps')
    expect(t('Barbell Squat')).toBe('weight_reps')
  })
})

describe('orderMuscles', () => {
  it('puts children right after their parent', async () => {
    const db = new GymDB('test-' + newId())
    await ensureSeed(db)
    const names = orderMuscles(await db.muscleGroups.toArray()).map((m) => m.id)
    const i = names.indexOf('m:calves')
    expect(names.slice(i, i + 3).sort()).toEqual(['m:calves', 'm:gastrocnemius', 'm:soleus'])
  })
})

describe('seed + filter', () => {
  it('seeds once and finds calf exercises via the Calves hierarchy', async () => {
    const db = new GymDB('test-' + newId())
    await ensureSeed(db)
    const count = await db.exercises.count()
    expect(count).toBeGreaterThan(800)
    await ensureSeed(db)
    expect(await db.exercises.count()).toBe(count)

    const muscles = await db.muscleGroups.toArray()
    const ids = withDescendants(muscles, 'm:calves')
    expect(ids.has('m:soleus') && ids.has('m:gastrocnemius')).toBe(true)
    const hits = filterExercises(await db.exercises.toArray(), { query: 'calf', muscleIds: ids, equipment: '' })
    expect(hits.length).toBeGreaterThan(3)
    expect(hits.every((e) => /calf/i.test(e.name))).toBe(true)
  })

  it('favorites sort first, filter, and survive a re-seed', async () => {
    const db = new GymDB('test-' + newId())
    await ensureSeed(db)
    await db.favorites.put({ exerciseId: 'x:Plank' })
    await db.meta.put({ key: 'seedVersion', value: 0 })
    await ensureSeed(db) // forces the library to be rewritten
    const favorites = new Set((await db.favorites.toArray()).map((r) => r.exerciseId))
    expect(favorites.has('x:Plank')).toBe(true)
    const all = filterExercises(await db.exercises.toArray(), { query: '', muscleIds: new Set(), equipment: '', favorites })
    expect(all[0].id).toBe('x:Plank')
    const only = filterExercises(await db.exercises.toArray(), { query: '', muscleIds: new Set(), equipment: '', favorites, favoritesOnly: true })
    expect(only.map((e) => e.id)).toEqual(['x:Plank'])
  })

  it('search ignores accents and case', () => {
    const e: Exercise = { id: '1', name: 'Sentadilla Búlgara', trackingType: 'weight_reps', primaryMuscleIds: [], secondaryMuscleIds: [], source: 'custom' as const }
    expect(filterExercises([e], { query: 'BULGARA', muscleIds: new Set(), equipment: '' })).toHaveLength(1)
  })
})
