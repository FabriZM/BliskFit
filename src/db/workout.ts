import { db, newId } from './db'
import { DEFAULT_SETTINGS, type Exercise, type ID, type SessionExercise, type SetLog, type SetType, type WorkoutSession } from './types'
import { defaultsFor, moveExercise, replaceExercise, setRest } from '../lib/routines'
import { getActiveProgramId } from './programs'
import { programIncludesRoutine } from '../lib/gymVisits'
import { VALUE_KEYS, clampToSession, fillFollowing, finalizeSession, isFilled, pauseSession, pickLastTime, restAfterSet, restDefaults, resumeSession, retimeSession, valuesOf, withoutCopied, type LastTime, type RestTimes, type SetValues } from '../lib/workout'

export type SwapScope = 'session' | 'routine' | 'all'

export const getActiveSession = (): Promise<WorkoutSession | undefined> =>
  db.sessions.where('status').anyOf('active', 'paused').first()

const blankSets = (sessionId: ID, item: SessionExercise, count: number, startOrder = 0): SetLog[] =>
  Array.from({ length: count }, (_, i) => ({
    id: newId(), sessionId, itemId: item.id, exerciseId: item.exerciseId, order: startOrder + i, setType: 'working' as SetType,
  }))

/**
 * The gym a new session starts with (never required, always changeable from the session menu): the active
 * program's default gym when the routine belongs to that program, otherwise the gym used last time. Only gyms
 * that still exist are used.
 */
export async function defaultGymFor(routineId?: ID): Promise<ID | undefined> {
  if (routineId) {
    const programId = await getActiveProgramId()
    const program = programId ? await db.programs.get(programId) : undefined
    if (program?.gymId && programIncludesRoutine(program, routineId) && (await db.gyms.get(program.gymId))) return program.gymId
  }
  const prev = await db.sessions.orderBy('startedAt').reverse().first()
  return prev?.gymId && (await db.gyms.get(prev.gymId)) ? prev.gymId : undefined
}

/** Starts a session from a routine (or empty). If one is already running, returns it instead. */
export async function startSession(routineId?: ID): Promise<ID> {
  const existing = await getActiveSession()
  if (existing) return existing.id
  const routine = routineId ? await db.routines.get(routineId) : undefined
  const items: SessionExercise[] = (routine?.exercises ?? []).map((e) => ({
    id: newId(), exerciseId: e.exerciseId, targetSets: e.targetSets, repMin: e.repMin, repMax: e.repMax,
    restSec: e.restSec, supersetGroup: e.supersetGroup,
  }))
  const gymId = await defaultGymFor(routineId)
  const session: WorkoutSession = {
    id: newId(), startedAt: Date.now(), routineId, routineName: routine?.name, gymId, status: 'active', pausedIntervals: [], exercises: items,
  }
  await db.transaction('rw', db.sessions, db.setLogs, async () => {
    await db.sessions.add(session)
    await db.setLogs.bulkAdd(items.flatMap((it) => blankSets(session.id, it, Math.max(1, it.targetSets))))
  })
  return session.id
}

async function mutate(sessionId: ID, fn: (s: WorkoutSession) => Promise<WorkoutSession | void> | WorkoutSession | void): Promise<void> {
  await db.transaction('rw', db.sessions, db.setLogs, db.routines, db.exercises, async () => {
    const s = await db.sessions.get(sessionId)
    if (!s) return
    const next = await fn(s)
    if (next) await db.sessions.put(next)
  })
}

export const pause = (id: ID) => mutate(id, (s) => pauseSession(s, Date.now()))
export const resume = (id: ID) => mutate(id, (s) => resumeSession(s, Date.now()))
export const setGym = (id: ID, gymId?: ID) => mutate(id, (s) => ({ ...s, gymId }))
export const acknowledgeForgotten = (id: ID) => mutate(id, (s) => ({ ...s, forgotAckAt: Date.now() }))

