import { beforeEach, describe, expect, it } from 'vitest'
import { GymDB, newId } from './db'
import { BackupError, exportBackup, parseBackup, restoreBackup } from './backup'
import { DEFAULT_SETTINGS } from './types'

const jpeg = (bytes: number[]) => new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' })

async function fill(db: GymDB) {
  const ex = newId()
  await db.exercises.add({ id: ex, name: 'Bench', trackingType: 'weight_reps', primaryMuscleIds: [], secondaryMuscleIds: [], source: 'custom', photo: jpeg([1, 2, 3]) })
  const s = newId()
  await db.sessions.add({ id: s, startedAt: 1000, endedAt: 2000, status: 'finished', pausedIntervals: [], exercises: [] })
  await db.setLogs.add({ id: newId(), sessionId: s, exerciseId: ex, order: 0, setType: 'working', weight: 80, reps: 5 })
  await db.progressPhotos.add({ id: newId(), date: 1000, tag: 'Front', photo: jpeg(Array.from({ length: 70000 }, (_, i) => i % 256)) })
  await db.favorites.add({ exerciseId: ex })
  await db.settings.put({ ...DEFAULT_SETTINGS, weeklyGoal: 5 })
  await db.meta.put({ key: 'seedVersion', value: 3 })
}

describe('backup', () => {
  let src: GymDB
  let dst: GymDB
  beforeEach(() => { src = new GymDB('test-' + newId()); dst = new GymDB('test-' + newId()) })

  it('round-trips every table, including photo blobs, through JSON text', async () => {
    await fill(src)
    const text = JSON.stringify(await exportBackup(src, '1.0', 5))
    await dst.bodyWeights.add({ id: newId(), date: 1, weight: 70 }) // existing data is replaced
    await restoreBackup(dst, parseBackup(text, dst.verno))

    for (const t of src.tables) expect(await dst.table(t.name).count(), t.name).toBe(await t.count())
    expect(await dst.bodyWeights.count()).toBe(0)
    const photo = (await dst.progressPhotos.toArray())[0]
    expect(photo.photo).toBeInstanceOf(Blob)
    expect(photo.photo.type).toBe('image/jpeg')
    expect(new Uint8Array(await photo.photo.arrayBuffer())).toEqual(new Uint8Array(await (await src.progressPhotos.toArray())[0].photo.arrayBuffer()))
    const ex = (await dst.exercises.toArray())[0]
    expect(Array.from(new Uint8Array(await ex.photo!.arrayBuffer()))).toEqual([1, 2, 3])
    expect((await dst.settings.get('settings'))?.weeklyGoal).toBe(5)
    expect((await dst.setLogs.toArray())[0]).toMatchObject({ weight: 80, reps: 5 })
  })

  it('fills settings added after the backup was written with defaults', async () => {
    const { pinnedStats: _p, setsTarget: _s, ...old } = DEFAULT_SETTINGS
    const text = JSON.stringify({ app: 'bliskfit', format: 1, schemaVersion: 3, appVersion: '0.1', exportedAt: 1, tables: { settings: [{ ...old, weeklyGoal: 4 }] } })
    await restoreBackup(dst, parseBackup(text, dst.verno))
    expect(await dst.settings.get('settings')).toMatchObject({ weeklyGoal: 4, setsTarget: DEFAULT_SETTINGS.setsTarget, pinnedStats: [] })
    expect(await dst.progressPhotos.count()).toBe(0) // table that didn't exist yet
  })

  it('rejects files that are not backups, and backups from a newer app', () => {
    const reason = (text: string) => { try { parseBackup(text, 4); return 'ok' } catch (e) { return (e as BackupError).reason } }
    expect(reason('not json')).toBe('invalid')
    expect(reason('{"app":"other","format":1,"schemaVersion":1,"tables":{}}')).toBe('invalid')
    expect(reason('{"app":"bliskfit","format":1,"schemaVersion":1,"tables":{"sessions":{}}}')).toBe('invalid')
    expect(reason('{"app":"bliskfit","format":1,"schemaVersion":5,"tables":{}}')).toBe('newer')
    expect(reason('{"app":"bliskfit","format":2,"schemaVersion":4,"tables":{}}')).toBe('newer')
    expect(reason('{"app":"bliskfit","format":1,"schemaVersion":4,"tables":{}}')).toBe('ok')
  })

  it('leaves current data untouched when a restore fails midway', async () => {
    await fill(dst)
    const bad = { app: 'bliskfit', format: 1, schemaVersion: 4, appVersion: '', exportedAt: 1, tables: { sessions: [{ startedAt: 1 }] } } // no primary key
    await expect(restoreBackup(dst, parseBackup(JSON.stringify(bad), dst.verno))).rejects.toThrow()
    expect(await dst.sessions.count()).toBe(1)
    expect(await dst.progressPhotos.count()).toBe(1)
  })
})
