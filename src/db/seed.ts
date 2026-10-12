import type { GymDB } from './db'
import type { Exercise } from './types'
import { SEED_VERSION, seedExercise, seedMuscles, type SeedRow } from '../lib/seed'

/** Fields of a seeded exercise that belong to the user or the app, not the dataset. */
const KEPT = ['learnedRestSec', 'customRestSec', 'weightUnit', 'plateLoaded', 'barKg'] as const satisfies readonly (keyof Exercise)[]

/** Idempotent: (re)writes seeded rows only when the bundled seed is newer than what's stored. */
export async function ensureSeed(db: GymDB): Promise<void> {
  const stored = (await db.meta.get('seedVersion'))?.value as number | undefined
  if (stored !== undefined && stored >= SEED_VERSION) return
  const rows = (await import('../data/seed-exercises.json')).default as SeedRow[]
  await db.transaction('rw', db.muscleGroups, db.exercises, db.meta, async () => {
    // Re-seeding rewrites the rows, so carry over what the app and the user have set on them (rest times, equipment).
    const kept = new Map((await db.exercises.filter((e) => KEPT.some((k) => e[k] !== undefined)).toArray())
      .map((e) => [e.id, Object.fromEntries(KEPT.filter((k) => e[k] !== undefined).map((k) => [k, e[k]]))]))
    await db.muscleGroups.bulkPut(seedMuscles())
    await db.exercises.bulkPut(rows.map((r) => {
      const ex = seedExercise(r)
      return { ...ex, ...kept.get(ex.id) }
    }))
    await db.meta.put({ key: 'seedVersion', value: SEED_VERSION })
  })
}