export const addExercisesToSession = (id: ID, exercises: Exercise[]) =>
  mutate(id, async (s) => {
    const items = exercises.map((e): SessionExercise => ({ id: newId(), exerciseId: e.id, ...defaultsFor(e) }))
    await db.setLogs.bulkAdd(items.flatMap((it) => blankSets(id, it, Math.max(1, it.targetSets))))
    return { ...s, exercises: [...s.exercises, ...items] }
  })

/** Moves an exercise to another position (dragged), keeping supersets valid. */
export const moveItem = (id: ID, itemId: ID, toItemId: ID) =>
  mutate(id, (s) => {
    const list = moveExercise(s.exercises, s.exercises.findIndex((x) => x.id === itemId), s.exercises.findIndex((x) => x.id === toItemId))
    return list === s.exercises ? undefined : { ...s, exercises: list }
  })

export const toggleSkip = (id: ID, itemId: ID) =>
  mutate(id, (s) => ({ ...s, exercises: s.exercises.map((x) => (x.id === itemId ? { ...x, skipped: !x.skipped } : x)) }))

/** Removes the exercise and every set logged for it; the UI confirms first. */
export const removeItem = (id: ID, itemId: ID) =>
  mutate(id, async (s) => {
    const sets = await db.setLogs.where('sessionId').equals(id).filter((x) => x.itemId === itemId).toArray()
    await db.setLogs.bulkDelete(sets.map((x) => x.id))
    return { ...s, exercises: s.exercises.filter((x) => x.id !== itemId) }
  })

/** Adds a set pre-filled with the previous set's values (not done, never silently logged). */
export const addSet = (id: ID, itemId: ID) =>
  mutate(id, async (s) => {
    const item = s.exercises.find((x) => x.id === itemId)
    if (!item) return
    const sets = await db.setLogs.where('sessionId').equals(id).filter((x) => x.itemId === itemId).toArray()
    const last = sets.reduce<SetLog | undefined>((m, x) => (!m || x.order > m.order ? x : m), undefined)
    const [row] = blankSets(id, item, 1, (last?.order ?? -1) + 1)
    await db.setLogs.add(last ? { ...row, ...valuesOf(last), setType: last.setType === 'warmup' ? 'working' : last.setType } : row)
  })

/**
 * Puts warm-up sets before the first working set of an exercise in the session (not done; editable like any
 * set). Warm-ups not done yet are replaced, so asking again after changing the working weight gives a fresh ramp.
 */
export const setWarmups = (id: ID, itemId: ID, warmups: Pick<SetLog, 'weight' | 'extraWeight' | 'unit' | 'reps'>[]) =>
  mutate(id, async (s) => {
    const item = s.exercises.find((x) => x.id === itemId)
    if (!item) return
    const sets = (await db.setLogs.where('sessionId').equals(id).filter((x) => x.itemId === itemId).toArray()).sort((a, b) => a.order - b.order)
    const stale = sets.filter((x) => x.setType === 'warmup' && x.doneAt === undefined)
    const kept = sets.filter((x) => !stale.includes(x))
    // Right before the first set that isn't a warm-up (after any warm-ups already done).
    const at = kept.findIndex((x) => x.setType !== 'warmup')
    const fresh: SetLog[] = blankSets(id, item, warmups.length).map((row, i) => ({ ...row, ...warmups[i], setType: 'warmup' }))
    const ordered = [...kept.slice(0, at < 0 ? kept.length : at), ...fresh, ...(at < 0 ? [] : kept.slice(at))]
    await db.setLogs.bulkDelete(stale.map((x) => x.id))
    await db.setLogs.bulkPut(ordered.map((x, order) => ({ ...x, order })))
  })

export const deleteSet = (setId: ID) => db.setLogs.delete(setId)

