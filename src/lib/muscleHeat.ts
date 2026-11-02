import type { ID, SetLog } from '../db/types'
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
