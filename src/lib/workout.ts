import type { Exercise, ID, SessionExercise, SetLog, TrackingType, WorkoutSession } from '../db/types'

export const FORGOTTEN_MS = 2 * 60 * 60 * 1000
const SEC = 1000

// ---- time -------------------------------------------------------------------------------------

/** Milliseconds of [from, to] that fall inside paused intervals (an open interval runs to `to`). */
export function pausedMs(s: Pick<WorkoutSession, 'pausedIntervals'>, from: number, to: number): number {
  let total = 0
  for (const p of s.pausedIntervals) {
    const a = Math.max(p.start, from)
    const b = Math.min(p.end ?? to, to)
    if (b > a) total += b - a
  }
  return total
}

export const activeMsBetween = (s: Pick<WorkoutSession, 'pausedIntervals'>, from: number, to: number) =>
  Math.max(0, to - from - pausedMs(s, from, to))

/** Session duration with paused time excluded. */
export const elapsedMs = (s: WorkoutSession, now: number) => activeMsBetween(s, s.startedAt, s.endedAt ?? now)

export function pauseSession(s: WorkoutSession, now: number): WorkoutSession {
  if (s.status !== 'active') return s
  return { ...s, status: 'paused', pausedIntervals: [...s.pausedIntervals, { start: now }] }
}

export function resumeSession(s: WorkoutSession, now: number): WorkoutSession {
  if (s.status !== 'paused') return s
  return {
    ...s,
    status: 'active',
    pausedIntervals: s.pausedIntervals.map((p) => (p.end === undefined ? { ...p, end: now } : p)),
  }
}

export function finalizeSession(s: WorkoutSession, endedAt: number): WorkoutSession {
  return {
    ...s,
    status: 'finished',
    endedAt,
    rest: undefined,
    pausedIntervals: s.pausedIntervals.map((p) => (p.end === undefined ? { ...p, end: Math.max(p.start, endedAt) } : p)),
  }
}

// ---- forgotten session --------------------------------------------------------------------------

export const lastDoneAt = (sets: SetLog[]): number | undefined =>
  sets.reduce<number | undefined>((m, x) => (x.doneAt !== undefined && (m === undefined || x.doneAt > m) ? x.doneAt : m), undefined)

export const lastActivityAt = (s: WorkoutSession, sets: SetLog[]) =>
  Math.max(s.startedAt, s.forgotAckAt ?? 0, lastDoneAt(sets) ?? 0)

/** True once 2 active hours have passed since the last set (or start / "keep going"), pauses excluded. */
export function isForgotten(s: WorkoutSession, sets: SetLog[], now: number): boolean {
  if (s.status === 'finished') return false
  return activeMsBetween(s, lastActivityAt(s, sets), now) >= FORGOTTEN_MS
}

/** Timestamp at which the prompt becomes due, assuming no further pause (for scheduling a notification). */
export function forgottenDueAt(s: WorkoutSession, sets: SetLog[], now: number): number | undefined {
  if (s.status !== 'active') return undefined
  const idle = activeMsBetween(s, lastActivityAt(s, sets), now)
  return now + Math.max(0, FORGOTTEN_MS - idle)
}

/** "Finish" on the forgotten prompt ends the session at the last logged set. */
export const forgottenEndTime = (s: WorkoutSession, sets: SetLog[]) => lastDoneAt(sets) ?? s.startedAt

// ---- sets -------------------------------------------------------------------------------------

/** Fields the user must fill before a set can be marked done. */
export function isFilled(set: SetLog, t: TrackingType): boolean {
  switch (t) {
    case 'weight_reps': return set.weight !== undefined && (set.reps ?? 0) > 0
    case 'duration':
    case 'cardio': return (set.durationSec ?? 0) > 0
    default: return (set.reps ?? 0) > 0
  }
}

export function setVolume(set: SetLog, t: TrackingType): number {
  if (set.setType === 'warmup' || set.doneAt === undefined) return 0
  if (t === 'weight_reps') return (set.weight ?? 0) * (set.reps ?? 0)
  if (t === 'bodyweight_added') return (set.extraWeight ?? 0) * (set.reps ?? 0)
  return 0
}

export interface SessionStats { sets: number; volume: number; exercises: number }

export function sessionStats(sets: SetLog[], trackingOf: (exerciseId: ID) => TrackingType): SessionStats {
  const done = sets.filter((x) => x.doneAt !== undefined)
  return {
    sets: done.filter((x) => x.setType !== 'warmup').length,
    volume: done.reduce((v, x) => v + setVolume(x, trackingOf(x.exerciseId)), 0),
    exercises: new Set(done.map((x) => x.exerciseId)).size,
  }
}

