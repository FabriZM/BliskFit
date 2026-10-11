import type { Exercise, ID, MuscleGroup, SetLog, Units } from '../db/types'
import { epley } from './prs'
import { displayToKg, kgToDisplay } from './units'

/**
 * Starting-weight suggestions for an exercise that has never been done, derived from similar exercises that have:
 *  - similar = shares a primary muscle (parent/child counts as the same, e.g. Calves and Gastrocnemius), same
 *    tracking type, and compatible mechanic (compound vs isolation) when both are known;
 *  - each similar exercise contributes a recent estimated 1RM (mean of its best set over its last few workouts);
 *  - that is converted to the new exercise's equipment (rough relative-load factors) and target rep count;
 *  - the result is deliberately conservative (SAFETY) and rounded to practical plate steps.
 * Nothing is applied automatically; the UI only suggests.
 */
export const SAFETY = 0.85
const RECENT_SESSIONS = 3
const MAX_SOURCES = 3
const MIN_PRIMARY_OVERLAP = 0.5
export const DEFAULT_TARGET_REPS = 10

/** Rough load per implement relative to a barbell (dumbbell = per hand). Heuristic, hence "rough" confidence. */
const EQUIPMENT_FACTOR: Record<string, number> = {
  barbell: 1, 'e-z curl bar': 0.9, machine: 0.9, cable: 0.55, dumbbell: 0.4, kettlebells: 0.35,
}
const factor = (e?: string) => EQUIPMENT_FACTOR[e ?? ''] ?? 1

export interface SuggestSource { exercise: Exercise; sets: SetLog[] }
export interface StartSuggestion {
  weightKg?: number
  reps?: number
  durationSec?: number
  basedOn: { id: ID; name: string }[]
  /** 'estimate': two or more similar exercises incl. the same equipment; otherwise 'rough'. */
  confidence: 'estimate' | 'rough'
}

// ---- muscles ------------------------------------------------------------------------------------

function ancestorsOf(id: ID, byId: Map<ID, MuscleGroup>): Set<ID> {
  const out = new Set<ID>()
  for (let cur = byId.get(id)?.parentId; cur && !out.has(cur); cur = byId.get(cur)?.parentId) out.add(cur)
  return out
}

const related = (a: ID, b: ID, byId: Map<ID, MuscleGroup>) =>
  a === b || ancestorsOf(a, byId).has(b) || ancestorsOf(b, byId).has(a)

/** 0..1: how much two primary-muscle lists cover each other. */
function primaryOverlap(a: ID[], b: ID[], byId: Map<ID, MuscleGroup>): number {
  if (!a.length || !b.length) return 0
  const ab = a.filter((m) => b.some((x) => related(m, x, byId))).length / a.length
  const ba = b.filter((m) => a.some((x) => related(m, x, byId))).length / b.length
  return (ab + ba) / 2
}

export function similarity(target: Exercise, cand: Exercise, byId: Map<ID, MuscleGroup>): number {
  if (cand.id === target.id || cand.trackingType !== target.trackingType) return 0
  if (target.mechanic && cand.mechanic && target.mechanic !== cand.mechanic) return 0
  const primary = primaryOverlap(target.primaryMuscleIds, cand.primaryMuscleIds, byId)
  if (primary < MIN_PRIMARY_OVERLAP) return 0
  const candMuscles = [...cand.primaryMuscleIds, ...cand.secondaryMuscleIds]
  const secondary = target.secondaryMuscleIds.length
    ? target.secondaryMuscleIds.filter((m) => candMuscles.some((x) => related(m, x, byId))).length / target.secondaryMuscleIds.length
    : primary
  const sameEquipment = !!target.equipment && target.equipment === cand.equipment
  return 0.6 * primary + 0.25 * (sameEquipment ? 1 : 0) + 0.15 * secondary
}

// ---- recent performance -----------------------------------------------------------------------------

const usable = (sets: SetLog[]) => sets.filter((s) => s.doneAt !== undefined && s.setType !== 'warmup')

