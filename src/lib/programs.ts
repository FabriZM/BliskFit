import type { ID, Program } from '../db/types'

const DAY_MS = 86_400_000
const utcDay = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
/** Whole local calendar days from a to b (DST-safe). */
export const dayDiff = (a: Date, b: Date) => Math.round((utcDay(b) - utcDay(a)) / DAY_MS)

export function weekStart(d: Date, weekStartDay: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() - weekStartDay + 7) % 7))
  return x
}

/** 0-based week of the program that `today` falls in (programs repeat), or null before it starts. */
export function programWeek(startDate: number, today: Date, weekStartDay: number, weeks: number): number | null {
  const diff = dayDiff(weekStart(new Date(startDate), weekStartDay), weekStart(today, weekStartDay))
  return diff < 0 ? null : Math.floor(diff / 7) % Math.max(1, weeks)
}

export interface SessionRef { routineId?: ID; status: string; startedAt: number }

export type Suggestion =
  | { kind: 'none' }
  | { kind: 'notStarted'; startDate: number }
  | { kind: 'rest' }
  | { kind: 'routine'; routineId: ID; mode: 'schedule' | 'rotation'; trainedToday: boolean }

export function suggestToday(input: {
  program?: Program
  sessions: SessionRef[]
  today: Date
  weekStartDay: number
  /** routine ids that still exist and aren't archived */
  validRoutineIds?: Set<ID>
}): Suggestion {
  const { program, sessions, today, weekStartDay, validRoutineIds } = input
  if (!program) return { kind: 'none' }
  const valid = (id?: ID): id is ID => !!id && (!validRoutineIds || validRoutineIds.has(id))
  const finished = sessions.filter((s) => s.status === 'finished').sort((a, b) => b.startedAt - a.startedAt)
  const sameDay = (s: SessionRef) => dayDiff(new Date(s.startedAt), today) === 0

  if (program.mode === 'rotation') {
    const rot = (program.rotation ?? []).filter(valid)
    if (!rot.length) return { kind: 'none' }
    const last = finished.find((s) => s.routineId && rot.includes(s.routineId))
    const next = last ? rot[(rot.indexOf(last.routineId!) + 1) % rot.length] : rot[0]
    return { kind: 'routine', routineId: next, mode: 'rotation', trainedToday: finished.some((s) => sameDay(s) && !!s.routineId && rot.includes(s.routineId)) }
  }

  if (program.startDate === undefined) return { kind: 'none' }
  const week = programWeek(program.startDate, today, weekStartDay, program.weeks)
  if (week === null) return { kind: 'notStarted', startDate: weekStart(new Date(program.startDate), weekStartDay).getTime() }
  const routineId = program.schedule?.[week]?.[today.getDay()]
  if (!valid(routineId)) return { kind: 'rest' }
  return { kind: 'routine', routineId, mode: 'schedule', trainedToday: finished.some((s) => sameDay(s) && s.routineId === routineId) }
}

/** Resize a weekday schedule; new weeks start empty, removed weeks are dropped. */
export function resizeSchedule(schedule: Program['schedule'], weeks: number): NonNullable<Program['schedule']> {
  const out: NonNullable<Program['schedule']> = {}
  for (let w = 0; w < weeks; w++) out[w] = { ...(schedule?.[w] ?? {}) }
  return out
}

export function copyWeekToAll(schedule: Program['schedule'], weeks: number, from = 0): NonNullable<Program['schedule']> {
  const out: NonNullable<Program['schedule']> = {}
  for (let w = 0; w < weeks; w++) out[w] = { ...(schedule?.[from] ?? {}) }
  return out
}

/** Drop references to routines that no longer apply (e.g. archived). */
export function pruneProgram(p: Program, valid: Set<ID>): Program {
  return {
    ...p,
    rotation: p.rotation?.filter((id) => valid.has(id)),
    schedule: p.schedule && Object.fromEntries(Object.entries(p.schedule).map(([w, days]) =>
      [w, Object.fromEntries(Object.entries(days).filter(([, id]) => valid.has(id)))])),
  }
}
