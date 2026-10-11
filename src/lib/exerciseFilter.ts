import type { Exercise, ID } from '../db/types'

export interface ExerciseFilter {
  query: string
  /** Muscle ids already expanded with descendants; empty = no muscle filter. */
  muscleIds: Set<ID>
  equipment: string
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function filterExercises(list: Exercise[], f: ExerciseFilter): Exercise[] {
  const q = norm(f.query.trim())
  return list
    .filter((e) => {
      if (q && !norm(e.name).includes(q)) return false
      if (f.equipment && (e.equipment ?? 'none') !== f.equipment) return false
      if (f.muscleIds.size) {
        const hit = [...e.primaryMuscleIds, ...e.secondaryMuscleIds].some((id) => f.muscleIds.has(id))
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
      return a.name.localeCompare(b.name)
    })
}
