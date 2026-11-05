import type { ID, SetLog } from '../db/types'
import { MUSCLES } from '../data/muscles'
import { isWorkingSet, muscleCredit, type ExerciseLite } from './stats'

/** Heat steps: 0 = not targeted, HEAT_LEVELS = the most worked muscle of the period. */
export const HEAT_LEVELS = 5

/** Sets credited to each muscle (primary 1, secondary 0.5, warm-ups and unfinished sets skipped), keyed by muscle id. */
export function heatFromSets(sets: SetLog[], exById: Map<ID, Pick<ExerciseLite, 'primaryMuscleIds' | 'secondaryMuscleIds'>>): Map<ID, number> {
  const out = new Map<ID, number>()
  for (const s of sets) {
    const ex = exById.get(s.exerciseId)
    if (!ex || !isWorkingSet(s)) continue
    for (const [m, share] of muscleCredit(ex)) out.set(m, (out.get(m) ?? 0) + share)
  }
  return out
}

/** Bucket 0..HEAT_LEVELS for a value against the period's maximum; anything above zero is at least level 1. */
export function heatLevel(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0
  return Math.max(1, Math.min(HEAT_LEVELS, Math.ceil((value / max) * HEAT_LEVELS)))
}

/** A figure region and the muscle ids it shows; the heat of a region with several is the highest of them. */
export interface HeatRegion { id: string; muscles: ID[] }

/** The most worked of a region's muscles. */
export const regionHeat = (heat: Map<ID, number>, region: HeatRegion): number =>
  Math.max(0, ...region.muscles.map((m) => heat.get(m) ?? 0))

const PARENT = new Map<string, string>(MUSCLES.flatMap((m): [string, string][] => (m.parent ? [[`m:${m.slug}`, `m:${m.parent}`]] : [])))

/** Sets for a muscle plus any credited to a group above it, so an exercise tagged just "Shoulders" still lights every delt. */
export function effectiveHeat(heat: Map<ID, number>, id: ID): number {
  let best = 0
  for (let cur: ID | undefined = id, guard = 0; cur !== undefined && guard < 5; guard++) {
    best = Math.max(best, heat.get(cur) ?? 0)
    cur = PARENT.get(cur)
  }
  return best
}

/** Planned sets per muscle for a routine (primary 1, secondary 0.5 per set), keyed by muscle id. */
export function heatFromRoutine(
  items: { exerciseId: ID; targetSets: number }[],
  exById: Map<ID, Pick<ExerciseLite, 'primaryMuscleIds' | 'secondaryMuscleIds'>>,
): Map<ID, number> {
  const out = new Map<ID, number>()
  for (const it of items) {
    const ex = exById.get(it.exerciseId)
    if (!ex) continue
    for (const [m, share] of muscleCredit(ex)) out.set(m, (out.get(m) ?? 0) + share * it.targetSets)
  }
  return out
}
