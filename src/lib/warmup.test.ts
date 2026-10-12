import { describe, expect, it } from 'vitest'
import { warmupSets, type WarmupInput } from './warmup'

const w = (i: Partial<WarmupInput> & { work: number }) =>
  warmupSets({ tracking: 'weight_reps', unit: 'kg', ...i }).map((s) => `${s.weight}×${s.reps}`)

describe('warmupSets: barbell lifts', () => {
  it('ramps from the empty bar through loadable weights', () => {
    expect(w({ work: 100, bar: 20 })).toEqual(['20×10', '40×5', '60×3', '80×2'])
  })
  it('adds a 90% single for heavy work', () => {
    expect(w({ work: 160, bar: 20 })).toEqual(['20×10', '62.5×5', '95×3', '127.5×2', '142.5×1'])
    expect(w({ work: 315, unit: 'lb', bar: 45 })).toEqual(['45×10', '125×5', '185×3', '250×2', '280×1'])
  })
  it('drops steps too close to the one before, so light work gets fewer sets', () => {
    expect(w({ work: 60, bar: 20 })).toEqual(['20×10', '35×3', '47.5×2'])
    expect(w({ work: 135, unit: 'lb', bar: 45 })).toEqual(['45×10', '80×3', '105×2'])
  })
  it('never reaches the working weight, and nothing when the work is the empty bar', () => {
    expect(w({ work: 30, bar: 20 })).toEqual(['20×10', '22.5×2'])
    expect(w({ work: 20, bar: 20 })).toEqual([])
    expect(w({ work: 0, bar: 20 })).toEqual([])
  })
  it('uses the saved bar and the plates of the unit', () => {
    expect(w({ work: 100, bar: 15 })).toEqual(['15×10', '40×5', '60×3', '80×2'])
    expect(w({ work: 200, bar: 0 })).toEqual(['80×5', '120×3', '160×2', '180×1']) // plate-loaded sled: no bar set
  })
})

describe('warmupSets: other equipment', () => {
  it('rounds down to 2.5 kg / 5 lb steps when not loaded with plates', () => {
    expect(w({ work: 30 })).toEqual(['10×5', '17.5×3', '22.5×2'])
    expect(w({ work: 50, unit: 'lb' })).toEqual(['20×5', '30×3', '40×2'])
  })
  it('gives isolation lifts a short ramp, without the empty bar', () => {
    expect(w({ work: 12.5, mechanic: 'isolation' })).toEqual(['5×8', '7.5×3'])
    expect(w({ work: 30, bar: 10, mechanic: 'isolation' })).toEqual(['15×8', '22.5×3'])
  })
  it('weighted bodyweight: bodyweight only, then about half the added weight', () => {
    expect(w({ tracking: 'bodyweight_added', work: 20 })).toEqual(['0×5', '10×3'])
    expect(w({ tracking: 'bodyweight_added', work: 2.5 })).toEqual(['0×5'])
  })
  it('is not offered for other tracking types', () => {
    for (const tracking of ['bodyweight_reps', 'assisted_bodyweight', 'duration', 'cardio'] as const) expect(w({ tracking, work: 50 })).toEqual([])
  })
})