/** The most recent workouts' done sets, newest first. */
function recentSessions(sets: SetLog[]): SetLog[][] {
  const by = new Map<ID, SetLog[]>()
  for (const s of usable(sets)) by.set(s.sessionId, [...(by.get(s.sessionId) ?? []), s])
  return [...by.values()]
    .sort((a, b) => Math.max(...b.map((s) => s.doneAt!)) - Math.max(...a.map((s) => s.doneAt!)))
    .slice(0, RECENT_SESSIONS)
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Mean over recent workouts of the best estimated 1RM; sets above 12 reps are ignored when others exist. */
function recentE1rm(sets: SetLog[], loadOf: (s: SetLog) => number | undefined): number | undefined {
  const bests = recentSessions(sets).flatMap((g) => {
    const withLoad = g.filter((s) => (loadOf(s) ?? 0) > 0 && (s.reps ?? 0) >= 1)
    const low = withLoad.filter((s) => s.reps! <= 12)
    const pool = low.length ? low : withLoad
    return pool.length ? [Math.max(...pool.map((s) => epley(loadOf(s)!, s.reps!)))] : []
  })
  return bests.length ? mean(bests) : undefined
}

function recentBest(sets: SetLog[], valueOf: (s: SetLog) => number): number | undefined {
  const bests = recentSessions(sets).flatMap((g) => { const v = g.map(valueOf).filter((x) => x > 0); return v.length ? [Math.max(...v)] : [] })
  return bests.length ? median(bests) : undefined
}

// ---- rounding -------------------------------------------------------------------------------------

/** Practical step: 2.5 kg or 5 lb (in the user's units), never below one step. Returns kg. */
export function roundWeightKg(kg: number, units: Units): number {
  const step = units === 'kg' ? 2.5 : 5
  const display = Math.max(step, Math.round(kgToDisplay(kg, units) / step) * step)
  return displayToKg(display, units)
}

const weightAtReps = (e1rm: number, reps: number) => (reps <= 1 ? e1rm : e1rm / (1 + reps / 30))

// ---- main ---------------------------------------------------------------------------------------

export function suggestStart(
  target: Exercise,
  candidates: SuggestSource[],
  opts: { muscles: MuscleGroup[]; units: Units; targetReps?: number },
): StartSuggestion | undefined {
  const t = target.trackingType
  if (t !== 'weight_reps' && t !== 'bodyweight_added' && t !== 'bodyweight_reps' && t !== 'duration') return undefined
  const byId = new Map(opts.muscles.map((m) => [m.id, m]))
  const targetReps = Math.min(30, Math.max(1, Math.round(opts.targetReps ?? DEFAULT_TARGET_REPS)))

  const scored = candidates
    .map((c) => ({ ...c, score: similarity(target, c.exercise, byId) }))
    .filter((c) => c.score > 0 && usable(c.sets).length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SOURCES)
  if (!scored.length) return undefined

  const basedOn = scored.map((c) => ({ id: c.exercise.id, name: c.exercise.name }))
  const sameEquipmentCount = scored.filter((c) => !!target.equipment && c.exercise.equipment === target.equipment).length
  const confidence: StartSuggestion['confidence'] = scored.length >= 2 && sameEquipmentCount >= 1 ? 'estimate' : 'rough'

  if (t === 'bodyweight_reps' || t === 'duration') {
    const value = (s: SetLog) => (t === 'duration' ? s.durationSec ?? 0 : s.reps ?? 0)
    const per = scored.flatMap((c) => { const v = recentBest(c.sets, value); return v === undefined ? [] : [{ v, w: c.score }] })
    if (!per.length) return undefined
    const typical = per.reduce((a, b) => a + b.v * b.w, 0) / per.reduce((a, b) => a + b.w, 0)
    return t === 'duration'
      ? { durationSec: Math.max(5, Math.round((typical * SAFETY) / 5) * 5), basedOn, confidence }
      : { reps: Math.max(1, Math.round(typical * SAFETY)), basedOn, confidence }
  }

  // Weighted lifts: normalise each source to a barbell-equivalent 1RM, average, convert to the target's equipment.
  const isAdded = t === 'bodyweight_added'
  const loadOf = (s: SetLog) => (isAdded ? s.extraWeight : s.weight)
  const per = scored.flatMap((c) => {
    const e = recentE1rm(c.sets, loadOf)
    return e === undefined ? [] : [{ e: isAdded ? e : e / factor(c.exercise.equipment), w: c.score }]
  })
  if (!per.length) return undefined
  const normalised = per.reduce((a, b) => a + b.e * b.w, 0) / per.reduce((a, b) => a + b.w, 0)
  const targetE1rm = isAdded ? normalised : normalised * factor(target.equipment)
  const raw = weightAtReps(targetE1rm, targetReps) * SAFETY
  const step = opts.units === 'kg' ? 2.5 : 5
  const weightKg = kgToDisplay(raw, opts.units) < step / 2 ? 0 : roundWeightKg(raw, opts.units)
  return { weightKg, reps: targetReps, basedOn, confidence }
}
