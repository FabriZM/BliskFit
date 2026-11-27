import { describe, expect, it } from 'vitest'
import { timeSince } from './dates'

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime()

describe('timeSince', () => {
  const now = at(2026, 11, 27, 9)
  it('counts calendar days', () => {
    expect(timeSince(at(2026, 11, 27, 7), now, 'en')).toBe('today')
    expect(timeSince(at(2026, 11, 26, 23), now, 'en')).toBe('yesterday')
    expect(timeSince(at(2026, 11, 22), now, 'en')).toBe('5 days ago')
  })
  it('switches to weeks, months and years', () => {
    expect(timeSince(at(2026, 11, 13), now, 'en')).toBe('2 weeks ago')
    expect(timeSince(at(2026, 8, 27), now, 'en')).toBe('3 months ago')
    expect(timeSince(at(2024, 11, 1), now, 'en')).toBe('2 years ago')
  })
  it('speaks Spanish', () => {
    expect(timeSince(at(2026, 11, 26), now, 'es')).toBe('ayer')
  })
})
