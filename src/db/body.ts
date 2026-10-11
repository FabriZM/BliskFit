import { db } from './db'
import { newId } from '../lib/id'
import { canAddPhoto, entryTimestamp, normalizeTag, photoTags } from '../lib/body'
import type { ID, ProgressPhoto } from './types'

/** Thrown when a day already has the maximum number of progress photos. */
export class PhotoLimitError extends Error {
  constructor() { super('photo limit reached for this day') }
}

// Weights are stored in kg and circumferences in cm (conversion to lb happens at the UI edge).

export async function addBodyWeight(day: string, weightKg: number, now = Date.now()): Promise<ID> {
  const id = newId()
  await db.bodyWeights.add({ id, date: entryTimestamp(day, now), weight: weightKg })
  return id
}

export const updateBodyWeight = (id: ID, day: string, weightKg: number, now = Date.now()) =>
  db.bodyWeights.update(id, { date: entryTimestamp(day, now), weight: weightKg })

export const deleteBodyWeight = (id: ID) => db.bodyWeights.delete(id)

export async function addMeasurement(day: string, type: string, value: number, now = Date.now()): Promise<ID> {
  const id = newId()
  await db.measurements.add({ id, date: entryTimestamp(day, now), type, value })
  return id
}

export const updateMeasurement = (id: ID, day: string, value: number, now = Date.now()) =>
  db.measurements.update(id, { date: entryTimestamp(day, now), value })

export const deleteMeasurement = (id: ID) => db.measurements.delete(id)

/** Adds an (already resized) photo; refuses when the photo's day is full. Nothing is ever deleted automatically. */
export async function addPhoto(input: { day: string; photo: Blob; tag?: string; note?: string }, now = Date.now()): Promise<ID> {
  const date = entryTimestamp(input.day, now)
  return db.transaction('rw', db.progressPhotos, async () => {
    const all = await db.progressPhotos.toArray()
    if (!canAddPhoto(all, date)) throw new PhotoLimitError()
    const id = newId()
    const row: ProgressPhoto = {
      id, date, photo: input.photo,
      tag: normalizeTag(input.tag ?? '', photoTags(all)),
      note: input.note?.trim() || undefined,
    }
    await db.progressPhotos.add(row)
    return id
  })
}

/** Edits a photo's day, tag or note; moving it onto a full day is refused. */
export async function updatePhoto(id: ID, patch: { day?: string; tag?: string; note?: string }, now = Date.now()): Promise<void> {
  await db.transaction('rw', db.progressPhotos, async () => {
    const all = await db.progressPhotos.toArray()
    const cur = all.find((p) => p.id === id)
    if (!cur) return
    const next: Partial<ProgressPhoto> = {}
    if (patch.day !== undefined) {
      const date = entryTimestamp(patch.day, now)
      if (!canAddPhoto(all, date, id)) throw new PhotoLimitError()
      next.date = date
    }
    if (patch.tag !== undefined) next.tag = normalizeTag(patch.tag, photoTags(all.filter((p) => p.id !== id)))
    if (patch.note !== undefined) next.note = patch.note.trim() || undefined
    await db.progressPhotos.update(id, next)
  })
}

/** Renames a tag on every photo that has it (merging into another tag if the name exists). */
export async function renameTag(from: string, to: string): Promise<void> {
  await db.transaction('rw', db.progressPhotos, async () => {
    const all = await db.progressPhotos.toArray()
    const name = normalizeTag(to, photoTags(all.filter((p) => p.tag !== from)))
    await db.progressPhotos.where('tag').equals(from).modify({ tag: name })
  })
}

/** Removes the photo and its blob for good. */
export const deletePhoto = (id: ID) => db.progressPhotos.delete(id)
