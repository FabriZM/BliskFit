import type { TrackingType, Units } from '../db/types'
import { loadFor, PLATES } from './plates'

/**
 * Warm-up sets ramping up to the first working set. Works in the set's own unit (what's printed on the plates),
 * so every weight can actually be loaded: through the plate calculator on bars and plate-loaded machines, else
 * in 2.5 kg / 5 lb steps. Only ever a suggestion: the workout inserts them when asked, and they stay editable.
 */

export interface WarmupInput {
  tracking: TrackingType
  mechanic?: 'compound' | 'isolation'
  /** Working weight in `unit`: the total for weight × reps, the added weight for weighted bodyweight. */
  work: number
  unit: Units
  /** Bar or sled weight in `unit` when loaded with plates (0 = no bar); absent = not plate-loaded. */
  bar?: number
}

/** One warm-up set, in `unit` (added weight for weighted bodyweight). */
export interface WarmupSet {
  weight: number
  reps: number
}

const STEP: Record<Units, number> = { kg: 2.5, lb: 5 }
/** From this working weight up, one more single at 90% before the work. */
const HEAVY: Record<Units, number> = { kg: 140, lb: 300 }
const MAX_SETS = 5

// [fraction of the working weight, reps]
const COMPOUND: [number, number][] = [[0.4, 5], [0.6, 3], [0.8, 2]]
const ISOLATION: [number, number][] = [[0.5, 8], [0.75, 3]]

export function warmupSets(i: WarmupInput): WarmupSet[] {
  if (i.tracking === 'bodyweight_added') return weightedBodyweight(i)
  if (i.tracking !== 'weight_reps' || !(i.work > 0)) return []
  const step = STEP[i.unit]
  const plates = i.bar !== undefined
  // The heaviest weight at or below the target that can be loaded (never below the bar).
  const loadable = (w: number) => (plates ? loadFor(w, i.bar!, PLATES[i.unit]).total : Math.floor(w / step) * step)
  // Each warm-up should be a real step up from the one before and still clearly below the work.
  const gap = Math.max(step, i.work * 0.05)

  const plan: WarmupSet[] = []
  if (plates && i.bar! > 0 && i.mechanic !== 'isolation') plan.push({ weight: i.bar!, reps: 10 })
  const ramp = i.mechanic === 'isolation' ? ISOLATION : [...COMPOUND, ...(i.work >= HEAVY[i.unit] ? [[0.9, 1] as [number, number]] : [])]
  for (const [f, reps] of ramp) plan.push({ weight: loadable(i.work * f), reps })

  const out: WarmupSet[] = []
  for (const s of plan) {
    const prev = out[out.length - 1]
    if (s.weight <= 0 || s.weight > i.work - gap + 1e-9) continue
    if (prev && s.weight < prev.weight + gap - 1e-9) continue
    out.push(s)
  }
  return out.slice(-MAX_SETS)
}

/** Weighted pull-ups and dips: bodyweight only, then about half the added weight if that's a real step. */
function weightedBodyweight(i: WarmupInput): WarmupSet[] {
  if (!(i.work > 0)) return []
  const step = STEP[i.unit]
  const half = Math.floor((i.work * 0.5) / step) * step
  return [{ weight: 0, reps: 5 }, ...(half >= step && half <= i.work - step ? [{ weight: half, reps: 3 }] : [])]
}

/** Rest after a warm-up that is followed by another warm-up: short, and never longer than the usual rest. */
export const WARMUP_REST_SEC = 45
