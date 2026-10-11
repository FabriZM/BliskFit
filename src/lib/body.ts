import type { Measurement, ProgressPhoto } from '../db/types'
import { dateKey } from './goals'

// ---- measurement types -----------------------------------------------------------------------------

/** Standard measurements; the ones in SIDED come as a left/right pair. Anything else is a custom type. */
export const STANDARD_MEASUREMENTS = ['chest', 'waist', 'hips', 'neck', 'shoulders', 'biceps', 'forearm', 'thigh', 'calf'] as const
export const SIDED = new Set<string>(['biceps', 'forearm', 'thigh', 'calf'])

export type Side = 'l' | 'r'
export const measurementType = (base: string, side?: Side): string => (side ? `${base}_${side}` : base)

/** "biceps_l" -> { base: "biceps", side: "l" }; "waist" -> { base: "waist" }. */
export function parseMeasurementType(type: string): { base: string; side?: Side } {
  const m = /^(.+)_(l|r)$/.exec(type)
  return m ? { base: m[1], side: m[2] as Side } : { base: type }
}

/** Latest entry of each measurement type. */
export function latestByType(measurements: Pick<Measurement, 'type' | 'value' | 'date'>[]): Map<string, { value: number; date: number }> {
  const out = new Map<string, { value: number; date: number }>()
  for (const m of measurements) {
    const cur = out.get(m.type)
    if (!cur || m.date >= cur.date) out.set(m.type, { value: m.value, date: m.date })
  }
  return out
}

export interface Asymmetry { base: string; left: number; right: number; diff: number; pct: number }

/** For each left/right pair with both sides measured: the difference (left minus right) and how much bigger the larger side is. */
export function asymmetries(latest: Map<string, { value: number }>): Asymmetry[] {
  const out: Asymmetry[] = []
  for (const [type, l] of latest) {
    const p = parseMeasurementType(type)
    if (p.side !== 'l') continue
    const r = latest.get(measurementType(p.base, 'r'))
    if (!r) continue
    const small = Math.min(l.value, r.value)
    out.push({ base: p.base, left: l.value, right: r.value, diff: l.value - r.value, pct: small > 0 ? (Math.abs(l.value - r.value) / small) * 100 : 0 })
  }
  return out.sort((a, b) => a.base.localeCompare(b.base))
}

// ---- entry timestamps ------------------------------------------------------------------------------

/** Timestamp for an entry dated `day` (YYYY-MM-DD): the current time for today, otherwise midday so it can't slip a day. */
export function entryTimestamp(day: string, now: number): number {
  if (dateKey(new Date(now)) === day) return now
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, 12).getTime()
}

// ---- progress photos -------------------------------------------------------------------------------

export const MAX_PHOTOS_PER_DAY = 6

/** Photos on the same local calendar day as `date`, optionally ignoring one (when editing it). */
export const photosOnDay = (photos: Pick<ProgressPhoto, 'id' | 'date'>[], date: number, exceptId?: string) =>
  photos.filter((p) => p.id !== exceptId && dateKey(new Date(p.date)) === dateKey(new Date(date)))

/** The day's limit counts every tag; backdating into a full day is blocked too. */
export const canAddPhoto = (photos: Pick<ProgressPhoto, 'id' | 'date'>[], date: number, exceptId?: string): boolean =>
  photosOnDay(photos, date, exceptId).length < MAX_PHOTOS_PER_DAY

/** Tags in use, most used first (they exist only while a photo uses them). */
export function photoTags(photos: Pick<ProgressPhoto, 'tag'>[]): string[] {
  const counts = new Map<string, number>()
  for (const p of photos) if (p.tag) counts.set(p.tag, (counts.get(p.tag) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t)
}

/** Trimmed tag, reusing the spelling of an existing tag that matches ignoring case; empty = untagged. */
export function normalizeTag(input: string, existing: string[]): string | undefined {
  const t = input.trim().replace(/\s+/g, ' ')
  if (!t) return undefined
  return existing.find((e) => e.toLowerCase() === t.toLowerCase()) ?? t
}

/** Photos with this tag (undefined = untagged), oldest first. */
export const photosWithTag = <T extends Pick<ProgressPhoto, 'tag' | 'date'>>(photos: T[], tag: string | undefined): T[] =>
  photos.filter((p) => p.tag === tag).sort((a, b) => a.date - b.date)

/** Compare view default for a tag: first vs latest. Needs two photos. */
export function compareDefaults<T extends Pick<ProgressPhoto, 'tag' | 'date'>>(photos: T[], tag: string | undefined): { first: T; latest: T } | undefined {
  const list = photosWithTag(photos, tag)
  return list.length >= 2 ? { first: list[0], latest: list[list.length - 1] } : undefined
}

export const photoBytes = (photos: Pick<ProgressPhoto, 'photo'>[]): number => photos.reduce((a, p) => a + p.photo.size, 0)
