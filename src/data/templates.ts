/**
 * Starter routines and programs, offered on the Workout tab so a new install isn't empty. Exercises are library
 * ids (`x:…`, checked against the seed by templates.test.ts). Names and descriptions live in the i18n files under
 * `templates.<id>`; routines are keyed by `templates.<id>.r.<key>`. Adding one makes ordinary, deletable copies.
 */
export type TemplateLevel = 'beginner' | 'intermediate'

/** [library exercise id, sets, min reps, max reps] (for timed holds the reps are seconds-agnostic and ignored by the UI). */
type Row = [id: string, sets: number, repMin: number, repMax: number]

export interface Template {
  id: string
  level: TemplateLevel
  daysPerWeek: number
  routines: { key: string; exercises: Row[] }[]
  /** Weekday mode: week → weekday (0 = Sunday) → routine index. Rotation mode: routine indexes in order. */
  program: { mode: 'weekday'; weeks: number; schedule: Record<number, Record<number, number>> } | { mode: 'rotation'; weeks: 1; rotation: number[] }
}

export const TEMPLATES: Template[] = [
  {
    id: 'fullBody3',
    level: 'beginner',
    daysPerWeek: 3,
    routines: [
      { key: 'a', exercises: [['x:Barbell_Squat', 3, 5, 8], ['x:Barbell_Bench_Press_-_Medium_Grip', 3, 5, 8], ['x:Bent_Over_Barbell_Row', 3, 6, 10], ['x:Plank', 3, 30, 60]] },
      { key: 'b', exercises: [['x:Romanian_Deadlift', 3, 6, 10], ['x:Standing_Military_Press', 3, 6, 10], ['x:Wide-Grip_Lat_Pulldown', 3, 8, 12], ['x:Leg_Press', 3, 8, 12]] },
    ],
    program: { mode: 'weekday', weeks: 2, schedule: { 0: { 1: 0, 3: 1, 5: 0 }, 1: { 1: 1, 3: 0, 5: 1 } } },
  },
  {
    id: 'upperLower4',
    level: 'intermediate',
    daysPerWeek: 4,
    routines: [
      { key: 'upper', exercises: [['x:Barbell_Bench_Press_-_Medium_Grip', 4, 6, 10], ['x:Bent_Over_Barbell_Row', 4, 6, 10], ['x:Seated_Dumbbell_Press', 3, 8, 12], ['x:Wide-Grip_Lat_Pulldown', 3, 8, 12], ['x:Barbell_Curl', 3, 8, 12], ['x:Triceps_Pushdown', 3, 10, 15]] },
      { key: 'lower', exercises: [['x:Barbell_Squat', 4, 5, 8], ['x:Romanian_Deadlift', 3, 8, 10], ['x:Leg_Press', 3, 10, 12], ['x:Lying_Leg_Curls', 3, 10, 15], ['x:Standing_Calf_Raises', 4, 10, 15]] },
    ],
    program: { mode: 'weekday', weeks: 1, schedule: { 0: { 1: 0, 2: 1, 4: 0, 5: 1 } } },
  },
  {
    id: 'ppl',
    level: 'intermediate',
    daysPerWeek: 3,
    routines: [
      { key: 'push', exercises: [['x:Barbell_Bench_Press_-_Medium_Grip', 4, 6, 10], ['x:Incline_Dumbbell_Press', 3, 8, 12], ['x:Dumbbell_Shoulder_Press', 3, 8, 12], ['x:Side_Lateral_Raise', 3, 12, 15], ['x:Triceps_Pushdown', 3, 10, 15]] },
      { key: 'pull', exercises: [['x:Pullups', 4, 5, 10], ['x:Bent_Over_Barbell_Row', 4, 6, 10], ['x:Seated_Cable_Rows', 3, 8, 12], ['x:Face_Pull', 3, 12, 15], ['x:Hammer_Curls', 3, 10, 12]] },
      { key: 'legs', exercises: [['x:Barbell_Squat', 4, 5, 8], ['x:Romanian_Deadlift', 3, 8, 10], ['x:Leg_Press', 3, 10, 12], ['x:Lying_Leg_Curls', 3, 10, 15], ['x:Standing_Calf_Raises', 4, 10, 15]] },
    ],
    program: { mode: 'rotation', weeks: 1, rotation: [0, 1, 2] },
  },
  {
    id: 'bodyweight3',
    level: 'beginner',
    daysPerWeek: 3,
    routines: [
      { key: 'a', exercises: [['x:Pushups', 3, 8, 15], ['x:Bodyweight_Squat', 3, 12, 20], ['x:Plank', 3, 30, 60]] },
      { key: 'b', exercises: [['x:Incline_Push-Up', 3, 8, 15], ['x:Bodyweight_Walking_Lunge', 3, 10, 16], ['x:Butt_Lift_Bridge', 3, 12, 20]] },
    ],
    program: { mode: 'weekday', weeks: 2, schedule: { 0: { 1: 0, 3: 1, 5: 0 }, 1: { 1: 1, 3: 0, 5: 1 } } },
  },
]
