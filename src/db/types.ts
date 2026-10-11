export type ID = string

export type TrackingType =
  | 'weight_reps'
  | 'bodyweight_reps'
  | 'bodyweight_added'
  | 'assisted_bodyweight'
  | 'duration'
  | 'cardio'

export type SetType = 'warmup' | 'working' | 'drop'
export type SessionStatus = 'active' | 'paused' | 'finished'
export type Units = 'kg' | 'lb'
export type Language = 'en' | 'es'

export interface MuscleGroup {
  id: ID
  name: string
  parentId?: ID
}

export interface Exercise {
  id: ID
  name: string
  trackingType: TrackingType
  equipment?: string
  primaryMuscleIds: ID[]
  secondaryMuscleIds: ID[]
  photo?: Blob
  demoUrl?: string
  videoUrl?: string
  defaultRestSec?: number
  learnedRestSec?: number
  source: 'seeded' | 'custom'
}

export interface Gym {
  id: ID
  name: string
}

export interface ExerciseGymNote {
  id: ID
  exerciseId: ID
  gymId?: ID
  text: string
  photo?: Blob
}

export interface RoutineExercise {
  id: ID
  exerciseId: ID
  targetSets: number
  repMin?: number
  repMax?: number
  restSec?: number
  supersetGroup?: string
}

export interface Routine {
  id: ID
  name: string
  exercises: RoutineExercise[]
  archived: boolean
}

export interface Program {
  id: ID
  name: string
  weeks: number
  mode: 'weekday' | 'rotation'
  /** weekday mode: weekIndex -> weekday (0-6) -> routineId */
  schedule?: Record<number, Record<number, ID>>
  /** weekday mode: any date inside week 1 (local time); the week is aligned to Settings.weekStartDay */
  startDate?: number
  /** rotation mode: ordered routine ids (A/B/C), no duplicates (position is inferred from history) */
  rotation?: ID[]
}

export interface PausedInterval {
  start: number
  end?: number
}

export interface WorkoutSession {
  id: ID
  startedAt: number
  endedAt?: number
  routineId?: ID
  gymId?: ID
  notes?: string
  status: SessionStatus
  pausedIntervals: PausedInterval[]
}

export interface SetLog {
  id: ID
  sessionId: ID
  exerciseId: ID
  order: number
  setType: SetType
  weight?: number
  /** Added (weighted) or assist (assisted) weight, depending on tracking type. */
  extraWeight?: number
  reps?: number
  durationSec?: number
  distanceM?: number
  rpe?: number
  rir?: number
  failure?: boolean
  doneAt?: number
}

export interface ExerciseNote {
  id: ID
  exerciseId: ID
  text: string
  pinned: boolean
}

export interface BodyWeight {
  id: ID
  date: number
  weight: number
}

export interface Measurement {
  id: ID
  date: number
  type: string
  value: number
}

export interface Settings {
  id: 'settings'
  weeklyGoal: number
  weekStartDay: number
  units: Units
  language: Language
  defaultRestSec: number
  prBadges: boolean
  reminderDays: number[]
  streakFreezes: number
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  weeklyGoal: 3,
  weekStartDay: 1,
  units: 'kg',
  language: 'en',
  defaultRestSec: 90,
  prBadges: true,
  reminderDays: [],
  streakFreezes: 1,
}
