import { db, newId } from './db'
import type { Exercise, ID, SessionExercise, SetLog, SetType, WorkoutSession } from './types'
import { defaultsFor, replaceExercise } from '../lib/routines'
import { finalizeSession, learnRest, pauseSession, restGaps, resumeSession } from '../lib/workout'

export type SwapScope = 'session' | 'routine' | 'all'

export const getActiveSession = (): Promise<WorkoutSession | undefined> =>
  db.sessions.where('status').anyOf('active', 'paused').first()

const blankSets = (sessionId: ID, item: SessionExercise, count: number, startOrder = 0): SetLog[] =>
  Array.from({ length: count }, (_, i) => ({
    id: newId(), sessionId, itemId: item.id, exerciseId: item.exerciseId, order: startOrder + i, setType: 'working' as SetType,
  }))

/** Starts a session from a routine (or empty). If one is already running, returns it instead. */
export async function startSession(routineId?: ID): Promise<ID> {
  const existing = await getActiveSession()
  if (existing) return existing.id
  const routine = routineId ? await db.routines.get(routineId) : undefined
  const items: SessionExercise[] = (routine?.exercises ?? []).map((e) => ({
    id: newId(), exerciseId: e.exerciseId, targetSets: e.targetSets, repMin: e.repMin, repMax: e.repMax,
    restSec: e.restSec, supersetGroup: e.supersetGroup,
  }))
  // Default to the gym used last time (only if it still exists); the user never has to pick one.
  const prev = await db.sessions.orderBy('startedAt').reverse().first()
  const gymId = prev?.gymId && (await db.gyms.get(prev.gymId)) ? prev.gymId : undefined
  const session: WorkoutSession = {
    id: newId(), startedAt: Date.now(), routineId, gymId, status: 'active', pausedIntervals: [], exercises: items,
  }
  await db.transaction('rw', db.sessions, db.setLogs, async () => {
    await db.sessions.add(session)
    await db.setLogs.bulkAdd(items.flatMap((it) => blankSets(session.id, it, it.targetSets)))
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
    await db.setLogs.bulkAdd(items.flatMap((it) => blankSets(id, it, it.targetSets)))
    return { ...s, exercises: [...s.exercises, ...items] }
  })

export const moveItem = (id: ID, itemId: ID, dir: -1 | 1) =>
  mutate(id, (s) => {
    const i = s.exercises.findIndex((x) => x.id === itemId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= s.exercises.length) return
    const list = [...s.exercises]
    ;[list[i], list[j]] = [list[j], list[i]]
    return { ...s, exercises: list }
  })

export const toggleSkip = (id: ID, itemId: ID) =>
  mutate(id, (s) => ({ ...s, exercises: s.exercises.map((x) => (x.id === itemId ? { ...x, skipped: !x.skipped } : x)) }))

/** Removing is only offered for items with no done sets; their blank sets go with them. */
export const removeItem = (id: ID, itemId: ID) =>
  mutate(id, async (s) => {
    const sets = await db.setLogs.where('sessionId').equals(id).filter((x) => x.itemId === itemId).toArray()
    if (sets.some((x) => x.doneAt !== undefined)) return
    await db.setLogs.bulkDelete(sets.map((x) => x.id))
    return { ...s, exercises: s.exercises.filter((x) => x.id !== itemId) }
  })

export const addSet = (id: ID, itemId: ID) =>
  mutate(id, async (s) => {
    const item = s.exercises.find((x) => x.id === itemId)
    if (!item) return
    const sets = await db.setLogs.where('sessionId').equals(id).filter((x) => x.itemId === itemId).toArray()
    await db.setLogs.bulkAdd(blankSets(id, item, 1, Math.max(-1, ...sets.map((x) => x.order)) + 1))
  })

export const deleteSet = (setId: ID) => db.setLogs.delete(setId)

export const updateSet = (setId: ID, patch: Partial<SetLog>) => db.setLogs.update(setId, patch)

/** Marks a set done. `restSec` starts the rest timer (null = no rest, e.g. mid-superset). Resumes a paused session. */
export async function completeSet(setId: ID, restSec: number | null): Promise<void> {
  const set = await db.setLogs.get(setId)
  if (!set) return
  const now = Date.now()
  await db.transaction('rw', db.sessions, db.setLogs, async () => {
    await db.setLogs.update(setId, { doneAt: now })
    const s = await db.sessions.get(set.sessionId)
    if (!s) return
    let next = resumeSession(s, now)
    if (restSec !== null) next = { ...next, rest: { startedAt: now, endsAt: now + restSec * 1000, exerciseId: set.exerciseId } }
    await db.sessions.put(next)
  })
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

/** Ends the session (default: now), drops blank sets, and updates each exercise's learned rest. */
export async function finishSession(id: ID, endedAt = Date.now()): Promise<void> {
  await db.transaction('rw', db.sessions, db.setLogs, db.exercises, async () => {
    const s = await db.sessions.get(id)
    if (!s) return
    const all = await db.setLogs.where('sessionId').equals(id).toArray()
    await db.setLogs.bulkDelete(all.filter((x) => x.doneAt === undefined).map((x) => x.id))
    const done = all.filter((x) => x.doneAt !== undefined)
    for (const exId of new Set(done.map((x) => x.exerciseId))) {
      const ex = await db.exercises.get(exId)
      const learned = learnRest(ex?.learnedRestSec, restGaps(done.filter((x) => x.exerciseId === exId)))
      if (ex && learned !== undefined && learned !== ex.learnedRestSec) await db.exercises.update(exId, { learnedRestSec: learned })
    }
    await db.sessions.put(finalizeSession(s, endedAt))
  })
}

export async function discardSession(id: ID): Promise<void> {
  await db.transaction('rw', db.sessions, db.setLogs, async () => {
    await db.setLogs.where('sessionId').equals(id).delete()
    await db.sessions.delete(id)
  })
}
