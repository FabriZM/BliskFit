import { describe, expect, it } from 'vitest'
import { bmi, bmiCategory, suggestGoal, weightAtBmi } from './bmi'

describe('bmi', () => {
  it('is kg over height in metres squared, to one decimal', () => {
    expect(bmi(80, 180)).toBe(24.7)
    expect(bmi(100, 175)).toBe(32.7)
  })
  it('is undefined without a usable weight and height', () => {
    expect(bmi(undefined, 180)).toBeUndefined()
    expect(bmi(80, undefined)).toBeUndefined()
    expect(bmi(0, 180)).toBeUndefined()
  })
})

describe('bmiCategory', () => {
  it('uses the WHO bands', () => {
    expect([17, 18.5, 24.9, 25, 29.9, 30].map(bmiCategory)).toEqual(['underweight', 'healthy', 'healthy', 'overweight', 'overweight', 'obese'])
  })
})

describe('suggestGoal', () => {
  it('suggests the top of the healthy range from above and the bottom from below', () => {
    expect(suggestGoal(100, 175)).toEqual({ bmi: 24.9, kg: weightAtBmi(24.9, 175) })
    expect(suggestGoal(50, 175)).toEqual({ bmi: 18.5, kg: weightAtBmi(18.5, 175) })
  })
  it('has no suggestion when already healthy or data is missing', () => {
    expect(suggestGoal(70, 175)).toBeUndefined()
    expect(suggestGoal(undefined, 175)).toBeUndefined()
    expect(suggestGoal(70, undefined)).toBeUndefined()
  })
})
