import { describe, expect, it } from 'vitest'
import { REMINDER_HORIZON, reminderSchedule } from './reminders'

const at = (s: string) => new Date(s)
const day = (ms: number) => new Date(ms).getDay()

describe('reminderSchedule', () => {
  const now = at('2026-10-07T10:00:00') // Wednesday

  it('plans the chosen weekdays at the chosen time, within the horizon', () => {
    const r = reminderSchedule(now, [1, 3, 5], '18:30', false) // Mon, Wed, Fri
    expect(r.map((x) => day(x.at))).toEqual([3, 5, 1, 3, 5, 1]) // Wed(today 18:30), Fri, Mon, Wed, Fri, Mon
    expect(r.every((x) => new Date(x.at).getHours() === 18 && new Date(x.at).getMinutes() === 30)).toBe(true)
    expect(Math.max(...r.map((x) => x.at)) - now.getTime()).toBeLessThan(REMINDER_HORIZON * 86_400_000)
  })
  it('skips a time that has already passed today', () => {
    const r = reminderSchedule(at('2026-10-07T19:00:00'), [3], '18:30', false)
    expect(day(r[0].at)).toBe(3)
    expect(new Date(r[0].at).getDate()).toBe(14) // next Wednesday, not today
  })
  it('skips today once a workout was finished today, but not other days', () => {
    const r = reminderSchedule(now, [3, 5], '18:00', true)
    expect(new Date(r[0].at).getDate()).toBe(9) // Friday
    expect(r.some((x) => new Date(x.at).getDate() === 7)).toBe(false)
  })
  it('uses stable ids per day offset so a re-plan replaces the old ones', () => {
    const a = reminderSchedule(now, [3, 5], '18:00', false), b = reminderSchedule(now, [3, 5], '18:00', false)
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id))
    expect(new Set(a.map((x) => x.id)).size).toBe(a.length)
    expect(a[0].id).toBe(2000) // today
  })
  it('does nothing without days or with an invalid time', () => {
    expect(reminderSchedule(now, [], '18:00', false)).toEqual([])
    expect(reminderSchedule(now, [3], 'soon', false)).toEqual([])
  })
  it('is correct across a daylight-saving change (local wall-clock time)', () => {
    const r = reminderSchedule(at('2026-10-30T10:00:00'), [0, 1, 2, 3, 4, 5, 6], '09:00', false, 5) // US DST ends Nov 1
    expect(r.every((x) => new Date(x.at).getHours() === 9)).toBe(true)
  })
})
