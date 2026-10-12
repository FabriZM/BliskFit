import type { Exercise, SetLog, TrackingType, Units } from '../db/types'
import { displayToKg, kgToDisplay } from './units'

/**
 * Equipment that isn't in the app's units, and plate math for bar and plate-loaded exercises. Weights are still
 * stored in kg; an exercise's own unit only changes how its weights are entered and shown, so a 45 lb machine
 * reads 45 instead of 20.4. Plate math works in that unit, because that's what's printed on the plates.
 */

/** The unit an exercise's weights are entered and shown in: its own, else the app's. */
export const weightUnitFor = (ex: Pick<Exercise, 'weightUnit'> | undefined, appUnits: Units): Units => ex?.weightUnit ?? appUnits

/**
 * The unit a set's weights are typed and shown in: the set's own (what was typed); for a set with no weight yet,
 * the unit of the set it would be filled from (last time's); else `fallback` (the exercise's unit in a workout,
 * the app's for sets from before units were kept per set).
 */
export function setUnit(set: Pick<SetLog, 'unit' | 'weight' | 'extraWeight'>, fallback: Units, hint?: Pick<SetLog, 'unit'>): Units {
  if (set.unit) return set.unit
  return (set.weight === undefined && set.extraWeight === undefined ? hint?.unit : undefined) ?? fallback
}

/** The number typed in `from`, kept as that same number in `to` (270 kg → 270 lb). */
export const retypeKg = (kg: number | undefined, from: Units, to: Units): number | undefined =>
  kg === undefined || from === to ? kg : displayToKg(kgToDisplay(kg, from), to)

/** Tracking types that log a weight, so a weight unit applies. */
export const usesWeight = (t: TrackingType): boolean => t === 'weight_reps' || t === 'bodyweight_added' || t === 'assisted_bodyweight'

/** Standard plates, heaviest first. */
export const PLATES: Record<Units, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
}

const BAR_EQUIPMENT: Record<string, Record<Units, number>> = {
  barbell: { kg: 20, lb: 45 },
  'e-z curl bar': { kg: 10, lb: 25 },
}

/** Whether the plate calculator is offered: set on the exercise, else yes for barbells and EZ bars. */
export function isPlateLoaded(ex: Pick<Exercise, 'plateLoaded' | 'equipment' | 'trackingType'>): boolean {
  if (ex.trackingType !== 'weight_reps') return false
  return ex.plateLoaded ?? !!(ex.equipment && BAR_EQUIPMENT[ex.equipment])
}

/** Bar (or sled) weight in `unit`: the exercise's own, else the usual bar for its equipment, else 0. */
export function barWeight(ex: Pick<Exercise, 'barKg' | 'equipment'>, unit: Units): number {
  if (ex.barKg !== undefined) return kgToDisplay(ex.barKg, unit)
  return (ex.equipment && BAR_EQUIPMENT[ex.equipment]?.[unit]) || 0
}

// Plate math in hundredths, so 1.25 and 2.5 add up without floating-point drift.
const c = (n: number) => Math.round(n * 100)

/** Bar plus the same plates on both sides. */
export const totalWeight = (bar: number, perSide: number[]): number => (c(bar) + 2 * perSide.reduce((a, p) => a + c(p), 0)) / 100

export interface Loading {
  /** Plates for one side, heaviest first. */
  perSide: number[]
  /** What that actually adds up to (bar included). */
  total: number
  /** False when `target` can't be loaded with these plates; `total` is then the closest below it. */
  exact: boolean
}

/** Plates per side for a target total, heaviest first (unlimited plates of each size). */
export function loadFor(target: number, bar: number, plates: number[] = PLATES.kg): Loading {
  let left = Math.max(0, Math.floor((c(target) - c(bar)) / 2))
  const perSide: number[] = []
  for (const p of [...plates].sort((a, b) => b - a)) {
    while (c(p) > 0 && left >= c(p)) { perSide.push(p); left -= c(p) }
  }
  const total = totalWeight(bar, perSide)
  return { perSide, total, exact: c(total) === c(target) }
}

/** A plate or plate sum, keeping quarter values ("1.25", "31.25") that formatNum would round. */
export const formatPlate = (n: number): string => String(Math.round(n * 100) / 100)

/** Plates for a side grouped by size, e.g. [20, 20, 5] → "2×20 + 5". */
export function describeSide(perSide: number[]): string {
  const counts = new Map<number, number>()
  for (const p of perSide) counts.set(p, (counts.get(p) ?? 0) + 1)
  return [...counts].map(([p, n]) => (n > 1 ? `${n}×${formatPlate(p)}` : formatPlate(p))).join(' + ')
}
