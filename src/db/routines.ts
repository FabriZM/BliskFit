import { db } from './db'
import { pruneProgram } from '../lib/programs'
import type { ID } from './types'

/**
 * Permanently deletes a routine. History and records are untouched: sessions and set logs are not
 * removed, and past sessions keep the routine's name (`routineName`) so they still show where they came from.
 * The routine is dropped from any program that lists it. Returns false if it doesn't exist.
 */
export async function deleteRoutine(id: ID): Promise<boolean> {
  return db.transaction('rw', db.routines, db.sessions, db.programs, async () => {
    const routine = await db.routines.get(id)
    if (!routine) return false
    await db.sessions.where('routineId').equals(id).filter((s) => !s.routineName).modify({ routineName: routine.name })
    const remaining = new Set((await db.routines.toArray()).filter((r) => r.id !== id).map((r) => r.id))
    for (const p of await db.programs.toArray()) {
      const next = pruneProgram(p, remaining)
      if (JSON.stringify(next) !== JSON.stringify(p)) await db.programs.put(next)
    }
    await db.routines.delete(id)
    return true
  })
}

/** When each routine was last started, for ordering the lists. Walks sessions newest first and keeps the first hit. */
export async function routineLastUsed(): Promise<Map<ID, number>> {
  const used = new Map<ID, number>()
  await db.sessions.orderBy('startedAt').reverse().each((s) => { if (s.routineId && !used.has(s.routineId)) used.set(s.routineId, s.startedAt) })
  return used
}
