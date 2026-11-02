import { describe, expect, it } from 'vitest'
import { leanMass, shoulderToWaist, whtr, whtrBand } from './indicators'

describe('whtr', () => {
  it('is waist over height to two decimals', () => {
    expect(whtr(90, 180)).toBe(0.5)
    expect(whtr(81, 178)).toBe(0.46)
  })
  it('is undefined without both', () => {
    expect(whtr(undefined, 180)).toBeUndefined()
    expect(whtr(80, 0)).toBeUndefined()
  })
  it('bands at 0.4, 0.5 and 0.6', () => {
    expect([0.39, 0.4, 0.49, 0.5, 0.59, 0.6].map(whtrBand)).toEqual(['lean', 'healthy', 'healthy', 'raised', 'raised', 'high'])
  })
})

describe('shoulderToWaist', () => {
  it('is shoulders over waist', () => {
    expect(shoulderToWaist(120, 80)).toBe(1.5)
    expect(shoulderToWaist(undefined, 80)).toBeUndefined()
  })
})

describe('leanMass', () => {
  it('splits weight by body fat and gives the FFMI', () => {
    expect(leanMass(80, 20, 180)).toEqual({ leanKg: 64, fatKg: 16, ffmi: 19.8 })
  })
  it('is undefined for missing or impossible inputs', () => {
    expect(leanMass(80, undefined, 180)).toBeUndefined()
    expect(leanMass(80, 100, 180)).toBeUndefined()
    expect(leanMass(undefined, 20, 180)).toBeUndefined()
  })
})
