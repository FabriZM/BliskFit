import type { Exercise, ID, Routine, RoutineExercise, SessionExercise, SetLog } from '../db/types'
import { newId } from './id'

export function defaultsFor(ex: Exercise): Omit<RoutineExercise, 'id' | 'exerciseId'> {
  switch (ex.trackingType) {
    case 'cardio': return { targetSets: 1 }
    case 'duration': return { targetSets: 3 }
    default: return { targetSets: 3, repMin: 8, repMax: 12 }
  }
}

export function addExercises(r: Routine, exs: Exercise[]): Routine {
  const added = exs.map((e): RoutineExercise => ({ id: newId(), exerciseId: e.id, ...defaultsFor(e) }))
  return { ...r, exercises: [...r.exercises, ...added] }
}

/** What superset grouping needs from a routine's or a session's exercises. */
type Grouped = { supersetGroup?: string; restSec?: number }

/**
 * Keeps superset groups valid: members are contiguous, a group has 2+ members, and all members share the
 * last rest value set in the group (one shared timer per group). Non-contiguous runs of one id become separate groups.
 */
export function normalizeGroups<T extends Grouped>(exs: T[]): T[] {
  const out = exs.map((e) => ({ ...e }))
  const seen = new Set<string>()
  let i = 0
  while (i < out.length) {
    const g = out[i].supersetGroup
    if (!g) { i++; continue }
    let j = i
    while (j + 1 < out.length && out[j + 1].supersetGroup === g) j++
    const run = out.slice(i, j + 1)
    if (run.length < 2) {
      delete out[i].supersetGroup
    } else {
      const id = seen.has(g) ? newId() : g
      seen.add(id)
      const rest = [...run].reverse().find((e) => e.restSec !== undefined)?.restSec
      for (const e of run) {
        e.supersetGroup = id
        if (rest === undefined) delete e.restSec
        else e.restSec = rest
      }
    }
    i = j + 1
  }
  return out
}

export function moveExercise<T extends Grouped>(exs: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= exs.length || to >= exs.length) return exs
  const next = [...exs]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return normalizeGroups(next)
}

export function removeExercise(exs: RoutineExercise[], index: number): RoutineExercise[] {
  return normalizeGroups(exs.filter((_, i) => i !== index))
}

/** Join exercise `i` and `i+1` into one superset/circuit (merging with either side's existing group). */
export function linkWithNext(exs: RoutineExercise[], i: number): RoutineExercise[] {
  if (i < 0 || i >= exs.length - 1) return exs
  const a = exs[i], b = exs[i + 1]
  const gid = a.supersetGroup ?? b.supersetGroup ?? newId()
  const oldB = b.supersetGroup
  return normalizeGroups(exs.map((e, k) => {
    if (k === i || k === i + 1 || (oldB && e.supersetGroup === oldB)) return { ...e, supersetGroup: gid }
    return e
  }))
}

/** Split the group between `i` and `i+1`. */
export function unlinkFromNext(exs: RoutineExercise[], i: number): RoutineExercise[] {
  const a = exs[i], b = exs[i + 1]
  if (!a?.supersetGroup || a.supersetGroup !== b?.supersetGroup) return exs
  const old = a.supersetGroup
  const gid = newId()
  return normalizeGroups(exs.map((e, k) => (k > i && e.supersetGroup === old ? { ...e, supersetGroup: gid } : e)))
}

/** Set rest for an exercise; for grouped exercises it applies to the whole group. */
export function setRest<T extends { supersetGroup?: string; restSec?: number }>(exs: T[], i: number, restSec: number | undefined): T[] {
  const g = exs[i]?.supersetGroup
  return exs.map((e, k) => {
    if (k !== i && !(g && e.supersetGroup === g)) return e
    const next = { ...e, restSec }
    if (restSec === undefined) delete next.restSec
    return next
  })
}

export function setRepRange(e: RoutineExercise, patch: { repMin?: number; repMax?: number }): RoutineExercise {
  const next = { ...e, ...patch }
  if (next.repMin !== undefined && next.repMax !== undefined) {
    if ('repMin' in patch && next.repMin > next.repMax) next.repMax = next.repMin
    else if ('repMax' in patch && next.repMax < next.repMin) next.repMin = next.repMax
  }
  return next
}

export type GroupPos = { pos: 'single' | 'start' | 'middle' | 'end'; size: number }

