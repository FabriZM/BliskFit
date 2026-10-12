import { beforeAll, describe, expect, it } from 'vitest'
import { db, newId } from './db'
import { ensureSeed } from './seed'
import {
  addExercisesToSession, addSet, completeSet, discardSession, finishSession, getActiveSession, moveItem, pause,
  removeItem, resume, setWarmups, startSession, swapExercise, toggleSkip,
} from './workout'
import { pickLastTime } from '../lib/workout'

const sets = (sid: string) => db.setLogs.where('sessionId').equals(sid).toArray()

describe('live workout flow', () => {
  let routineId: string
  beforeAll(async () => {
    await ensureSeed(db)
    routineId = newId()
    await db.routines.add({
      id: routineId, name: 'Push', archived: false,
      exercises: [
        { id: 'r1', exerciseId: 'x:Barbell_Bench_Press_-_Medium_Grip', targetSets: 3, repMin: 8, repMax: 12, supersetGroup: 'g' },
        { id: 'r2', exerciseId: 'x:Barbell_Shoulder_Press', targetSets: 2, repMin: 8, repMax: 12, supersetGroup: 'g' },
      ],
    })
  })

  it('removing an exercise also deletes its logged sets', async () => {
    const id = await startSession(routineId)
    const item = (await db.sessions.get(id))!.exercises[0]
    const first = (await sets(id)).find((x) => x.itemId === item.id)!
    await db.setLogs.update(first.id, { weight: 50, reps: 5 })
    await completeSet(first.id, null)
    await removeItem(id, item.id)
    expect((await sets(id)).some((x) => x.itemId === item.id)).toBe(false)
    expect((await db.sessions.get(id))!.exercises.some((x) => x.id === item.id)).toBe(false)
    await discardSession(id)
  })

  it('warm-ups go before the first working set; asking again replaces the ones not done yet', async () => {
    const id = await startSession(routineId)
    const item = (await db.sessions.get(id))!.exercises[0]
    const mine = async () => (await sets(id)).filter((x) => x.itemId === item.id).sort((a, b) => a.order - b.order)
    const working = (await mine()).map((x) => x.id)

    await setWarmups(id, item.id, [{ weight: 20, unit: 'kg', reps: 10 }, { weight: 40, unit: 'kg', reps: 5 }])
    let all = await mine()
    expect(all.map((x) => x.setType)).toEqual(['warmup', 'warmup', 'working', 'working', 'working'])
    expect(all.map((x) => x.order)).toEqual([0, 1, 2, 3, 4])
    expect(all.slice(2).map((x) => x.id)).toEqual(working)
    expect(all[1]).toMatchObject({ weight: 40, unit: 'kg', reps: 5 })
    expect(all[0].doneAt).toBeUndefined() // suggested, never logged for you

    await completeSet(all[0].id, null)
    await setWarmups(id, item.id, [{ weight: 50, unit: 'kg', reps: 3 }])
    all = await mine()
    expect(all.map((x) => [x.setType, x.weight])).toEqual([['warmup', 20], ['warmup', 50], ['working', undefined], ['working', undefined], ['working', undefined]])
    expect(all[0].doneAt).toBeDefined() // a done warm-up stays
    await discardSession(id)
  })

  it('starts from a routine with blank sets, one session at a time', async () => {
    const id = await startSession(routineId)
    expect((await sets(id)).length).toBe(5)
    expect(await startSession()).toBe(id)
    expect((await getActiveSession())?.id).toBe(id)
    await discardSession(id)
    expect(await getActiveSession()).toBeUndefined()
    expect(await sets(id)).toHaveLength(0)
  })

  it('logs sets, pauses, swaps and finishes; last-time sees the finished session', async () => {
    const id = await startSession(routineId)
    const s0 = (await db.sessions.get(id))!
    const [bench, press] = s0.exercises
    const benchSets = (await sets(id)).filter((x) => x.itemId === bench.id).sort((a, b) => a.order - b.order)

    await db.setLogs.update(benchSets[0].id, { weight: 100, reps: 5 })
    await completeSet(benchSets[0].id, null) // mid-superset: no rest
    expect((await db.sessions.get(id))!.rest).toBeUndefined()
    await db.setLogs.update(benchSets[1].id, { weight: 100, reps: 4 })
    await completeSet(benchSets[1].id, 90)
    const rest = (await db.sessions.get(id))!.rest!
    expect(rest.endsAt - rest.startedAt).toBe(90_000)

    await pause(id)
    expect((await db.sessions.get(id))!.status).toBe('paused')
    await completeSet(benchSets[2].id, null) // logging while paused resumes
    expect((await db.sessions.get(id))!.status).toBe('active')
    await pause(id); await resume(id)
    expect((await db.sessions.get(id))!.pausedIntervals).toHaveLength(2)

    // add / skip / move / remove
    await addExercisesToSession(id, [(await db.exercises.get('x:Plank'))!])
    let s = (await db.sessions.get(id))!
    expect(s.exercises).toHaveLength(3)
    await moveItem(id, s.exercises[2].id, -1)
    s = (await db.sessions.get(id))!
    expect(s.exercises[1].exerciseId).toBe('x:Plank')
    await toggleSkip(id, press.id)
    expect((await db.sessions.get(id))!.exercises.find((x) => x.id === press.id)!.skipped).toBe(true)
    await removeItem(id, s.exercises[1].id) // plank removed along with its blank sets
    expect((await db.sessions.get(id))!.exercises).toHaveLength(2)
    expect((await sets(id)).some((x) => x.exerciseId === 'x:Plank')).toBe(false)

    // swap the unlogged exercise for the whole routine
    const dips = (await db.exercises.toArray()).find((e) => /^Bench Dips/.test(e.name))!
    await swapExercise(id, press.id, dips, 'routine')
    s = (await db.sessions.get(id))!
    expect(s.exercises.find((x) => x.id === press.id)!.exerciseId).toBe(dips.id)
    expect((await sets(id)).filter((x) => x.itemId === press.id).every((x) => x.exerciseId === dips.id)).toBe(true)
    expect((await db.routines.get(routineId))!.exercises[1].exerciseId).toBe(dips.id)

    // swapping an item that already has done sets keeps them and inserts the replacement after it
    await swapExercise(id, bench.id, dips, 'session')
    s = (await db.sessions.get(id))!
    expect(s.exercises.map((x) => x.exerciseId)).toEqual(['x:Barbell_Bench_Press_-_Medium_Grip', dips.id, dips.id])
    expect((await sets(id)).filter((x) => x.itemId === bench.id && x.doneAt !== undefined)).toHaveLength(3)

    await db.setLogs.update(benchSets[2].id, { weight: 90, reps: 6, rir: 2 })
    await addSet(id, bench.id)
    const copied = (await sets(id)).filter((x) => x.itemId === bench.id).sort((a, b) => a.order - b.order).at(-1)!
    expect(copied).toMatchObject({ weight: 90, reps: 6, order: 3, setType: 'working' })
    expect(copied.doneAt).toBeUndefined() // a copy is a suggestion, never logged for you
    expect(copied.rir).toBeUndefined()
    await finishSession(id)
    const fin = (await db.sessions.get(id))!
    expect(fin.status).toBe('finished')
    expect(fin.pausedIntervals.every((p) => p.end !== undefined)).toBe(true)
    expect((await sets(id)).every((x) => x.doneAt !== undefined)).toBe(true) // blanks dropped
    expect(await getActiveSession()).toBeUndefined()

    const logs = await db.setLogs.where('exerciseId').equals('x:Barbell_Bench_Press_-_Medium_Grip').toArray()
    const sessions = new Map((await db.sessions.toArray()).map((x) => [x.id, x]))
    const last = pickLastTime({ logs, sessions })!
    expect(last.sessionId).toBe(id)
    expect(last.sets.map((x) => x.weight)).toEqual([100, 100, 90])
  })
})
