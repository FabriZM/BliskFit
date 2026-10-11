import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Exercise, SetLog, Units } from '../../db/types'
import { suggestStart, type StartSuggestion, type SuggestSource } from '../../lib/suggest'

/** Starting-weight suggestion for an exercise with no history, from similar exercises that have some. */
export function useStartingSuggestion(exercise: Exercise | undefined, enabled: boolean, units: Units, targetReps?: number): StartSuggestion | undefined {
  return useLiveQuery(async () => {
    if (!enabled || !exercise) return undefined
    const [muscles, sets] = await Promise.all([
      db.muscleGroups.toArray(),
      db.setLogs.filter((s) => s.doneAt !== undefined && s.setType !== 'warmup' && s.exerciseId !== exercise.id).toArray(),
    ])
    const byExercise = new Map<string, SetLog[]>()
    for (const s of sets) byExercise.set(s.exerciseId, [...(byExercise.get(s.exerciseId) ?? []), s])
    const exercises = await db.exercises.bulkGet([...byExercise.keys()])
    const candidates: SuggestSource[] = exercises.flatMap((e) => (e ? [{ exercise: e, sets: byExercise.get(e.id)! }] : []))
    return suggestStart(exercise, candidates, { muscles, units, targetReps })
  }, [exercise?.id, enabled, units, targetReps])
}
