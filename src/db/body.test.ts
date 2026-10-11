import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { MAX_PHOTOS_PER_DAY } from '../lib/body'
import { PhotoLimitError, addBodyWeight, addMeasurement, addPhoto, deleteBodyWeight, deletePhoto, renameTag, updatePhoto } from './body'

const blob = (size = 10) => new Blob([new Uint8Array(size)], { type: 'image/jpeg' })
const now = new Date('2026-10-14T10:00:00').getTime()

describe('body log storage', () => {
  beforeEach(async () => { await db.progressPhotos.clear(); await db.bodyWeights.clear(); await db.measurements.clear() })

  it('stores weights and measurements and deletes them', async () => {
    const w = await addBodyWeight('2026-10-14', 80.5, now)
    await addMeasurement('2026-10-01', 'biceps_l', 35, now)
    expect((await db.bodyWeights.get(w))?.weight).toBe(80.5)
    expect((await db.measurements.toArray())[0]).toMatchObject({ type: 'biceps_l', value: 35 })
    await deleteBodyWeight(w)
    expect(await db.bodyWeights.count()).toBe(0)
  })

  it('stores a photo as a blob with a normalized tag and removes it for good', async () => {
    const id = await addPhoto({ day: '2026-10-14', photo: blob(123), tag: ' Front ', note: ' morning ' }, now)
    await addPhoto({ day: '2026-10-13', photo: blob(), tag: 'front' }, now)
    const [a, b] = (await db.progressPhotos.orderBy('date').toArray())
    expect(b.photo.size).toBe(123)
    expect(b).toMatchObject({ tag: 'Front', note: 'morning' })
    expect(a.tag).toBe('Front') // second photo reuses the existing spelling
    await deletePhoto(id)
    expect(await db.progressPhotos.get(id)).toBeUndefined()
    expect(await db.progressPhotos.count()).toBe(1)
  })

  it('refuses a 7th photo on a day (also backdated) without deleting anything, but allows other days', async () => {
    for (let i = 0; i < MAX_PHOTOS_PER_DAY; i++) await addPhoto({ day: '2026-10-10', photo: blob(), tag: i % 2 ? 'a' : undefined }, now)
    await expect(addPhoto({ day: '2026-10-10', photo: blob(), tag: 'z' }, now)).rejects.toBeInstanceOf(PhotoLimitError)
    expect(await db.progressPhotos.count()).toBe(MAX_PHOTOS_PER_DAY)
    await addPhoto({ day: '2026-10-11', photo: blob() }, now)
    expect(await db.progressPhotos.count()).toBe(MAX_PHOTOS_PER_DAY + 1)
  })

  it('refuses moving a photo onto a full day, but lets it be edited in place', async () => {
    for (let i = 0; i < MAX_PHOTOS_PER_DAY; i++) await addPhoto({ day: '2026-10-10', photo: blob() }, now)
    const other = await addPhoto({ day: '2026-10-11', photo: blob() }, now)
    await expect(updatePhoto(other, { day: '2026-10-10' }, now)).rejects.toBeInstanceOf(PhotoLimitError)
    expect(new Date((await db.progressPhotos.get(other))!.date).getDate()).toBe(11)
    const inPlace = (await db.progressPhotos.toArray()).find((p) => p.id !== other)!
    await updatePhoto(inPlace.id, { day: '2026-10-10', note: 'ok' }, now)
    expect((await db.progressPhotos.get(inPlace.id))?.note).toBe('ok')
  })

  it('renames a tag on all its photos, and clearing it untags them', async () => {
    await addPhoto({ day: '2026-10-01', photo: blob(), tag: 'front' }, now)
    await addPhoto({ day: '2026-10-02', photo: blob(), tag: 'front' }, now)
    await addPhoto({ day: '2026-10-03', photo: blob(), tag: 'side' }, now)
    await renameTag('front', 'Full body')
    expect((await db.progressPhotos.orderBy('date').toArray()).map((p) => p.tag)).toEqual(['Full body', 'Full body', 'side'])
    await renameTag('side', '')
    expect((await db.progressPhotos.orderBy('date').toArray())[2].tag).toBeUndefined()
  })
})
