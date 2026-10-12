import { db } from './db'
import type { ID, Units } from './types'
import { retypeKg, setUnit, weightUnitFor } from '../lib/plates'

/**
 * Changes the default unit of an exercise's equipment, for the sets typed from now on. Every set keeps the unit it
 * was typed in, so finished workouts never change. In the running workout, what was typed wins: numbers already
 * there keep their value in the new unit (270 typed while it said kg becomes 270 lb, not 122.5 kg → 270.1 lb), and
 * blank sets take the new unit.
 */
export async function setExerciseUnit(exerciseId: ID, weightUnit: Units | undefined, appUnits: Units): Promise<void> {
  await db.transaction('rw', db.exercises, db.sessions, db.setLogs, async () => {
    const ex = await db.exercises.get(exerciseId)
    if (!ex) return
    const from = weightUnitFor(ex, appUnits), to = weightUnitFor({ weightUnit }, appUnits)
    await db.exercises.update(exerciseId, { weightUnit })
    if (from === to) return
    const running = new Set(await db.sessions.where('status').anyOf('active', 'paused').primaryKeys())
    const sets = await db.setLogs.where('exerciseId').equals(exerciseId).filter((s) => running.has(s.sessionId)).toArray()
    await Promise.all(sets.map((s) => {
      const was = setUnit(s, from)
      return db.setLogs.update(s.id, { unit: to, weight: retypeKg(s.weight, was, to), extraWeight: retypeKg(s.extraWeight, was, to) })
    }))
  })
}