/** Changes a set. Values it sets (typed, last time's, plates…) are its own from then on, no longer copies. */
export const updateSet = (setId: ID, patch: Partial<SetLog>) =>
  db.transaction('rw', db.setLogs, async () => {
    const set = await db.setLogs.get(setId)
    if (!set) return
    const own = VALUE_KEYS.filter((k) => k in patch)
    await db.setLogs.update(setId, own.length && set.copied ? { ...patch, copied: withoutCopied(set.copied, own) } : patch)
  })
/** A value typed into a set's field: saved, and carried to the later sets that follow it (see fillFollowing). */
export const editSet = (setId: ID, patch: Partial<SetLog>) =>
  db.transaction('rw', db.setLogs, async () => {
    const set = await db.setLogs.get(setId)
    if (!set) return
    // Read inside the transaction, so each keystroke sees what the previous one saved.
    const sorted = (await db.setLogs.where('sessionId').equals(set.sessionId).filter((x) => x.itemId === set.itemId).toArray())
      .sort((a, b) => a.order - b.order)
    const later = fillFollowing(sorted, sorted.findIndex((x) => x.id === setId), patch)
    await db.setLogs.update(setId, { ...patch, copied: withoutCopied(set.copied, VALUE_KEYS.filter((k) => k in patch)) })
    for (const u of later) await db.setLogs.update(u.id, u.patch)
  })

/** Marks a set done. `restSec` starts the rest timer (null = no rest, e.g. mid-superset). Resumes a paused session. */
export async function completeSet(setId: ID, restSec: number | null): Promise<void> {
  const set = await db.setLogs.get(setId)
  if (!set) return
  const now = Date.now()
  await db.transaction('rw', db.sessions, db.setLogs, async () => {
    await db.setLogs.update(setId, { doneAt: now, copied: undefined }) // done: the values are this set's own
    const s = await db.sessions.get(set.sessionId)
    if (!s) return
    let next = resumeSession(s, now)
    if (restSec !== null) next = { ...next, rest: { startedAt: now, endsAt: now + restSec * 1000, exerciseId: set.exerciseId } }
    await db.sessions.put(next)
  })
}

/** The exercise's sets from the last workout before `session` (the same gym's when there is one). */
export async function loadLastTime(exerciseId: ID, session: WorkoutSession): Promise<LastTime | undefined> {
  const logs = await db.setLogs.where('exerciseId').equals(exerciseId).filter((x) => x.doneAt !== undefined).toArray()
  const ids = [...new Set(logs.map((x) => x.sessionId))]
  const sessions = new Map((await db.sessions.bulkGet(ids)).filter((x) => !!x).map((x) => [x!.id, x!]))
  return pickLastTime({ logs, sessions, gymId: session.gymId, excludeSessionId: session.id })
}

/**
 * Logs a set from outside the workout screen (the rest notification's Done): fills it with `values` if it is still
 * blank, then completes it with the rest the app would start. False (nothing changed) if the set is gone, already
 * done, not in the running workout, or blank with no values.
 */
export async function logSet(setId: ID, values: SetValues | undefined): Promise<boolean> {
  const set = await db.setLogs.get(setId)
  if (!set || set.doneAt !== undefined || !set.itemId) return false
  const session = await getActiveSession()
  const item = session?.id === set.sessionId ? session.exercises.find((x) => x.id === set.itemId) : undefined
  if (!session || !item) return false
  const [exercise, settings, itemSets] = await Promise.all([
    db.exercises.get(item.exerciseId),
    db.settings.get('settings'),
    db.setLogs.where('sessionId').equals(session.id).filter((x) => x.itemId === item.id).toArray(),
  ])
  if (!isFilled(set, exercise?.trackingType ?? 'weight_reps')) {
    if (!values) return false
    await db.setLogs.update(setId, values)
  }
  const sorted = itemSets.sort((a, b) => a.order - b.order)
  const defaults = restDefaults({ ...DEFAULT_SETTINGS, ...settings })
  await completeSet(setId, restAfterSet(sorted, sorted.findIndex((x) => x.id === setId), item, exercise, defaults, session.exercises))
  return true
}

