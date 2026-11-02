import { describe, expect, it } from 'vitest'
import { activityFactor, bmr, leanMass, maintenanceKcal, navyBodyFat, shoulderToWaist, whr, whrRaised, whtr, whtrBand } from './indicators'

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

describe('whr', () => {
  it('is waist over hips, flagged at 0.90 for men and 0.85 for women', () => {
    expect(whr(90, 100)).toBe(0.9)
    expect(whrRaised(0.9, 'male')).toBe(true)
    expect(whrRaised(0.89, 'male')).toBe(false)
    expect(whrRaised(0.86, 'female')).toBe(true)
    expect(whr(90, undefined)).toBeUndefined()
  })
})

describe('navyBodyFat', () => {
  it('matches the Navy formula for a man and a woman', () => {
    expect(navyBodyFat('male', 180, 85, 38)).toBe(16.1)
    expect(navyBodyFat('female', 165, 75, 32, 100)).toBe(29.9)
  })
  it('needs hips for women and a waist bigger than the neck', () => {
    expect(navyBodyFat('female', 165, 75, 32)).toBeUndefined()
    expect(navyBodyFat('male', 180, 35, 38)).toBeUndefined()
    expect(navyBodyFat('male', undefined, 85, 38)).toBeUndefined()
  })
})

describe('bmr and maintenance', () => {
  it('uses Mifflin-St Jeor', () => {
    expect(bmr('male', 80, 180, 30)).toBe(1780)
    expect(bmr('female', 60, 165, 30)).toBe(1320)
    expect(bmr('male', 80, 180, undefined)).toBeUndefined()
  })
  it('scales by training days and rounds to 10 kcal', () => {
    expect([1, 3, 6].map(activityFactor)).toEqual([1.375, 1.55, 1.725])
    expect(maintenanceKcal(1780, 3)).toBe(2760)
  })
})
