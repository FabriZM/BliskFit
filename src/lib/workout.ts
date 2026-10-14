import type { Exercise, ID, SessionExercise, SetLog, SetValueKey, Settings, TrackingType, Units, WorkoutSession } from '../db/types'

export const FORGOTTEN_MS = 2 * 60 * 60 * 1000

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

/**
 * A finished session with a new start and end (`endedAt` > `startedAt`): pauses are cut to fit (dropped if left
 * empty). Its sets' times are moved separately (see clampToSession).
 */
export function retimeSession(s: WorkoutSession, startedAt: number, endedAt: number): WorkoutSession {
  const pausedIntervals = s.pausedIntervals
    .map((p) => ({ start: Math.max(p.start, startedAt), end: Math.min(p.end ?? endedAt, endedAt) }))
    .filter((p) => p.end > p.start)
  return { ...s, startedAt, endedAt, pausedIntervals }
}

/** A set's done time pulled inside the session's start and end. */
export const clampToSession = (doneAt: number, s: Pick<WorkoutSession, 'startedAt' | 'endedAt'>) =>
  Math.min(Math.max(doneAt, s.startedAt), s.endedAt ?? doneAt)

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

/** Load × reps (× `factor`, 2 for paired dumbbells); warm-ups and undone sets carry none. */
export function setVolume(set: SetLog, t: TrackingType, factor = 1): number {
  if (set.setType === 'warmup' || set.doneAt === undefined) return 0
  if (t === 'weight_reps') return (set.weight ?? 0) * (set.reps ?? 0) * factor
  if (t === 'bodyweight_added') return (set.extraWeight ?? 0) * (set.reps ?? 0)
  return 0
}

export interface SessionStats { sets: number; volume: number; exercises: number }