export const uncompleteSet = (setId: ID) => db.setLogs.update(setId, { doneAt: undefined })

export const adjustRest = (id: ID, deltaSec: number) =>
  mutate(id, (s) => (s.rest ? { ...s, rest: { ...s.rest, endsAt: Math.max(Date.now(), s.rest.endsAt + deltaSec * 1000) } } : undefined))
export const clearRest = (id: ID) => mutate(id, (s) => ({ ...s, rest: undefined }))

/**
 * Swap an exercise. Done sets are never rewritten: if the item already has some, it stays (minus its blank
 * sets) and the replacement is inserted right after it. `scope` also updates the routine template(s).
 */
export const swapExercise = (id: ID, itemId: ID, next: Exercise, scope: SwapScope) =>
  mutate(id, async (s) => {
    const item = s.exercises.find((x) => x.id === itemId)
    if (!item) return
    const sets = await db.setLogs.where('sessionId').equals(id).filter((x) => x.itemId === itemId).toArray()
    const hasDone = sets.some((x) => x.doneAt !== undefined)
    let exercises: SessionExercise[]
    if (hasDone) {
      await db.setLogs.bulkDelete(sets.filter((x) => x.doneAt === undefined).map((x) => x.id))
      const added: SessionExercise = { ...item, id: newId(), exerciseId: next.id, skipped: false }
      await db.setLogs.bulkAdd(blankSets(id, added, Math.max(1, sets.filter((x) => x.doneAt === undefined).length)))
      exercises = s.exercises.flatMap((x) => (x.id === itemId ? [x, added] : [x]))
    } else {
      await db.setLogs.bulkPut(sets.map((x) => ({ ...x, exerciseId: next.id })))
      exercises = s.exercises.map((x) => (x.id === itemId ? { ...x, exerciseId: next.id } : x))
    }
    if (scope === 'routine' && s.routineId) {
      const r = await db.routines.get(s.routineId)
      if (r) await db.routines.put(replaceExercise(r, item.exerciseId, next))
    } else if (scope === 'all') {
      for (const r of await db.routines.toArray()) {
        if (r.exercises.some((e) => e.exerciseId === item.exerciseId)) await db.routines.put(replaceExercise(r, item.exerciseId, next, true))
      }
    }
    return { ...s, exercises }
  })

/** Ends the session (default: now) and drops blank sets. */
export async function finishSession(id: ID, endedAt = Date.now()): Promise<void> {
  await db.transaction('rw', db.sessions, db.setLogs, async () => {
    const s = await db.sessions.get(id)
    if (!s) return
    const all = await db.setLogs.where('sessionId').equals(id).toArray()
    await db.setLogs.bulkDelete(all.filter((x) => x.doneAt === undefined).map((x) => x.id))
    await db.sessions.put(finalizeSession(s, endedAt))
  })
}

export async function discardSession(id: ID): Promise<void> {
  await db.transaction('rw', db.sessions, db.setLogs, async () => {
    await db.setLogs.where('sessionId').equals(id).delete()
    await db.sessions.delete(id)
  })
}

/** Moves a (finished) session to a new start time, shifting everything inside it by the same amount. */
export async function shiftSession(id: ID, newStartedAt: number): Promise<void> {
  await db.transaction('rw', db.sessions, db.setLogs, async () => {
    const s = await db.sessions.get(id)
    if (!s) return
    const delta = newStartedAt - s.startedAt
    if (!delta) return
    await db.sessions.put({
      ...s,
      startedAt: s.startedAt + delta,
      endedAt: s.endedAt === undefined ? undefined : s.endedAt + delta,
      forgotAckAt: s.forgotAckAt === undefined ? undefined : s.forgotAckAt + delta,
      pausedIntervals: s.pausedIntervals.map((p) => ({ start: p.start + delta, end: p.end === undefined ? undefined : p.end + delta })),
    })
    await db.setLogs.where('sessionId').equals(id).modify((l) => { if (l.doneAt !== undefined) l.doneAt += delta })
  })
}

