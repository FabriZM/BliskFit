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
  /** Compound (multi-joint) or isolation; used to find comparable exercises for starting-weight suggestions. */
  mechanic?: 'compound' | 'isolation'
  level?: 'beginner' | 'intermediate' | 'expert'
  /** Free text written by the user; when absent the app describes the exercise from its muscles and mechanic. */
  description?: string
  /** How to do it, one step per entry. */
  instructions?: string[]
  primaryMuscleIds: ID[]
  secondaryMuscleIds: ID[]
  photo?: Blob
  demoUrl?: string
  videoUrl?: string
  defaultRestSec?: number
  learnedRestSec?: number
  /** Set by the user from a workout ("always for this exercise"); wins over learned and default rest. 0 = no timer. */
  customRestSec?: number
  /** Unit printed on this exercise's equipment (e.g. a machine in lb); absent = the app's units. Weights stay stored in kg. */
  weightUnit?: Units
  /** Plate calculator on or off; absent = on for barbells and EZ bars (see lib/plates). */
  plateLoaded?: boolean
  /** Bar or sled weight, in kg; absent = the usual bar for the equipment. Logged weights always include it. */
  barKg?: number
  source: 'seeded' | 'custom'
}

export interface Gym {
  id: ID
  name: string
  /** Optional visit plan (e.g. 12 visits per month). Absent = no plan, and nothing about it is shown anywhere. */
  allowance?: GymAllowance
  /**
   * Manual corrections to which days count as visits, by YYYY-MM-DD: 'add' counts a day without a recorded
   * workout (e.g. you forgot to log it), 'remove' excludes a day that has one (e.g. the gym didn't count it).
   * Kept separate from the plan, so removing and re-adding a plan doesn't lose them.
   */
  visitAdjustments?: Record<string, 'add' | 'remove'>
}

export interface GymAllowance {
  /** Visits included per period. */
  visits: number
  /** Day of month a period starts on (1 = calendar month); clamped to short months, so 31 means "last day". */
  startDay: number
  /** YYYY-MM-DD the plan was set up; periods before it aren't counted. */
  since: string
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
  /** Optional default gym for workouts started from this program. */
  gymId?: ID
}

export interface PausedInterval {
  start: number
  end?: number
}

/** One exercise in a session's plan: copied from the routine at start, then freely editable mid-workout. */
export interface SessionExercise {
  id: ID
  exerciseId: ID
  targetSets: number
  repMin?: number
  repMax?: number
  restSec?: number
  supersetGroup?: string
  skipped?: boolean
}

/** Timestamps, not a countdown, so it survives the phone sleeping or the app reloading. */
export interface RestTimer {
  startedAt: number
  endsAt: number
  exerciseId: ID
}

export interface WorkoutSession {
  id: ID
  startedAt: number
  endedAt?: number
  routineId?: ID
  /** Name of the routine when the session started; kept so history still names it after the routine is deleted. */
  routineName?: string
  gymId?: ID
  notes?: string
  status: SessionStatus
  pausedIntervals: PausedInterval[]
  exercises: SessionExercise[]
  rest?: RestTimer
  /** Set when the user chooses "keep going" on the forgotten-session prompt. */
  forgotAckAt?: number
}

export interface SetLog {
  id: ID
  sessionId: ID
  /** The SessionExercise this set belongs to (an exercise may appear twice in one session). */
  itemId?: ID
  exerciseId: ID
  order: number
  setType: SetType
  /** Always stored in kg; converted for display (see lib/units). */
  weight?: number
  /**
   * Unit the weights of this set were typed in (what was printed on the equipment that day), so it always shows
   * as typed. Absent on sets from before this existed: those show in the app's units.
   */
  unit?: Units
  /** Added (weighted) or assist (assisted) weight, depending on tracking type. */
  extraWeight?: number
  reps?: number
  durationSec?: number
  distanceM?: number
  /**
   * Fields whose value was carried over from an earlier set as it was typed (shown dimmer), not entered here. They
   * keep following that set until typed over; cleared once the set is done.
   */
  copied?: SetValueKey[]
  rpe?: number
  rir?: number
  failure?: boolean
  doneAt?: number
}

/** A set's typed values (the unit goes with the weights). */
export type SetValueKey = 'weight' | 'extraWeight' | 'reps' | 'durationSec' | 'distanceM'

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

export interface ProgressPhoto {
  id: ID
  /** Local timestamp of the photo's day (the 6-per-day limit counts local calendar days). */
  date: number
  /** User-defined label used to compare like with like; absent = untagged. */
  tag?: string
  photo: Blob
  note?: string
}

export type StatsRange = '4w' | '3m' | '6m' | '1y' | 'all'

/** A metric of one exercise that can be charted (which ones apply depends on the tracking type). */
export type ExerciseMetric =
  | 'e1rm' | 'maxWeight' | 'volume' | 'reps' | 'bestReps' | 'minAssist' | 'bestDuration' | 'totalDuration' | 'distance' | 'pace'

/** What a pinned stat shows (not a snapshot of values); see lib/pins. */
export interface PinSpec {
  kind: 'weekly' | 'muscles' | 'exercise' | 'bodyweight' | 'measurement' | 'photo'
  range: StatsRange
  exerciseId?: ID
  metric?: ExerciseMetric
  muscleId?: ID
  /** Measurement type, e.g. "waist" or "biceps_l". */
  measurement?: string
  /** photo: tag of the pinned photos (undefined = untagged) and whether to show the latest or first vs latest. */
  tag?: string
  photoMode?: 'latest' | 'compare'
}

export interface Settings {
  id: 'settings'
  weeklyGoal: number
  weekStartDay: number
  units: Units
  language: Language
  defaultRestSec: number
  prBadges: boolean
  /** Weekdays (0 = Sunday) with a training reminder; empty = reminders off. */
  reminderDays: number[]
  /** Local time of day for those reminders, HH:MM. */
  reminderTime: string
  /** Missed weeks per calendar month that may be bridged without breaking the streak (0 = off). */
  streakFreezes: number
  /** Show the full-screen rest countdown whenever a set is finished. */
  restPopup: boolean
  /** Stats pinned to Profile, in display order (max 6). */
  pinnedStats: PinSpec[]
  /** The suggested default pins were dismissed. */
  pinsDismissed: boolean
  /** Weekly sets per muscle group below which it is called under-trained. */
  setsTarget: number
  /** Sessions without improvement in the best e1RM before an exercise is flagged as plateaued. */
  plateauSessions: number
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
  reminderTime: '18:00',
  streakFreezes: 1,
  restPopup: true,
  pinnedStats: [],
  pinsDismissed: false,
  setsTarget: 10,
  plateauSessions: 5,
}
