import type { Exercise, Gym, ID, Routine, SetLog, Units, WorkoutSession } from '../db/types'
import { kgToDisplay } from './units'

/** RFC 4180 field: quoted only when needed, quotes doubled. */
export function csvField(v: string | number | boolean | undefined): string {
  if (v === undefined) return ''
  const s = String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const csvRow = (fields: (string | number | boolean | undefined)[]) => fields.map(csvField).join(',')

const pad = (n: number) => String(n).padStart(2, '0')
const localDateTime = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export interface SetsCsvInput {
  sessions: WorkoutSession[]
  sets: SetLog[]
  exercises: Map<ID, Exercise>
  routines: Map<ID, Routine>
  gyms: Map<ID, Gym>
  units: Units
}

/**
 * One row per logged set of finished workouts, oldest first, weights in the chosen units. Blank sets (nothing
 * entered) are left out. Meant for spreadsheets; the JSON backup is what restores the app.
 */
export function setsToCsv({ sessions, sets, exercises, routines, gyms, units }: SetsCsvInput): string {
  const byId = new Map(sessions.filter((s) => s.status === 'finished').map((s) => [s.id, s]))
  // Exercises in the order the workout lists them, sets in their order within each.
  const position = (s: SetLog) => {
    const items = byId.get(s.sessionId)!.exercises
    const i = items.findIndex((it) => (s.itemId ? it.id === s.itemId : it.exerciseId === s.exerciseId))
    return i < 0 ? items.length : i
  }
  const w = (kg?: number) => (kg === undefined ? undefined : kgToDisplay(kg, units))
  const rows = sets
    .filter((s) => byId.has(s.sessionId) && (s.weight !== undefined || s.reps !== undefined || s.durationSec !== undefined || s.distanceM !== undefined))
    .sort((a, b) => byId.get(a.sessionId)!.startedAt - byId.get(b.sessionId)!.startedAt
      || position(a) - position(b) || a.order - b.order)
  // Number sets per exercise within each session.
  const counter = new Map<string, number>()
  const header = csvRow([
    'date', 'workout', 'gym', 'exercise', 'set', 'set_type', `weight_${units}`, `extra_weight_${units}`, 'reps',
    'duration_sec', 'distance_m', 'rpe', 'rir', 'failure', 'workout_notes',
  ])
  const lines = rows.map((s) => {
    const session = byId.get(s.sessionId)!
    const key = `${s.sessionId}|${s.exerciseId}`
    const n = (counter.get(key) ?? 0) + 1
    counter.set(key, n)
    return csvRow([
      localDateTime(session.startedAt),
      (session.routineId ? routines.get(session.routineId)?.name : undefined) ?? session.routineName,
      session.gymId ? gyms.get(session.gymId)?.name : undefined,
      exercises.get(s.exerciseId)?.name ?? s.exerciseId,
      n, s.setType, w(s.weight), w(s.extraWeight), s.reps, s.durationSec, s.distanceM, s.rpe, s.rir,
      s.failure ? 1 : undefined, session.notes,
    ])
  })
  return [header, ...lines].join('\r\n') + '\r\n'
}