/**
 * New start and end for a finished session (the end must come after the start). The duration follows; sets
 * logged outside the new times move to the nearest edge, and pauses are cut to fit.
 */
export async function setSessionTimes(id: ID, startedAt: number, endedAt: number): Promise<void> {
  if (!(endedAt > startedAt)) return
  await db.transaction('rw', db.sessions, db.setLogs, async () => {
    const s = await db.sessions.get(id)
    if (!s || s.status !== 'finished') return
    const next = retimeSession(s, startedAt, endedAt)
    await db.sessions.put(next)
    await db.setLogs.where('sessionId').equals(id).modify((l) => { if (l.doneAt !== undefined) l.doneAt = clampToSession(l.doneAt, next) })
  })
}

/** A session's exercise list with `rests` set on item `i` (and its superset, which rests as one). */
function withRests(exs: SessionExercise[], i: number, rests: Partial<RestTimes> | undefined): SessionExercise[] {
  const group = exs[i].supersetGroup
  return setRest(exs, i, rests?.working).map((e, k) => {
    if (k !== i && !(group && e.supersetGroup === group)) return e
    const next = { ...e, dropRestSec: rests?.drop, warmupRestSec: rests?.warmup }
    if (next.dropRestSec === undefined) delete next.dropRestSec
    if (next.warmupRestSec === undefined) delete next.warmupRestSec
    return next
  })
}

/** "This session only": the rest timers for this exercise (and its superset) in the running workout. */
export const setSessionRest = (id: ID, itemId: ID, rests: RestTimes) =>
  mutate(id, (s) => {
    const i = s.exercises.findIndex((x) => x.id === itemId)
    return i < 0 ? undefined : { ...s, exercises: withRests(s.exercises, i, rests) }
  })

/**
 * "This and future sessions": remembers the timers on the exercise, and also updates any routine that already
 * overrides this exercise's working rest (so an older routine value can't silently beat your new choice). With a
 * session context it applies to the running workout too.
 */
export async function setExerciseRest(exerciseId: ID, rests: RestTimes, ctx?: { sessionId: ID; itemId: ID }): Promise<void> {
  await db.transaction('rw', db.exercises, db.routines, db.sessions, async () => {
    await db.exercises.update(exerciseId, { customRestSec: rests.working, customDropRestSec: rests.drop, customWarmupRestSec: rests.warmup })
    for (const r of await db.routines.toArray()) {
      let list = r.exercises
      list.forEach((e, i) => { if (e.exerciseId === exerciseId && e.restSec !== undefined && e.restSec !== rests.working) list = setRest(list, i, rests.working) })
      if (list !== r.exercises) await db.routines.put({ ...r, exercises: list })
    }
    if (ctx) {
      const s = await db.sessions.get(ctx.sessionId)
      const i = s?.exercises.findIndex((x) => x.id === ctx.itemId) ?? -1
      if (s && i >= 0) await db.sessions.put({ ...s, exercises: withRests(s.exercises, i, rests) })
    }
  })
}

/** Back to the defaults: forgets the saved timers (and this session's overrides); routine overrides are left alone. */
export async function clearExerciseRest(exerciseId: ID, ctx?: { sessionId: ID; itemId: ID }): Promise<void> {
  await db.transaction('rw', db.exercises, db.sessions, async () => {
    await db.exercises.update(exerciseId, { customRestSec: undefined, customDropRestSec: undefined, customWarmupRestSec: undefined })
    if (ctx) {
      const s = await db.sessions.get(ctx.sessionId)
      const i = s?.exercises.findIndex((x) => x.id === ctx.itemId) ?? -1
      if (s && i >= 0) await db.sessions.put({ ...s, exercises: withRests(s.exercises, i, undefined) })
    }
  })
}
