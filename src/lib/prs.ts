import type { ID, SetLog, TrackingType } from '../db/types'

/**
 * Personal records, always recomputed from history (never stored), so editing or deleting a set can't leave a
 * stale flag. Rules:
 *  - Sets are compared in the order they were done; a PR must be strictly better than everything earlier.
 *  - The first time an exercise is done is a baseline, not a PR. Warm-ups and undone sets are ignored.
 *  - weight_reps / bodyweight_added (load = weight / added weight):
 *      weight  - heaviest load so far
 *      reps    - more reps than before at the same load (needs an earlier set at that load)
 *      e1rm    - best estimated 1RM (Epley)
 *      volume  - best single-set volume (load x reps)
 *  - bodyweight_reps: most reps in a set.  duration: longest hold.
 *  - assisted_bodyweight and cardio have no PRs yet.
 */
export type PRKind = 'weight' | 'reps' | 'e1rm' | 'volume' | 'duration'

const EPS = 1e-6

/** Epley estimated one-rep max; a single is taken at face value. */
export const epley = (load: number, reps: number): number => (reps <= 1 ? load : load * (1 + reps / 30))

function loadOf(s: SetLog, t: TrackingType): number | undefined {
  if (t === 'weight_reps') return s.weight
  if (t === 'bodyweight_added') return s.extraWeight ?? 0
  return undefined
}

const loadKey = (load: number) => load.toFixed(2)

const chronological = (sets: SetLog[]): SetLog[] =>
  sets
    .filter((s) => s.doneAt !== undefined && s.setType !== 'warmup')
    .sort((a, b) => a.doneAt! - b.doneAt! || a.order - b.order || a.id.localeCompare(b.id))

/** setId -> the kinds of record that set achieved (sets with none are omitted). */
export function computePRs(sets: SetLog[], tracking: TrackingType): Map<ID, PRKind[]> {
  const out = new Map<ID, PRKind[]>()
  const ordered = chronological(sets)

  if (tracking === 'weight_reps' || tracking === 'bodyweight_added') {
    let seen = false
    let maxLoad = -Infinity, maxE1rm = -Infinity, maxVolume = -Infinity
    const repsAtLoad = new Map<string, number>()
    for (const s of ordered) {
      const load = loadOf(s, tracking)
      const reps = s.reps ?? 0
      if (load === undefined || reps < 1) continue
      const kinds: PRKind[] = []
      if (seen) {
        if (load > maxLoad + EPS) kinds.push('weight')
        const before = repsAtLoad.get(loadKey(load))
        if (before !== undefined && reps > before) kinds.push('reps')
        if (epley(load, reps) > maxE1rm + EPS) kinds.push('e1rm')
        if (load * reps > maxVolume + EPS) kinds.push('volume')
      }
      if (kinds.length) out.set(s.id, kinds)
      seen = true
      maxLoad = Math.max(maxLoad, load)
      maxE1rm = Math.max(maxE1rm, epley(load, reps))
      maxVolume = Math.max(maxVolume, load * reps)
      repsAtLoad.set(loadKey(load), Math.max(repsAtLoad.get(loadKey(load)) ?? 0, reps))
    }
  } else if (tracking === 'bodyweight_reps' || tracking === 'duration') {
    const kind: PRKind = tracking === 'duration' ? 'duration' : 'reps'
    let best: number | undefined
    for (const s of ordered) {
      const v = tracking === 'duration' ? s.durationSec ?? 0 : s.reps ?? 0
      if (v < 1) continue
      if (best !== undefined && v > best) out.set(s.id, [kind])
      best = Math.max(best ?? 0, v)
    }
  }
  return out
}

export interface Record { value: number; set: SetLog }
export interface Records {
  heaviest?: Record
  e1rm?: Record
  volume?: Record
  /** bodyweight_reps */
  maxReps?: Record
  /** duration */
  longest?: Record
  /** Best reps at each load, heaviest first. */
  repsAtLoad: { load: number; reps: number; set: SetLog }[]
}

/** Current bests (the earliest set to reach a value holds it). */
export function exerciseRecords(sets: SetLog[], tracking: TrackingType): Records {
  const rec: Records = { repsAtLoad: [] }
  const better = (cur: Record | undefined, value: number, set: SetLog): Record =>
    !cur || value > cur.value + EPS ? { value, set } : cur
  const byLoad = new Map<string, { load: number; reps: number; set: SetLog }>()
  for (const s of chronological(sets)) {
    const reps = s.reps ?? 0
    if (tracking === 'weight_reps' || tracking === 'bodyweight_added') {
      const load = loadOf(s, tracking)
      if (load === undefined || reps < 1) continue
      rec.heaviest = better(rec.heaviest, load, s)
      rec.e1rm = better(rec.e1rm, epley(load, reps), s)
      rec.volume = better(rec.volume, load * reps, s)
      const cur = byLoad.get(loadKey(load))
      if (!cur || reps > cur.reps) byLoad.set(loadKey(load), { load, reps, set: s })
    } else if (tracking === 'bodyweight_reps' && reps >= 1) {
      rec.maxReps = better(rec.maxReps, reps, s)
    } else if (tracking === 'duration' && (s.durationSec ?? 0) >= 1) {
      rec.longest = better(rec.longest, s.durationSec!, s)
    }
  }
  rec.repsAtLoad = [...byLoad.values()].sort((a, b) => b.load - a.load)
  return rec
}

/** PRs across several exercises at once (history screens): setId -> kinds. */
export function computeAllPRs(sets: SetLog[], trackingOf: (exerciseId: ID) => TrackingType): Map<ID, PRKind[]> {
  const byExercise = new Map<ID, SetLog[]>()
  for (const s of sets) byExercise.set(s.exerciseId, [...(byExercise.get(s.exerciseId) ?? []), s])
  const out = new Map<ID, PRKind[]>()
  for (const [exId, list] of byExercise) for (const [id, kinds] of computePRs(list, trackingOf(exId))) out.set(id, kinds)
  return out
}