export function sessionStats(sets: SetLog[], trackingOf: (exerciseId: ID) => TrackingType, volumeFactorOf: (exerciseId: ID) => number = () => 1): SessionStats {
  const done = sets.filter((x) => x.doneAt !== undefined)
  return {
    sets: done.filter((x) => x.setType !== 'warmup').length,
    volume: done.reduce((v, x) => v + setVolume(x, trackingOf(x.exerciseId), volumeFactorOf(x.exerciseId)), 0),
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

export type SetValues = Pick<SetLog, 'weight' | 'extraWeight' | 'unit' | 'reps' | 'durationSec' | 'distanceM'>

export function valuesOf(s: SetLog): SetValues {
  return { weight: s.weight, extraWeight: s.extraWeight, unit: s.unit, reps: s.reps, durationSec: s.durationSec, distanceM: s.distanceM }
}

/** Values to fill a set with from another one, unit included; sets from before units were kept were typed in `appUnits`. */
export function copyValues(src: SetLog, appUnits: Units): SetValues {
  const { unit, ...v } = valuesOf(src)
  return v.weight !== undefined || v.extraWeight !== undefined ? { ...v, unit: unit ?? appUnits } : v
}

export const VALUE_KEYS: SetValueKey[] = ['weight', 'extraWeight', 'reps', 'durationSec', 'distanceM']

/** `copied` without the fields in `own` (now entered on the set itself), or undefined when none are left. */
export function withoutCopied(copied: SetValueKey[] | undefined, own: SetValueKey[]): SetValueKey[] | undefined {
  const left = copied?.filter((k) => !own.includes(k))
  return left?.length ? left : undefined
}

/**
 * Typing a value into `sorted[i]` (an exercise's sets, in order) copies it to the later sets of the same type that
 * aren't done and are blank in that field or hold a copy there (`copied`): typing 80 once fills the sets after it,
 * and since fields save on every keystroke, "8" then "80" (or a later fix) keeps the copies in step. A value typed
 * on a set itself is never overwritten, and copying stops there: the sets after it hold copies of that one.
 * Clearing the field clears its copies. Returns the changes for later sets.
 */
export function fillFollowing(sorted: SetLog[], i: number, patch: Partial<SetLog>): { id: ID; patch: Partial<SetLog> }[] {
  const src = sorted[i]
  // Fields still being carried: a later set with its own value (typed, or done) takes over from there.
  let keys = VALUE_KEYS.filter((k) => k in patch)
  if (!src || !keys.length) return []
  return sorted.slice(i + 1).flatMap((s) => {
    if (s.setType !== src.setType) return []
    const own = (k: SetValueKey) => s[k] !== undefined && (s.doneAt !== undefined || !s.copied?.includes(k))
    const carry = keys.filter((k) => !own(k))
    keys = carry
    if (s.doneAt !== undefined) return []
    const p: Partial<SetLog> = {}
    let copied = s.copied ?? []
    for (const k of carry) {
      if (s[k] === patch[k]) continue
      p[k] = patch[k]
      copied = patch[k] === undefined ? copied.filter((x) => x !== k) : copied.includes(k) ? copied : [...copied, k]
    }
    if (!Object.keys(p).length) return []
    if ((p.weight !== undefined || p.extraWeight !== undefined) && patch.unit) p.unit = patch.unit
    p.copied = copied.length ? copied : undefined
    return [{ id: s.id, patch: p }]
  })
}

/** Each set's index among its exercise's non-warm-up sets (-1 for warm-ups): "set 2 last time" lines up with set 2 now. */
export function workingIndexes(sorted: SetLog[]): number[] {
  let w = 0
  return sorted.map((s) => (s.setType === 'warmup' ? -1 : w++))
}

/** Source set for the n-th planned set: same index, or the last one if last time had fewer sets. */
export const lastSetFor = (last: LastTime | undefined, workingIndex: number): SetLog | undefined =>
  last?.sets[Math.min(workingIndex, last.sets.length - 1)]

// ---- rest -------------------------------------------------------------------------------------

export type RestSource = 'routine' | 'custom' | 'exercise' | 'default'
/** Rest timers go by the kind of set coming next; to-failure sets are working sets. */
export type RestKind = 'working' | 'drop' | 'warmup'
export type RestTimes = Record<RestKind, number>

/** The app's rest timers (Settings). */
export const restDefaults = (s: Pick<Settings, 'defaultRestSec' | 'dropRestSec' | 'warmupRestSec'>): RestTimes =>
  ({ working: s.defaultRestSec, drop: s.dropRestSec, warmup: s.warmupRestSec })

export function restFor(item: SessionExercise, ex: Exercise | undefined, defaults: RestTimes, kind: RestKind = 'working'): { sec: number; source: RestSource } {
  // Order: this session (or its routine) > your saved "always" value > the exercise's default (working only) > the app's.
  const [session, custom, exercise] = kind === 'drop' ? [item.dropRestSec, ex?.customDropRestSec, undefined]
    : kind === 'warmup' ? [item.warmupRestSec, ex?.customWarmupRestSec, undefined]
      : [item.restSec, ex?.customRestSec, ex?.defaultRestSec]
  if (session !== undefined) return { sec: session, source: 'routine' }
  if (custom !== undefined) return { sec: custom, source: 'custom' }
  if (exercise !== undefined) return { sec: exercise, source: 'exercise' }
  return { sec: defaults[kind], source: 'default' }
}

/** The kind of rest after finishing `sorted[i]`: the next set's in this exercise, or working once it's all done. */
export function restKindAfter(sorted: SetLog[], i: number): RestKind {
  const next = sorted.slice(i + 1).find((s) => s.doneAt === undefined)
  return next?.setType === 'drop' ? 'drop' : next?.setType === 'warmup' ? 'warmup' : 'working'
}

/**
 * Rest to start after finishing `sorted[i]` (its exercise's sets, in order), or null for none: timed for the set
 * coming next (so the last warm-up gets the full working rest), and none until the last member of a superset.
 */
export function restAfterSet(sorted: SetLog[], i: number, item: SessionExercise, ex: Exercise | undefined, defaults: RestTimes, items: SessionExercise[]): number | null {
  const sec = restFor(item, ex, defaults, restKindAfter(sorted, i)).sec
  return shouldStartRest(items, item.id) && sec > 0 ? sec : null
}

/** Supersets/circuits rest once, after the last member of the group; singles rest after every set. */
export function shouldStartRest(items: SessionExercise[], itemId: ID): boolean {
  const i = items.findIndex((x) => x.id === itemId)
  const item = items[i]
  if (!item?.supersetGroup) return true
  const members = items.filter((x) => x.supersetGroup === item.supersetGroup && !x.skipped)
  return members[members.length - 1]?.id === itemId
}

