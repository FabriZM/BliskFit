import type { Exercise, ID } from '../db/types'

/** Searchable text of an exercise's muscles: its primary ones, or all (primary and secondary). See muscleSearchText. */
export type MuscleText = (e: Exercise, scope: 'primary' | 'all') => string

export interface ExerciseFilter {
  /** Words to find in the name or the equipment (see matchesQuery). */
  query: string
  /** The equipment's name as shown (translated), so it can be searched too. */
  equipmentLabel?: (equipment: string) => string
  /** The name as shown (translated for built-in exercises); searched alongside the stored name and used to sort. */
  displayName?: (e: Exercise) => string
  /** Lets the query name a muscle ("chest", "pecho", "legs") as well as the exercise; primary-muscle matches sort first. */
  muscleText?: MuscleText
  /** Muscle ids already expanded with descendants; empty = no muscle filter. */
  muscleIds: Set<ID>
  equipment: string
  /** Favorite ids; they sort first, and `favoritesOnly` hides everything else. */
  favorites?: Set<ID>
  favoritesOnly?: boolean
  /** Match the muscle filter on primary muscles only (e.g. swapping: same main target, not just a helper). */
  primaryOnly?: boolean
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * The exercise search used everywhere: every word typed must appear in the exercise's name (stored or as shown via
 * `displayName`, so "press de banca" and "bench press" both work) or its equipment (as stored, e.g. "body only", or
 * as shown via `equipmentLabel`) or its muscles (via `muscleText`), ignoring case and accents. "cable row" finds rows
 * on a cable, "chest" the exercises that work the chest; an empty query matches everything.
 */
export function matchesQuery<E extends Pick<Exercise, 'name' | 'equipment'>>(
  e: E, query: string, equipmentLabel?: (equipment: string) => string, displayName?: (e: E) => string,
  muscleText?: (e: E) => string,
): boolean {
  const words = norm(query).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const eq = e.equipment ?? 'none'
  const hay = norm(`${e.name} ${displayName?.(e) ?? ''} ${eq} ${equipmentLabel?.(eq) ?? ''} ${muscleText?.(e) ?? ''}`)
  return words.every((w) => hay.includes(w))
}

export function filterExercises(list: Exercise[], f: ExerciseFilter): Exercise[] {
  return list
    .filter((e) => {
      if (!matchesQuery(e, f.query, f.equipmentLabel, f.displayName, f.muscleText && ((x) => f.muscleText!(x, 'all')))) return false
      if (f.equipment && (e.equipment ?? 'none') !== f.equipment) return false
      if (f.favoritesOnly && !f.favorites?.has(e.id)) return false
      if (f.muscleIds.size) {
        const hit = [...e.primaryMuscleIds, ...(f.primaryOnly ? [] : e.secondaryMuscleIds)].some((id) => f.muscleIds.has(id))
        if (!hit) return false
      }
      return true
    })
    .sort((a, b) => {
      // Primary-muscle matches first when filtering by muscle.
      if (f.muscleIds.size) {
        const pa = a.primaryMuscleIds.some((id) => f.muscleIds.has(id)) ? 0 : 1
        const pb = b.primaryMuscleIds.some((id) => f.muscleIds.has(id)) ? 0 : 1
        if (pa !== pb) return pa - pb
      }
      // A typed muscle ("chest") puts exercises that train it as a main muscle before those that only help.
      if (f.muscleText && f.query.trim()) {
        const main = (e: Exercise) => (matchesQuery(e, f.query, f.equipmentLabel, f.displayName, (x) => f.muscleText!(x, 'primary')) ? 0 : 1)
        const d = main(a) - main(b)
        if (d) return d
      }
      const fa = f.favorites?.has(a.id) ? 0 : 1
      const fb = f.favorites?.has(b.id) ? 0 : 1
      if (fa !== fb) return fa - fb
      const name = f.displayName ?? ((e: Exercise) => e.name)
      return name(a).localeCompare(name(b))
    })
}
