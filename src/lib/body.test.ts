import { describe, expect, it } from 'vitest'
import {
  BODY_FAT, asymmetries, canAddPhoto, isCustomMeasurement, measurementUnit, compareDefaults, entryTimestamp, latestByType, measurementType, normalizeTag, parseMeasurementType,
  photoTags, photosOnDay, MAX_PHOTOS_PER_DAY,
} from './body'
import { MAX_PINS, cardKey, isPinned, movePin, pinKey, togglePin, validPins } from './pins'
import type { PinSpec } from '../db/types'

const at = (day: string, h = 12) => new Date(`${day}T${String(h).padStart(2, '0')}:00:00`).getTime()

describe('measurement types', () => {
  it('round-trips left/right types', () => {
    expect(measurementType('biceps', 'l')).toBe('biceps_l')
    expect(parseMeasurementType('biceps_l')).toEqual({ base: 'biceps', side: 'l' })
    expect(parseMeasurementType('waist')).toEqual({ base: 'waist' })
    expect(parseMeasurementType('my_wrist_r')).toEqual({ base: 'my_wrist', side: 'r' })
  })
  it('measures left/right asymmetry from the latest entries of complete pairs', () => {
    const latest = latestByType([
      { type: 'biceps_l', value: 35, date: 1 }, { type: 'biceps_l', value: 36, date: 2 }, { type: 'biceps_r', value: 38, date: 2 },
      { type: 'thigh_l', value: 60, date: 1 }, { type: 'waist', value: 80, date: 1 },
    ])
    expect(latest.get('biceps_l')?.value).toBe(36)
    const a = asymmetries(latest)
    expect(a).toHaveLength(1) // thigh has no right side
    expect(a[0]).toMatchObject({ base: 'biceps', left: 36, right: 38, diff: -2 })
    expect(a[0].pct).toBeCloseTo((2 / 36) * 100, 5)
  })
})

describe('body fat', () => {
  it('is a percentage, not a circumference or a custom measurement', () => {
    expect(measurementUnit(BODY_FAT)).toBe('%')
    expect(measurementUnit('waist')).toBe('cm')
    expect(measurementUnit('wrist_l')).toBe('cm')
    expect(isCustomMeasurement(BODY_FAT)).toBe(false)
    expect(isCustomMeasurement('waist')).toBe(false)
    expect(isCustomMeasurement('wrist')).toBe(true)
  })
})

describe('entry timestamps', () => {
  it('uses the current time for today and midday for another day', () => {
    const now = at('2026-10-14', 9)
    expect(entryTimestamp('2026-10-14', now)).toBe(now)
    expect(entryTimestamp('2026-10-01', now)).toBe(at('2026-10-01', 12))
  })
})

describe('progress photo rules', () => {
  const photos = (day: string, count: number) => Array.from({ length: count }, (_, i) => ({ id: `${day}-${i}`, date: at(day, 8 + i), tag: i % 2 ? 'face' : undefined }))

  it('allows 6 photos per calendar day across all tags and blocks the 7th, including backdated ones', () => {
    expect(MAX_PHOTOS_PER_DAY).toBe(6)
    const full = photos('2026-10-10', 6)
    expect(canAddPhoto(full, at('2026-10-10', 23))).toBe(false)
    expect(canAddPhoto(full, at('2026-10-09'))).toBe(true)
    expect(canAddPhoto(photos('2026-10-10', 5), at('2026-10-10'))).toBe(true)
    expect(photosOnDay(full, at('2026-10-10', 1))).toHaveLength(6)
  })
  it('lets a photo stay on its own full day when it is being edited', () => {
    const full = photos('2026-10-10', 6)
    expect(canAddPhoto(full, at('2026-10-10'), full[0].id)).toBe(true)
  })

  it('lists tags by use, matches existing spellings ignoring case, and treats blank as untagged', () => {
    const tags = photoTags([{ tag: 'front' }, { tag: 'selfie' }, { tag: 'front' }, {}])
    expect(tags).toEqual(['front', 'selfie'])
    expect(normalizeTag('  FRONT ', tags)).toBe('front')
    expect(normalizeTag('side  view', tags)).toBe('side view')
    expect(normalizeTag('   ', tags)).toBeUndefined()
  })

  it('defaults compare to first vs latest of a tag and needs two photos', () => {
    const list = [
      { id: 'c', date: at('2026-10-03'), tag: 'front' }, { id: 'a', date: at('2026-10-01'), tag: 'front' },
      { id: 'b', date: at('2026-10-02'), tag: 'front' }, { id: 'x', date: at('2026-10-09'), tag: 'side' },
      { id: 'u1', date: at('2026-10-04') }, { id: 'u2', date: at('2026-10-05') },
    ]
    const d = compareDefaults(list, 'front')!
    expect([d.first.id, d.latest.id]).toEqual(['a', 'c'])
    expect(compareDefaults(list, 'side')).toBeUndefined()
    const u = compareDefaults(list, undefined)!
    expect([u.first.id, u.latest.id]).toEqual(['u1', 'u2'])
  })
})

