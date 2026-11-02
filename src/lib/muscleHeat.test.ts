import { describe, expect, it } from 'vitest'
import type { SetLog } from '../db/types'
import { effectiveHeat, heatFromSets, heatLevel, regionHeat } from './muscleHeat'

const set = (exerciseId: string, over: Partial<SetLog> = {}): SetLog =>
  ({ id: Math.random().toString(), sessionId: 's', exerciseId, order: 0, setType: 'working', doneAt: 1, ...over }) as SetLog
const ex = new Map([
  ['bench', { primaryMuscleIds: ['m:chest'], secondaryMuscleIds: ['m:triceps'] }],
  ['curl', { primaryMuscleIds: ['m:biceps'], secondaryMuscleIds: [] }],
])

describe('heatFromSets', () => {
  it('credits primary muscles fully and secondary ones by half', () => {
    const h = heatFromSets([set('bench'), set('bench')], ex)
    expect(h.get('m:chest')).toBe(2)
    expect(h.get('m:triceps')).toBe(1)
    expect(h.has('m:biceps')).toBe(false)
  })
  it('skips warm-ups, unfinished sets and unknown exercises', () => {
    const h = heatFromSets([set('bench', { setType: 'warmup' }), set('bench', { doneAt: undefined }), set('ghost')], ex)
    expect(h.size).toBe(0)
  })
  it('is empty without sets', () => expect(heatFromSets([], ex).size).toBe(0))
})

describe('heatLevel', () => {
  it('is 0 for untargeted muscles or an empty period', () => {
    expect(heatLevel(0, 10)).toBe(0)
    expect(heatLevel(3, 0)).toBe(0)
  })
  it('gives any work at least level 1 and the maximum level 5', () => {
    expect(heatLevel(0.1, 100)).toBe(1)
    expect(heatLevel(10, 10)).toBe(5)
    expect(heatLevel(5, 10)).toBe(3)
  })
})

describe('regionHeat', () => {
  it('takes the highest of the region muscles', () => {
    const h = new Map([['m:lats', 2], ['m:middle-back', 5]])
    expect(regionHeat(h, { id: 'back', muscles: ['m:lats', 'm:middle-back'] })).toBe(5)
    expect(regionHeat(h, { id: 'neck', muscles: ['m:neck'] })).toBe(0)
  })
})

describe('effectiveHeat', () => {
  it('lets a group-level tag light its muscles, and keeps their own sets', () => {
    const h = new Map([['m:shoulders', 3], ['m:rear-delts', 5]])
    expect(effectiveHeat(h, 'm:front-delts')).toBe(3)
    expect(effectiveHeat(h, 'm:rear-delts')).toBe(5)
    expect(effectiveHeat(h, 'm:chest')).toBe(0)
  })
})
