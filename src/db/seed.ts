import type { GymDB } from './db'
import { SEED_VERSION, seedExercise, seedMuscles, type SeedRow } from '../lib/seed'

/** Idempotent: (re)writes seeded rows only when the bundled seed is newer than what's stored. */
export async function ensureSeed(db: GymDB): Promise<void> {
  const stored = (await db.meta.get('seedVersion'))?.value as number | undefined
  if (stored !== undefined && stored >= SEED_VERSION) return
  const rows = (await import('../data/seed-exercises.json')).default as SeedRow[]
  await db.transaction('rw', db.muscleGroups, db.exercises, db.meta, async () => {
    // Re-seeding rewrites the rows, so carry over what the app has learned on them (rest times).
    const learned = new Map((await db.exercises.filter((e) => e.learnedRestSec !== undefined).toArray()).map((e) => [e.id, e.learnedRestSec]))
    await db.muscleGroups.bulkPut(seedMuscles())
    await db.exercises.bulkPut(rows.map((r) => {
      const ex = seedExercise(r)
      const rest = learned.get(ex.id)
      return rest === undefined ? ex : { ...ex, learnedRestSec: rest }
    }))
    await db.meta.put({ key: 'seedVersion', value: SEED_VERSION })
  })
}
