import { describe, expect, it } from 'vitest'
import type { Exercise } from '../db/types'
import { barWeight, describeSide, formatPlate, isPlateLoaded, loadFor, PLATES, retypeKg, setUnit, totalWeight, weightUnitFor } from './plates'
import { displayToKg, kgToDisplay } from './units'

const ex = (p: Partial<Exercise> = {}): Exercise => ({
  id: 'x', name: 'Bench', trackingType: 'weight_reps', equipment: 'barbell', primaryMuscleIds: [], secondaryMuscleIds: [], source: 'seeded', ...p,
})

describe('weightUnitFor', () => {
  it('uses the exercise unit when set, else the app units', () => {
    expect(weightUnitFor(ex(), 'kg')).toBe('kg')
    expect(weightUnitFor(ex({ weightUnit: 'lb' }), 'kg')).toBe('lb')
    expect(weightUnitFor(undefined, 'lb')).toBe('lb')
  })
})

describe('isPlateLoaded', () => {
  it('defaults to on for barbells and EZ bars only', () => {
    expect(isPlateLoaded(ex())).toBe(true)
    expect(isPlateLoaded(ex({ equipment: 'e-z curl bar' }))).toBe(true)
    expect(isPlateLoaded(ex({ equipment: 'machine' }))).toBe(false)
    expect(isPlateLoaded(ex({ equipment: undefined }))).toBe(false)
  })
  it('follows the exercise setting either way', () => {
    expect(isPlateLoaded(ex({ equipment: 'machine', plateLoaded: true }))).toBe(true)
    expect(isPlateLoaded(ex({ plateLoaded: false }))).toBe(false)
  })
  it('only applies to weight x reps', () => {
    expect(isPlateLoaded(ex({ trackingType: 'bodyweight_added', plateLoaded: true }))).toBe(false)
  })
})

describe('barWeight', () => {
  it('uses the usual bar for the equipment, in the unit asked for', () => {
    expect(barWeight(ex(), 'kg')).toBe(20)
    expect(barWeight(ex(), 'lb')).toBe(45)
    expect(barWeight(ex({ equipment: 'e-z curl bar' }), 'kg')).toBe(10)
    expect(barWeight(ex({ equipment: 'machine' }), 'kg')).toBe(0)
  })
  it('uses the saved bar, converted without drift', () => {
    expect(barWeight(ex({ barKg: 15 }), 'kg')).toBe(15)
    expect(barWeight(ex({ barKg: displayToKg(35, 'lb') }), 'lb')).toBe(35)
    expect(barWeight(ex({ barKg: 0, equipment: 'barbell' }), 'kg')).toBe(0)
  })
})

describe('loadFor', () => {
  it('loads the heaviest plates first, per side', () => {
    expect(loadFor(100, 20)).toEqual({ perSide: [25, 15], total: 100, exact: true })
    expect(loadFor(102.5, 20)).toEqual({ perSide: [25, 15, 1.25], total: 102.5, exact: true })
    expect(loadFor(225, 45, PLATES.lb)).toEqual({ perSide: [45, 45], total: 225, exact: true })
  })
  it('uses small plates without floating-point drift', () => {
    expect(loadFor(27.5, 20)).toEqual({ perSide: [2.5, 1.25], total: 27.5, exact: true })
  })
  it('falls back to the closest weight below when it cannot be loaded exactly', () => {
    expect(loadFor(101, 20)).toEqual({ perSide: [25, 15], total: 100, exact: false })
    expect(loadFor(50, 45, PLATES.lb)).toEqual({ perSide: [2.5], total: 50, exact: true })
    expect(loadFor(52, 45, PLATES.lb)).toEqual({ perSide: [2.5], total: 50, exact: false })
  })
  it('returns just the bar when the target is at or below it', () => {
    expect(loadFor(20, 20)).toEqual({ perSide: [], total: 20, exact: true })
    expect(loadFor(15, 20)).toEqual({ perSide: [], total: 20, exact: false })
  })
  it('works for plate-loaded machines with no bar', () => {
    expect(loadFor(90, 0)).toEqual({ perSide: [25, 20], total: 90, exact: true })
  })
})

describe('totalWeight and describeSide', () => {
  it('adds the bar and both sides', () => {
    expect(totalWeight(20, [20, 2.5, 1.25])).toBe(67.5)
    expect(totalWeight(45, [])).toBe(45)
  })
  it('groups repeated plates', () => {
    expect(describeSide([20, 20, 5, 1.25])).toBe('2×20 + 5 + 1.25')
    expect(describeSide([])).toBe('')
  })
})

describe('formatPlate', () => {
  it('keeps quarter plates', () => {
    expect(formatPlate(1.25)).toBe('1.25')
    expect(formatPlate(31.25)).toBe('31.25')
    expect(formatPlate(20)).toBe('20')
  })
})

describe('setUnit and retypeKg', () => {
  it('a set shows in its own unit, else its hint’s while still blank, else the fallback', () => {
    expect(setUnit({ unit: 'lb', weight: 20 }, 'kg', { unit: 'kg' })).toBe('lb')
    expect(setUnit({}, 'kg', { unit: 'lb' })).toBe('lb')
    expect(setUnit({ weight: 20 }, 'kg', { unit: 'lb' })).toBe('kg') // typed before units were kept: the fallback
    expect(setUnit({}, 'kg')).toBe('kg')
  })
  it('keeps the typed number in the other unit', () => {
    expect(kgToDisplay(retypeKg(122.5, 'kg', 'lb')!, 'lb')).toBe(122.5)
    expect(kgToDisplay(retypeKg(displayToKg(45, 'lb'), 'lb', 'kg')!, 'kg')).toBe(45)
    expect(retypeKg(80, 'kg', 'kg')).toBe(80)
    expect(retypeKg(undefined, 'kg', 'lb')).toBeUndefined()
  })
})