export function groupPositions(exs: { supersetGroup?: string }[]): GroupPos[] {
  return exs.map((e, i) => {
    const g = e.supersetGroup
    if (!g) return { pos: 'single', size: 1 }
    const prev = exs[i - 1]?.supersetGroup === g
    const next = exs[i + 1]?.supersetGroup === g
    const size = exs.filter((x) => x.supersetGroup === g).length
    return { pos: prev && next ? 'middle' : prev ? 'end' : 'start', size }
  })
}

export function duplicateRoutine(r: Routine, name: string): Routine {
  const groups = new Map<string, string>()
  return {
    id: newId(),
    name,
    archived: false,
    exercises: r.exercises.map((e) => {
      const copy: RoutineExercise = { ...e, id: newId() }
      if (e.supersetGroup) {
        if (!groups.has(e.supersetGroup)) groups.set(e.supersetGroup, newId())
        copy.supersetGroup = groups.get(e.supersetGroup)
      }
      return copy
    }),
  }
}

/** Replace an exercise in a routine (first occurrence, or every occurrence with `all`), keeping sets/rest/group. */
export function replaceExercise(r: Routine, oldId: string, next: Exercise, all = false): Routine {
  let done = false
  return {
    ...r,
    exercises: r.exercises.map((e) => {
      if (e.exerciseId !== oldId || (done && !all)) return e
      done = true
      const d = defaultsFor(next)
      const out: RoutineExercise = { ...e, exerciseId: next.id }
      if (d.repMin === undefined) { delete out.repMin; delete out.repMax } else if (out.repMin === undefined) { out.repMin = d.repMin; out.repMax = d.repMax }
      return out
    }),
  }
}

/** What a workout changed in its routine's plan (see routineUpdate). */
export interface RoutineChanges {
  /** The routine's exercises as the workout left them. */
  exercises: RoutineExercise[]
  added: ID[]
  removed: ID[]
  /** Exercises reordered, or supersets linked or split. */
  reordered: boolean
  /** Exercises whose number of sets changed. */
  sets: { exerciseId: ID; from: number; to: number }[]
}

/** Each exercise with the index of the first member of its superset (or its own), to compare grouping. */
const layout = (exs: { exerciseId: ID; supersetGroup?: string }[]) =>
  exs.map((e, i) => `${e.exerciseId}@${e.supersetGroup ? exs.findIndex((x) => x.supersetGroup === e.supersetGroup) : i}`).join('|')

/**
 * The routine as this workout left it: exercises in the workout's order and supersets, exercises added or removed
 * during it, and each one's number of sets (done or not). Rep ranges and rests stay the routine's; skipping an
 * exercise doesn't count. Workout exercises are matched to the routine's by exercise, in order. Null if nothing
 * changed.
 */
export function routineUpdate(routine: Routine, items: SessionExercise[], sets: SetLog[]): RoutineChanges | null {
  const unused = [...routine.exercises]
  const matched = items.map((it) => {
    const k = unused.findIndex((r) => r.exerciseId === it.exerciseId)
    return k < 0 ? undefined : unused.splice(k, 1)[0]
  })
  const count = (it: SessionExercise) => Math.max(1, sets.filter((s) => s.itemId === it.id).length)
  const exercises = normalizeGroups(items.map((it, i): RoutineExercise => {
    const r = matched[i]
    const e: RoutineExercise = r ? { ...r, targetSets: count(it), supersetGroup: it.supersetGroup }
      : { id: newId(), exerciseId: it.exerciseId, targetSets: count(it), repMin: it.repMin, repMax: it.repMax, supersetGroup: it.supersetGroup }
    if (e.supersetGroup === undefined) delete e.supersetGroup
    for (const k of ['repMin', 'repMax'] as const) if (e[k] === undefined) delete e[k]
    return e
  }))
  const added = items.filter((_, i) => !matched[i]).map((it) => it.exerciseId)
  const removed = unused.map((r) => r.exerciseId)
  const kept = routine.exercises.filter((r) => !unused.includes(r))
  const reordered = layout(kept) !== layout(exercises.filter((_, i) => matched[i]))
  const setChanges = items.flatMap((it, i) => {
    const r = matched[i]
    return r && r.targetSets !== count(it) ? [{ exerciseId: it.exerciseId, from: r.targetSets, to: count(it) }] : []
  })
  if (!added.length && !removed.length && !reordered && !setChanges.length) return null
  return { exercises, added, removed, reordered, sets: setChanges }
}
