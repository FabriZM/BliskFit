import { describe, expect, it } from 'vitest'
import type { SetLog } from '../db/types'
import { formatSet, formatShortDate } from './format'
import { displayToKg } from './units'

const set = (p: Partial<SetLog>): SetLog => ({ id: 's', sessionId: 'a', exerciseId: 'e', order: 0, setType: 'working', ...p })

describe('formatSet', () => {
  it('shows sets without their own unit in the app units, with no unit', () => {
    expect(formatSet(set({ weight: 80, reps: 8 }), 'weight_reps', 'kg')).toBe('80×8')
    expect(formatSet(set({ weight: displayToKg(100, 'lb'), reps: 8 }), 'weight_reps', 'lb')).toBe('100×8')
  })
  it('shows a set as typed, adding the unit when it is not the app\'s', () => {
    expect(formatSet(set({ weight: displayToKg(100, 'lb'), unit: 'lb', reps: 8 }), 'weight_reps', 'kg')).toBe('100lb×8')
    expect(formatSet(set({ weight: 80, unit: 'kg', reps: 8 }), 'weight_reps', 'kg')).toBe('80×8')
    expect(formatSet(set({ extraWeight: 10, unit: 'kg', reps: 6 }), 'bodyweight_added', 'lb')).toBe('+10kg×6')
    expect(formatSet(set({ reps: 12, unit: 'kg' }), 'bodyweight_reps', 'lb')).toBe('12')
  })
})

describe('formatShortDate', () => {
  it('pads day, month and year to two digits', () => {
    expect(formatShortDate(new Date(2026, 9, 11, 22, 30).getTime())).toBe('11/10/26')
    expect(formatShortDate(new Date(2009, 0, 5).getTime())).toBe('05/01/09')
  })
})
