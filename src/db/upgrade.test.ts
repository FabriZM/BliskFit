import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { GymDB, newId } from './db'
import { exportBackup, parseBackup, restoreBackup } from './backup'
import { DEFAULT_SETTINGS } from './types'

/**
 * Frozen copies of every schema the app has shipped, copied from git history, not imported from db.ts, so
 * editing an old version there breaks these tests instead of silently changing what upgrades start from.
 * When adding a version to GymDB, add it here too (the last test fails until you do), and add any data
 * it rewrites to `fill` and the checks below.
 */
const HISTORY: Record<string, string>[] = [
  { // v1 (M0)
    muscleGroups: 'id, parentId, name',
    exercises: 'id, name, trackingType, equipment, source, *primaryMuscleIds, *secondaryMuscleIds',
    gyms: 'id, name',
    exerciseGymNotes: 'id, exerciseId, gymId',
    routines: 'id, name, archived',
    programs: 'id, name',
    sessions: 'id, startedAt, status, routineId, gymId',
    setLogs: 'id, sessionId, exerciseId, doneAt, [sessionId+exerciseId]',
    exerciseNotes: 'id, exerciseId, pinned',
    bodyWeights: 'id, date',
    measurements: 'id, date, type, [type+date]',
    settings: 'id',
  },
  { meta: 'key' }, // v2 (M1): seed version and flags
  { favorites: 'exerciseId' }, // v3: favorite exercises
  { progressPhotos: 'id, date, tag' }, // v4 (M6): progress photos
]

/** Opens a database the way the app at schema version `v` would have. */
function oldApp(name: string, v: number): Dexie {
  const d = new Dexie(name)
  HISTORY.slice(0, v).forEach((stores, i) => d.version(i + 1).stores(stores))
  return d
}

/** Settings as the first versions stored them, before later fields (rest popup, pins, reminder time...). */
const V1_SETTINGS = {
  id: 'settings', weeklyGoal: 4, weekStartDay: 0, units: 'lb', language: 'es', defaultRestSec: 120,
  prBadges: false, reminderDays: [1, 3], streakFreezes: 2,
}

/** Rows an old version could have written, in that version's shape. */
async function fill(d: Dexie, v: number) {
  await d.table('exercises').add({ id: 'c1', name: 'Landmine press', trackingType: 'weight_reps', primaryMuscleIds: ['m:shoulders'], secondaryMuscleIds: [], source: 'custom' })
  await d.table('routines').add({ id: 'r1', name: 'Push', archived: false, exercises: [{ id: 'i1', exerciseId: 'c1', targetSets: 3 }] })
  await d.table('sessions').add({ id: 's1', startedAt: 1000, endedAt: 5000, status: 'finished', pausedIntervals: [], exercises: [], routineId: 'r1' })
  await d.table('setLogs').add({ id: 'l1', sessionId: 's1', exerciseId: 'c1', order: 0, setType: 'working', weight: 40, reps: 8, doneAt: 2000 })
  await d.table('bodyWeights').add({ id: 'b1', date: 1000, weight: 80 })
  await d.table('settings').put(V1_SETTINGS)
  if (v >= 2) await d.table('meta').put({ key: 'activeProgramId', value: 'p1' })
  if (v >= 3) await d.table('favorites').add({ exerciseId: 'c1' })
  if (v >= 4) await d.table('progressPhotos').add({ id: 'ph1', date: 1000, tag: 'Front', photo: new Blob([new Uint8Array([7, 7])], { type: 'image/jpeg' }) })
}

describe('upgrading a database written by an older version', () => {
  for (let v = 1; v <= HISTORY.length; v++) {
    it(`keeps everything from schema v${v} and works with the current app`, async () => {
      const name = `upgrade-v${v}-${newId()}`
      const old = oldApp(name, v)
      await fill(old, v)
      old.close()

      const db = new GymDB(name)
      await db.open()
      expect(db.verno).toBe(HISTORY.length)
      // Old data is all there, still reachable through the indexes the app queries by.
      expect(await db.exercises.where('primaryMuscleIds').equals('m:shoulders').count()).toBe(1)
      expect(await db.setLogs.where('[sessionId+exerciseId]').equals(['s1', 'c1']).first()).toMatchObject({ weight: 40, reps: 8 })
      expect(await db.sessions.where('status').equals('finished').count()).toBe(1)
      expect(await db.routines.get('r1')).toMatchObject({ name: 'Push' })
      expect(await db.bodyWeights.count()).toBe(1)
      expect(await db.favorites.count()).toBe(v >= 3 ? 1 : 0)
      expect(await db.meta.get('activeProgramId')).toEqual(v >= 2 ? { key: 'activeProgramId', value: 'p1' } : undefined)
      // Tables added later exist and accept writes.
      await db.meta.put({ key: 'seedVersion', value: 1 })
      await db.progressPhotos.add({ id: newId(), date: 2000, photo: new Blob([new Uint8Array(1)]) })
      expect(await db.progressPhotos.where('date').above(0).count()).toBe(v >= 4 ? 2 : 1)

      // A backup taken right after the upgrade restores into a fresh install unchanged, settings filled in.
      const fresh = new GymDB(`fresh-${newId()}`)
      await restoreBackup(fresh, parseBackup(JSON.stringify(await exportBackup(db, 'test')), fresh.verno))
      for (const t of db.tables) expect(await fresh.table(t.name).count(), t.name).toBe(await t.count())
      expect(await fresh.settings.get('settings')).toEqual({ ...DEFAULT_SETTINGS, ...V1_SETTINGS })
      db.close()
      fresh.close()
    })
  }

  it('fills settings added in later versions with defaults when the app loads them', async () => {
    // The settings store reads the app's own database, so give it an old one under that name first.
    const old = oldApp('gymapp', 1)
    await old.table('settings').put(V1_SETTINGS)
    old.close()
    const { useSettings } = await import('../stores/settings')
    await useSettings.getState().load()
    expect(useSettings.getState().settings).toEqual({ ...DEFAULT_SETTINGS, ...V1_SETTINGS })
  })

  it('has a frozen copy of every schema version the app declares', () => {
    const db = new GymDB(`schema-${newId()}`)
    expect(db.verno).toBe(HISTORY.length)
    // Every table and index the app declares matches the history (no edits to old versions, no missing ones).
    const expected = Object.assign({}, ...HISTORY) as Record<string, string>
    const actual = Object.fromEntries(db.tables.map((t) => [t.name, [t.schema.primKey, ...t.schema.indexes].map((i) => i.src).join(', ')]))
    expect(actual).toEqual(expected)
  })
})
