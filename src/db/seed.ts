import type { GymDB } from './db'
import { SEED_VERSION, seedExercise, seedMuscles, type SeedRow } from '../lib/seed'

/** Idempotent: (re)writes seeded rows only when the bundled seed is newer than what's stored. */
export async function ensureSeed(db: GymDB): Promise<void> {
  const stored = (await db.meta.get('seedVersion'))?.value as number | undefined
  if (stored !== undefined && stored >= SEED_VERSION) return
  const rows = (await import('../data/seed-exercises.json')).default as SeedRow[]
  await db.transaction('rw', db.muscleGroups, db.exercises, db.meta, async () => {
    await db.muscleGroups.bulkPut(seedMuscles())
    await db.exercises.bulkPut(rows.map(seedExercise))
    await db.meta.put({ key: 'seedVersion', value: SEED_VERSION })
  })
}
