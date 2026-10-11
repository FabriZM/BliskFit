import Dexie, { type EntityTable } from 'dexie'
import type {
  BodyWeight, Exercise, ExerciseGymNote, ExerciseNote, Gym, Measurement,
  MuscleGroup, Program, Routine, SetLog, Settings, WorkoutSession,
} from './types'

export class GymDB extends Dexie {
  muscleGroups!: EntityTable<MuscleGroup, 'id'>
  exercises!: EntityTable<Exercise, 'id'>
  gyms!: EntityTable<Gym, 'id'>
  exerciseGymNotes!: EntityTable<ExerciseGymNote, 'id'>
  routines!: EntityTable<Routine, 'id'>
  programs!: EntityTable<Program, 'id'>
  sessions!: EntityTable<WorkoutSession, 'id'>
  setLogs!: EntityTable<SetLog, 'id'>
  exerciseNotes!: EntityTable<ExerciseNote, 'id'>
  bodyWeights!: EntityTable<BodyWeight, 'id'>
  measurements!: EntityTable<Measurement, 'id'>
  settings!: EntityTable<Settings, 'id'>
  meta!: EntityTable<{ key: string; value: unknown }, 'key'>
  favorites!: EntityTable<{ exerciseId: string }, 'exerciseId'>

  constructor(name = 'gymapp') {
    super(name)
    // Add future schema changes as version(2).stores({...}).upgrade(...); never edit v1.
    this.version(1).stores({
      muscleGroups: 'id, parentId, name',
      exercises: 'id, name, trackingType, equipment, source, *primaryMuscleIds, *secondaryMuscleIds',
      gyms: 'id, name',
      exerciseGymNotes: 'id, exerciseId, gymId',
      routines: 'id, name, archived',
      programs: 'id, name',
      sessions: 'id, startedAt, status, routineId, gymId',
      setLogs: 'id, sessionId, exerciseId, doneAt, [sessionId+exerciseId]',
      exerciseNotes: 'id, exerciseId, pinned',
      bodyWeights: 'id, date',
      measurements: 'id, date, type, [type+date]',
      settings: 'id',
    })
    // v2: key/value table (seed version, future flags).
    this.version(2).stores({ meta: 'key' })
    // v3: favorite exercises, kept apart from exercises so re-seeding the library never wipes them.
    this.version(3).stores({ favorites: 'exerciseId' })
  }
}

export const db = new GymDB()

export { newId } from '../lib/id'
