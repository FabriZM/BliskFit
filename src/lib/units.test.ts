import { describe, expect, it } from 'vitest'
import { displayToKg, formatClock, formatNum, kgToDisplay, parseDecimal } from './units'

describe('units', () => {
  it('round-trips lb through kg storage', () => {
    for (const lb of [45, 100, 135, 225.5]) expect(kgToDisplay(displayToKg(lb, 'lb'), 'lb')).toBe(lb)
    expect(kgToDisplay(100, 'kg')).toBe(100)
    expect(kgToDisplay(100, 'lb')).toBe(220.5)
  })
  it('parses decimals leniently', () => {
    expect(parseDecimal('82,5')).toBe(82.5)
    expect(parseDecimal('82.')).toBe(82)
    expect(parseDecimal('.5')).toBe(0.5)
    expect(parseDecimal('')).toBeUndefined()
    expect(parseDecimal('abc')).toBeUndefined()
    expect(parseDecimal('1.2.3')).toBeUndefined()
    expect(formatNum(82.5)).toBe('82.5')
    expect(formatNum(80)).toBe('80')
  })
  it('formats clocks', () => {
    expect(formatClock(5_000)).toBe('0:05')
    expect(formatClock(75_000)).toBe('1:15')
    expect(formatClock(3_725_000)).toBe('1:02:05')
  })
})
