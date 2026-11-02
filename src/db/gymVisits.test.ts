import { beforeEach, describe, expect, it } from 'vitest'
import { db, newId } from './db'
import { defaultGymFor, setGym, shiftSession } from './workout'
import { setActiveProgramId } from './programs'
import { gymPeriods, qualifyingSessionIds, visitDays } from '../lib/gymVisits'
import type { GymAllowance } from './types'

const at = (day: string, h = 18) => new Date(`${day}T${String(h).padStart(2, '0')}:00:00`).getTime()
const plan: GymAllowance = { visits: 12, startDay: 1, since: '2026-10-01' }

async function addVisit(gymId: string | undefined, day: string, setType: 'working' | 'warmup' = 'working') {
  const id = newId()
  await db.sessions.add({ id, startedAt: at(day), endedAt: at(day) + 3600_000, status: 'finished', pausedIntervals: [], exercises: [], gymId })
  await db.setLogs.add({ id: newId(), sessionId: id, exerciseId: 'e', order: 0, setType, reps: 5, weight: 50, doneAt: at(day) + 1000 })
  return id
}
async function used(gymId: string, today = '2026-10-20') {
  const days = visitDays(await db.sessions.toArray(), qualifyingSessionIds(await db.setLogs.toArray()), gymId)
  const ps = gymPeriods(plan, days, new Date(`${today}T12:00:00`))
  return ps[ps.length - 1].used
}

describe('gym visits from the database', () => {
  beforeEach(async () => { await db.sessions.clear(); await db.setLogs.clear(); await db.gyms.clear(); await db.programs.clear(); await db.routines.clear(); await db.meta.clear() })

  it('counts a day once, then follows edits to a past session\'s gym and date', async () => {
    const g1 = newId(), g2 = newId()
    await db.gyms.bulkAdd([{ id: g1, name: 'A', allowance: plan }, { id: g2, name: 'B' }])
    const a = await addVisit(g1, '2026-10-05')
    await addVisit(g1, '2026-10-05') // second session the same day
    const c = await addVisit(g1, '2026-10-08')
    await addVisit(g1, '2026-10-09', 'warmup') // warm-up only: no visit
    await addVisit(undefined, '2026-10-10')    // no gym: no visit
    expect(await used(g1)).toBe(2)

    await setGym(c, g2)                                   // edit its gym
    expect(await used(g1)).toBe(1)
    expect(await used(g2)).toBe(1) // the visit now belongs to the other gym (same plan window used for both)
    await setGym(c, g1)
    await shiftSession(c, at('2026-10-05', 20))           // edit its date onto the same day as another visit
    expect(await used(g1)).toBe(1)
    await shiftSession(c, at('2026-09-20'))               // move it before the plan's first period
    expect(await used(g1)).toBe(1)
    await shiftSession(c, at('2026-10-15'))               // back inside
    expect(await used(g1)).toBe(2)
    expect(a).toBeTruthy()
  })

  it('shifting a session moves its sets and pauses with it', async () => {
    const g = newId()
    const id = await addVisit(g, '2026-10-05')
    await db.sessions.update(id, { pausedIntervals: [{ start: at('2026-10-05', 18) + 60_000, end: at('2026-10-05', 18) + 120_000 }] })
    const before = (await db.sessions.get(id))!
    await shiftSession(id, before.startedAt + 86_400_000)
    const after = (await db.sessions.get(id))!
    const set = (await db.setLogs.where('sessionId').equals(id).toArray())[0]
    expect(after.startedAt - before.startedAt).toBe(86_400_000)
    expect(after.endedAt! - before.endedAt!).toBe(86_400_000)
    expect(after.pausedIntervals[0].start - before.pausedIntervals[0].start).toBe(86_400_000)
    expect(set.doneAt).toBe(at('2026-10-05') + 1000 + 86_400_000)
  })

  it('default gym: the routine\'s own, else its active program\'s, else none (if the gym still exists)', async () => {
    const gProgram = newId(), gRoutine = newId(), gLast = newId()
    await db.gyms.bulkAdd([{ id: gProgram, name: 'Program gym' }, { id: gRoutine, name: 'Routine gym' }, { id: gLast, name: 'Last gym' }])
    const routineId = newId(), otherRoutine = newId(), ownGymRoutine = newId()
    await db.routines.bulkAdd([
      { id: routineId, name: 'R', exercises: [], archived: false },
      { id: otherRoutine, name: 'O', exercises: [], archived: false },
      { id: ownGymRoutine, name: 'G', exercises: [], archived: false, gymId: gRoutine },
    ])
    const programId = newId()
    await db.programs.add({ id: programId, name: 'P', weeks: 1, mode: 'rotation', rotation: [routineId, ownGymRoutine], gymId: gProgram })
    await addVisit(gLast, '2026-10-01')

    expect(await defaultGymFor(routineId)).toBeUndefined() // program not active yet; the last used gym is not carried over
    await setActiveProgramId(programId)
    expect(await defaultGymFor(routineId)).toBe(gProgram)  // active program's routine -> its gym
    expect(await defaultGymFor(ownGymRoutine)).toBe(gRoutine) // the routine's own gym wins over the program's
    expect(await defaultGymFor(otherRoutine)).toBeUndefined() // routine outside the program -> none
    expect(await defaultGymFor(undefined)).toBeUndefined()    // empty workout -> none

    await db.gyms.delete(gRoutine)                          // a deleted gym is never used
    expect(await defaultGymFor(ownGymRoutine)).toBe(gProgram) // falls back to the program's gym
    await db.gyms.delete(gProgram)
    expect(await defaultGymFor(ownGymRoutine)).toBeUndefined()
    expect(await defaultGymFor(routineId)).toBeUndefined()
  })
})
