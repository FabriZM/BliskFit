import { beforeEach, describe, expect, it } from 'vitest'
import { db, newId } from './db'
import { ensureSeed } from './seed'
import { clearExerciseRest, setExerciseRest, setSessionRest, startSession } from './workout'
import { restFor } from '../lib/workout'

const BENCH = 'x:Barbell_Bench_Press_-_Medium_Grip'
const PRESS = 'x:Barbell_Shoulder_Press'
const GLOBAL = { working: 90, drop: 15, warmup: 45 }
/** Rest timers with this working rest and the app's drop and warm-up ones. */
const R = (working: number) => ({ ...GLOBAL, working })

async function setup() {
  await db.sessions.clear(); await db.setLogs.clear(); await db.routines.clear(); await db.meta.clear()
  await db.exercises.toCollection().modify((e) => { delete e.customRestSec; delete e.customDropRestSec; delete e.customWarmupRestSec })
}

describe('changing the rest timer from a workout', () => {
  beforeEach(async () => { await ensureSeed(db); await setup() })

  async function sessionFor(items: { exerciseId: string; restSec?: number; supersetGroup?: string }[]) {
    const routineId = newId()
    await db.routines.add({ id: routineId, name: 'R', archived: false, exercises: items.map((e) => ({ id: newId(), targetSets: 3, ...e })) })
    const sid = await startSession(routineId)
    return { routineId, sid, session: async () => (await db.sessions.get(sid))! }
  }
  const effective = async (sid: string, exerciseId: string) => {
    const s = (await db.sessions.get(sid))!
    const item = s.exercises.find((x) => x.exerciseId === exerciseId)!
    return restFor(item, await db.exercises.get(exerciseId), GLOBAL)
  }

  it('this session only: changes the running workout and nothing else', async () => {
    const { sid, routineId } = await sessionFor([{ exerciseId: BENCH }])
    const item = (await db.sessions.get(sid))!.exercises[0]
    await setSessionRest(sid, item.id, R(150))
    expect(await effective(sid, BENCH)).toEqual({ sec: 150, source: 'routine' })
    expect((await db.exercises.get(BENCH))?.customRestSec).toBeUndefined()
    expect((await db.routines.get(routineId))!.exercises[0].restSec).toBeUndefined()
  })

  it('future sessions: saved on the exercise, applied now, and picked up by the next workout', async () => {
    const { sid, routineId } = await sessionFor([{ exerciseId: BENCH }])
    const item = (await db.sessions.get(sid))!.exercises[0]
    await setExerciseRest(BENCH, R(120), { sessionId: sid, itemId: item.id })
    expect((await db.exercises.get(BENCH))?.customRestSec).toBe(120)
    expect(await effective(sid, BENCH)).toEqual({ sec: 120, source: 'routine' }) // applied to this session too

    // an empty workout later, with the exercise added fresh, falls back to the saved value
    const next = restFor({ id: 'n', exerciseId: BENCH, targetSets: 3 }, await db.exercises.get(BENCH), GLOBAL)
    expect(next).toEqual({ sec: 120, source: 'custom' })
    expect((await db.routines.get(routineId))!.exercises[0].restSec).toBeUndefined() // no override was there to update
  })

  it('a routine that already overrides this exercise is updated so it cannot beat the new choice', async () => {
    const a = await sessionFor([{ exerciseId: BENCH, restSec: 60 }])
    const item = (await a.session()).exercises[0]
    const other = newId()
    await db.routines.add({ id: other, name: 'Other', archived: false, exercises: [{ id: newId(), exerciseId: BENCH, targetSets: 3, restSec: 45 }, { id: newId(), exerciseId: PRESS, targetSets: 3, restSec: 70 }] })
    await setExerciseRest(BENCH, R(150), { sessionId: a.sid, itemId: item.id })
    expect((await db.routines.get(a.routineId))!.exercises[0].restSec).toBe(150)
    const o = (await db.routines.get(other))!.exercises
    expect([o[0].restSec, o[1].restSec]).toEqual([150, 70]) // other exercises untouched
  })

  it('supersets share one rest: a session change applies to the whole group', async () => {
    const { sid } = await sessionFor([{ exerciseId: BENCH, supersetGroup: 'g' }, { exerciseId: PRESS, supersetGroup: 'g' }])
    const s = await db.sessions.get(sid)
    await setSessionRest(sid, s!.exercises[0].id, R(100))
    expect((await db.sessions.get(sid))!.exercises.map((x) => x.restSec)).toEqual([100, 100])
  })

  it('0 means no rest timer and is kept as a value', async () => {
    const { sid } = await sessionFor([{ exerciseId: BENCH }])
    const item = (await db.sessions.get(sid))!.exercises[0]
    await setExerciseRest(BENCH, R(0), { sessionId: sid, itemId: item.id })
    expect((await db.exercises.get(BENCH))?.customRestSec).toBe(0)
    expect((await effective(sid, BENCH)).sec).toBe(0)
  })

  it('saves the drop and warm-up timers too, and a superset shares them', async () => {
    const { sid } = await sessionFor([{ exerciseId: BENCH, supersetGroup: 'g' }, { exerciseId: PRESS, supersetGroup: 'g' }])
    const s = (await db.sessions.get(sid))!
    await setSessionRest(sid, s.exercises[0].id, { working: 100, drop: 0, warmup: 30 })
    const items = (await db.sessions.get(sid))!.exercises
    expect(items.map((x) => [x.restSec, x.dropRestSec, x.warmupRestSec])).toEqual([[100, 0, 30], [100, 0, 30]])
    await setExerciseRest(BENCH, { working: 120, drop: 10, warmup: 40 })
    expect(await db.exercises.get(BENCH)).toMatchObject({ customRestSec: 120, customDropRestSec: 10, customWarmupRestSec: 40 })
  })

  it('reset goes back to the defaults without touching routine overrides', async () => {
    const { sid, routineId } = await sessionFor([{ exerciseId: BENCH }])
    const item = (await db.sessions.get(sid))!.exercises[0]
    await setExerciseRest(BENCH, { working: 150, drop: 5, warmup: 20 }, { sessionId: sid, itemId: item.id })
    await clearExerciseRest(BENCH, { sessionId: sid, itemId: item.id })
    expect(await db.exercises.get(BENCH)).not.toHaveProperty('customDropRestSec')
    expect(await effective(sid, BENCH)).toEqual({ sec: 90, source: 'default' })
    const after = (await db.sessions.get(sid))!.exercises[0]
    expect([after.restSec, after.dropRestSec, after.warmupRestSec]).toEqual([undefined, undefined, undefined])
    expect((await db.routines.get(routineId))).toBeTruthy()
  })
})
