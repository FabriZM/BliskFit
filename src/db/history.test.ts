import { beforeAll, describe, expect, it } from 'vitest'
import { db, newId } from './db'
import { ensureSeed } from './seed'
import { deleteSet, discardSession, updateSet } from './workout'
import { computeAllPRs, computePRs } from '../lib/prs'
import type { SetLog } from './types'

const BENCH = 'x:Barbell_Bench_Press_-_Medium_Grip'
const day = (d: string) => new Date(`${d}T18:00:00`).getTime()

async function addSession(date: string, sets: [number, number][]): Promise<{ id: string; setIds: string[] }> {
  const id = newId(), itemId = newId()
  await db.sessions.add({ id, startedAt: day(date), endedAt: day(date) + 3600_000, status: 'finished', pausedIntervals: [],
    exercises: [{ id: itemId, exerciseId: BENCH, targetSets: sets.length }] })
  const rows: SetLog[] = sets.map(([weight, reps], i) => ({
    id: newId(), sessionId: id, itemId, exerciseId: BENCH, order: i, setType: 'working', weight, reps, doneAt: day(date) + i * 120_000,
  }))
  await db.setLogs.bulkAdd(rows)
  return { id, setIds: rows.map((r) => r.id) }
}
const benchSets = () => db.setLogs.where('exerciseId').equals(BENCH).filter((s) => s.doneAt !== undefined).toArray()

describe('history editing keeps PRs honest', () => {
  beforeAll(async () => { await ensureSeed(db); await db.setLogs.clear(); await db.sessions.clear() })

  it('flags follow edits and deletes across sessions', async () => {
    const a = await addSession('2026-10-01', [[100, 5]])
    const b = await addSession('2026-10-05', [[105, 5]])
    const c = await addSession('2026-10-09', [[110, 5]])

    let prs = computePRs(await benchSets(), 'weight_reps')
    expect([a, b, c].map((s) => prs.has(s.setIds[0]))).toEqual([false, true, true])

    // Edit Oct 5 down below Oct 1: it stops being a PR, and Oct 9 still is
    await updateSet(b.setIds[0], { weight: 90 })
    prs = computePRs(await benchSets(), 'weight_reps')
    expect([a, b, c].map((s) => prs.has(s.setIds[0]))).toEqual([false, false, true])

    // Delete the Oct 9 set: nothing left to beat Oct 1
    await deleteSet(c.setIds[0])
    prs = computeAllPRs(await benchSets(), () => 'weight_reps')
    expect(prs.size).toBe(0)

    // Delete the oldest session entirely: the remaining set becomes the baseline
    await discardSession(a.id)
    expect(await db.sessions.get(a.id)).toBeUndefined()
    expect((await benchSets()).map((s) => s.weight)).toEqual([90])
    expect(computePRs(await benchSets(), 'weight_reps').size).toBe(0)
  })
})