describe('pins', () => {
  const bench: PinSpec = { kind: 'exercise', exerciseId: 'bench', metric: 'e1rm', range: '3m' }
  const squat: PinSpec = { kind: 'exercise', exerciseId: 'squat', metric: 'e1rm', range: '3m' }

  it('treats the same card with another range as the same card but a different pin', () => {
    expect(pinKey(bench)).not.toBe(pinKey({ ...bench, range: '1y' }))
    expect(cardKey(bench)).toBe(cardKey({ ...bench, range: '1y' }))
    expect(cardKey(bench)).not.toBe(cardKey(squat))
    expect(cardKey({ kind: 'measurement', measurement: 'biceps_l', range: 'all' })).not.toBe(cardKey({ kind: 'measurement', measurement: 'biceps_r', range: 'all' }))
  })

  it('pins, unpins and caps at 6', () => {
    const one = togglePin([], bench)!
    expect(isPinned(one, { ...bench, range: '1y' })).toBe(true)
    expect(togglePin(one, bench)).toEqual([])
    const full = Array.from({ length: MAX_PINS }, (_, i): PinSpec => ({ kind: 'exercise', exerciseId: `e${i}`, metric: 'e1rm', range: '3m' }))
    expect(togglePin(full, squat)).toBeUndefined()
    expect(togglePin(full, full[0])).toHaveLength(MAX_PINS - 1) // unpinning still works at the cap
  })

  it('reorders', () => {
    expect(movePin([bench, squat], 1, -1)).toEqual([squat, bench])
    expect(movePin([bench, squat], 0, -1)).toEqual([bench, squat])
  })

  it('drops pins whose exercise, muscle, measurement or photo tag was deleted', () => {
    const targets = { exerciseIds: new Set(['bench']), muscleIds: new Set(['m:chest']), measurementTypes: new Set(['waist']), photoTags: new Set(['front']), hasUntaggedPhotos: false }
    const pins: PinSpec[] = [
      bench, squat,
      { kind: 'muscles', muscleId: 'm:chest', range: '3m' }, { kind: 'muscles', muscleId: 'm:gone', range: '3m' }, { kind: 'muscles', range: '3m' },
      { kind: 'measurement', measurement: 'waist', range: '3m' }, { kind: 'measurement', measurement: 'hips', range: '3m' },
      { kind: 'photo', tag: 'front', photoMode: 'latest', range: 'all' }, { kind: 'photo', tag: 'side', photoMode: 'latest', range: 'all' },
      { kind: 'photo', photoMode: 'latest', range: 'all' }, { kind: 'bodyweight', range: '3m' },
    ]
    expect(validPins(pins, targets)).toEqual([
      bench, pins[2], pins[4], pins[5], pins[7], pins[10],
    ])
  })
})