/** Live per-muscle set counter: primary muscles count fully, secondary partially; warm-ups don't count. */
export function muscleSetCounts(sets: SetLog[], exercises: Map<ID, Exercise>, secondaryWeight = 0.5): Map<ID, number> {
  const out = new Map<ID, number>()
  for (const s of sets) {
    if (s.doneAt === undefined || s.setType === 'warmup') continue
    const ex = exercises.get(s.exerciseId)
    if (!ex) continue
    for (const m of ex.primaryMuscleIds) out.set(m, (out.get(m) ?? 0) + 1)
    for (const m of ex.secondaryMuscleIds) out.set(m, (out.get(m) ?? 0) + secondaryWeight)
  }
  return out
}

// ---- last time ----------------------------------------------------------------------------------

export interface LastTime {
  sessionId: ID
  startedAt: number
  gymId?: ID
  sets: SetLog[]
  /** True when it came from the same gym as the current session. */
  gymMatched: boolean
}

/**
 * The most recent finished session that has done working sets for this exercise. If the current session has
 * a gym, prefer that gym's history and fall back to any gym; with no gym set, any session qualifies.
 */
export function pickLastTime(args: {
  logs: SetLog[]
  sessions: Map<ID, WorkoutSession>
  gymId?: ID
  excludeSessionId?: ID
}): LastTime | undefined {
  const { logs, sessions, gymId, excludeSessionId } = args
  const bySession = new Map<ID, SetLog[]>()
  for (const l of logs) {
    if (l.doneAt === undefined || l.setType === 'warmup' || l.sessionId === excludeSessionId) continue
    bySession.set(l.sessionId, [...(bySession.get(l.sessionId) ?? []), l])
  }
  const candidates = [...bySession.entries()]
    .map(([id, sets]) => ({ session: sessions.get(id), sets }))
    .filter((c): c is { session: WorkoutSession; sets: SetLog[] } => c.session?.status === 'finished')
    .sort((a, b) => b.session.startedAt - a.session.startedAt)
  const pick = (gymId && candidates.find((c) => c.session.gymId === gymId)) || candidates[0]
  if (!pick) return undefined
  return {
    sessionId: pick.session.id,
    startedAt: pick.session.startedAt,
    gymId: pick.session.gymId,
    gymMatched: !!gymId && pick.session.gymId === gymId,
    sets: [...pick.sets].sort((a, b) => a.order - b.order),
  }
}

export type SetValues = Pick<SetLog, 'weight' | 'extraWeight' | 'reps' | 'durationSec' | 'distanceM'>

export function valuesOf(s: SetLog): SetValues {
  return { weight: s.weight, extraWeight: s.extraWeight, reps: s.reps, durationSec: s.durationSec, distanceM: s.distanceM }
}

/** Source set for the n-th planned set: same index, or the last one if last time had fewer sets. */
export const lastSetFor = (last: LastTime | undefined, workingIndex: number): SetLog | undefined =>
  last?.sets[Math.min(workingIndex, last.sets.length - 1)]

// ---- rest -------------------------------------------------------------------------------------

export type RestSource = 'routine' | 'custom' | 'learned' | 'exercise' | 'default'

export function restFor(item: SessionExercise, ex: Exercise | undefined, defaultSec: number): { sec: number; source: RestSource } {
  // Order: this exercise in the routine/session > your saved "always" value > learned > exercise default > global.
  if (item.restSec !== undefined) return { sec: item.restSec, source: 'routine' }
  if (ex?.customRestSec !== undefined) return { sec: ex.customRestSec, source: 'custom' }
  if (ex?.learnedRestSec !== undefined) return { sec: ex.learnedRestSec, source: 'learned' }
  if (ex?.defaultRestSec !== undefined) return { sec: ex.defaultRestSec, source: 'exercise' }
  return { sec: defaultSec, source: 'default' }
}

/** Supersets/circuits rest once, after the last member of the group; singles rest after every set. */
export function shouldStartRest(items: SessionExercise[], itemId: ID): boolean {
  const i = items.findIndex((x) => x.id === itemId)
  const item = items[i]
  if (!item?.supersetGroup) return true
  const members = items.filter((x) => x.supersetGroup === item.supersetGroup && !x.skipped)
  return members[members.length - 1]?.id === itemId
}

/** Seconds between consecutive done sets of one exercise that look like rests (20s–10min). */
export function restGaps(sets: SetLog[]): number[] {
  const t = sets.filter((x) => x.doneAt !== undefined).map((x) => x.doneAt!).sort((a, b) => a - b)
  const gaps: number[] = []
  for (let i = 1; i < t.length; i++) {
    const g = (t[i] - t[i - 1]) / SEC
    if (g >= 20 && g <= 600) gaps.push(g)
  }
  return gaps
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const round5 = (n: number) => Math.round(n / 5) * 5

/** Blend this session's typical rest into the exercise's learned rest (70% history, 30% new). */
export function learnRest(prev: number | undefined, gaps: number[]): number | undefined {
  if (!gaps.length) return prev
  const m = median(gaps)
  return round5(prev === undefined ? m : 0.7 * prev + 0.3 * m)
}
