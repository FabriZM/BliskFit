import { describe, expect, it } from 'vitest'
import { csvField, setsToCsv } from './csv'
import type { Exercise, SetLog, WorkoutSession } from '../db/types'

const ex = (id: string, name: string): Exercise => ({ id, name, trackingType: 'weight_reps', primaryMuscleIds: [], secondaryMuscleIds: [], source: 'custom' })
const session = (id: string, startedAt: number, status: WorkoutSession['status'] = 'finished', notes?: string): WorkoutSession =>
  ({ id, startedAt, status, pausedIntervals: [], routineId: 'r', notes, exercises: [
    { id: 'ix', exerciseId: 'x', targetSets: 2 }, { id: 'iy', exerciseId: 'y', targetSets: 2 }] })
const set = (sessionId: string, exerciseId: string, order: number, p: Partial<SetLog> = {}): SetLog =>
  ({ id: `${sessionId}${exerciseId}${order}`, sessionId, exerciseId, order, setType: 'working', ...p })

describe('sets CSV', () => {
  it('quotes only fields that need it', () => {
    expect(csvField('Bench')).toBe('Bench')
    expect(csvField('Curl, "EZ"')).toBe('"Curl, ""EZ"""')
    expect(csvField(undefined)).toBe('')
    expect(csvField(82.5)).toBe('82.5')
  })

  it('lists sets of finished workouts oldest first, numbered per exercise, in the chosen units, skipping blank sets', () => {
    const t1 = new Date(2026, 9, 1, 18, 5).getTime()
    const t2 = new Date(2026, 9, 3, 7, 0).getTime()
    const csv = setsToCsv({
      sessions: [session('b', t2, 'finished', 'felt good, strong'), session('a', t1), session('c', t2 + 1, 'active')],
      sets: [
        set('b', 'x', 0, { weight: 100, reps: 3 }),
        set('a', 'x', 1, { weight: 60, reps: 8, rpe: 8 }),
        set('a', 'x', 0, { weight: 50, reps: 10, setType: 'warmup' }),
        set('a', 'y', 0, { reps: 12, failure: true, itemId: 'iy' }),
        set('a', 'y', 1), // never filled in
        set('c', 'x', 0, { weight: 1, reps: 1 }), // workout still running
      ],
      exercises: new Map([['x', ex('x', 'Squat')], ['y', ex('y', 'Pull-up, wide')]]),
      routines: new Map([['r', { id: 'r', name: 'Legs', exercises: [], archived: false }]]),
      gyms: new Map(),
      units: 'lb',
    })
    const lines = csv.trim().split('\r\n')
    expect(lines[0]).toBe('date,workout,gym,exercise,set,set_type,weight_lb,extra_weight_lb,reps,duration_sec,distance_m,rpe,rir,failure,workout_notes')
    expect(lines.slice(1)).toEqual([
      '2026-10-01 18:05,Legs,,Squat,1,warmup,110.2,,10,,,,,,',
      '2026-10-01 18:05,Legs,,Squat,2,working,132.3,,8,,,8,,,',
      '2026-10-01 18:05,Legs,,"Pull-up, wide",1,working,,,12,,,,,1,',
      '2026-10-03 07:00,Legs,,Squat,1,working,220.5,,3,,,,,,"felt good, strong"',
    ])
  })
})
