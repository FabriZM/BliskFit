import type { PinSpec, ID } from '../db/types'

export const MAX_PINS = 6

/** Identity of a pin: the same card with the same range is the same pin. */
export const pinKey = (p: PinSpec): string =>
  [p.kind, p.exerciseId ?? '', p.metric ?? '', p.muscleId ?? '', p.measurement ?? '', p.photoMode ?? '', p.tag ?? '', p.range].join('|')

/** Identity of a card regardless of range (the Stats panel has one card per thing and a shared range control). */
export const cardKey = (p: PinSpec): string => pinKey({ ...p, range: 'all' }).replace(/\|all$/, '')

export const isPinned = (pins: PinSpec[], p: PinSpec): boolean => pins.some((x) => cardKey(x) === cardKey(p))

/** Pin if absent, unpin if present (any range). Returns undefined when the cap is reached. */
export function togglePin(pins: PinSpec[], p: PinSpec): PinSpec[] | undefined {
  if (isPinned(pins, p)) return pins.filter((x) => cardKey(x) !== cardKey(p))
  return pins.length >= MAX_PINS ? undefined : [...pins, p]
}

export interface PinTargets {
  exerciseIds: Set<ID>
  muscleIds: Set<ID>
  measurementTypes: Set<string>
  photoTags: Set<string>
  hasUntaggedPhotos: boolean
}

/** Drops pins whose exercise, muscle, measurement or photo tag no longer exists. */
export function validPins(pins: PinSpec[], t: PinTargets): PinSpec[] {
  return pins.filter((p) => {
    if (p.exerciseId !== undefined && !t.exerciseIds.has(p.exerciseId)) return false
    if (p.muscleId !== undefined && !t.muscleIds.has(p.muscleId)) return false
    if (p.kind === 'measurement' && (p.measurement === undefined || !t.measurementTypes.has(p.measurement))) return false
    if (p.kind === 'photo' && (p.tag === undefined ? !t.hasUntaggedPhotos : !t.photoTags.has(p.tag))) return false
    return true
  })
}

/** Reorders by moving an item one step. */
export function movePin(pins: PinSpec[], index: number, dir: -1 | 1): PinSpec[] {
  const to = index + dir
  if (to < 0 || to >= pins.length) return pins
  const next = [...pins]
  ;[next[index], next[to]] = [next[to], next[index]]
  return next
}

/** Shown on Profile for someone with history and no pins yet. */
export const SUGGESTED_PINS: PinSpec[] = [
  { kind: 'weekly', range: '3m' },
  { kind: 'muscles', range: '3m' },
  { kind: 'bodyweight', range: '3m' },
]
