import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type { BodyWeight, Exercise, Gym, Measurement, MuscleGroup, PinSpec, ProgressPhoto, SetLog, WorkoutSession } from './types'
import { computeAllPRs, type PRKind } from '../lib/prs'
import { isWorkingSet, weekBuckets, type ExerciseLite, type WeekBucket } from '../lib/stats'
import { validPins, type PinTargets } from '../lib/pins'
import { useSettings } from '../stores/settings'

export interface StatsData {
  sessions: WorkoutSession[]
  /** Completed non-warm-up sets of finished sessions. */
  sets: SetLog[]
  exercises: Exercise[]
  muscles: MuscleGroup[]
  gyms: Gym[]
  favorites: Set<string>
  bodyWeights: BodyWeight[]
  measurements: Measurement[]
  photos: ProgressPhoto[]
}

/** Everything the Stats panel and the pinned cards need, live. */
export function useStatsData(): StatsData | undefined {
  return useLiveQuery(async (): Promise<StatsData> => {
    const sessions = await db.sessions.where('status').equals('finished').toArray()
    const ids = new Set(sessions.map((s) => s.id))
    const sets = await db.setLogs.filter((s) => isWorkingSet(s) && ids.has(s.sessionId)).toArray()
    return {
      sessions, sets,
      exercises: await db.exercises.toArray(),
      muscles: await db.muscleGroups.toArray(),
      gyms: await db.gyms.toArray(),
      favorites: new Set((await db.favorites.toArray()).map((f) => f.exerciseId)),
      bodyWeights: await db.bodyWeights.orderBy('date').toArray(),
      measurements: await db.measurements.orderBy('date').toArray(),
      photos: await db.progressPhotos.orderBy('date').toArray(),
    }
  }, [])
}

export interface Derived {
  exById: Map<string, Exercise>
  buckets: Map<string, WeekBucket>
  /** setId -> PR kinds, recomputed from the logged sets. */
  prs: Map<string, PRKind[]>
}

export function useDerived(data: StatsData | undefined): Derived | undefined {
  const weekStartDay = useSettings((s) => s.settings.weekStartDay)
  return useMemo(() => {
    if (!data) return undefined
    const exById = new Map<string, ExerciseLite & Exercise>(data.exercises.map((e) => [e.id, e]))
    const prs = computeAllPRs(data.sets, (id) => exById.get(id)?.trackingType ?? 'weight_reps')
    return { exById, prs, buckets: weekBuckets(data.sessions, data.sets, exById, weekStartDay, new Set(prs.keys())) }
  }, [data, weekStartDay])
}

export const pinTargets = (d: StatsData): PinTargets => ({
  exerciseIds: new Set(d.exercises.map((e) => e.id)),
  muscleIds: new Set(d.muscles.map((m) => m.id)),
  measurementTypes: new Set(d.measurements.map((m) => m.type)),
  photoTags: new Set(d.photos.flatMap((p) => (p.tag ? [p.tag] : []))),
  hasUntaggedPhotos: d.photos.some((p) => !p.tag),
})

/** Pins whose target still exists (others disappear silently). */
export function usePins(data: StatsData | undefined): PinSpec[] {
  const pins = useSettings((s) => s.settings.pinnedStats)
  return useMemo(() => (data ? validPins(pins, pinTargets(data)) : []), [pins, data])
}

export async function setPins(pins: PinSpec[]): Promise<void> {
  await useSettings.getState().update({ pinnedStats: pins })
}
