import { describe, expect, it } from 'vitest'
import type { Exercise } from '../db/types'
import { filterExercises, matchesQuery } from './exerciseFilter'

const ex = (id: string, primary: string[], secondary: string[] = []): Exercise =>
  ({ id, name: id, trackingType: 'weight_reps', primaryMuscleIds: primary, secondaryMuscleIds: secondary, source: 'custom' }) as unknown as Exercise
const names = (l: Exercise[]) => l.map((e) => e.id)

const list = [ex('bench', ['chest'], ['triceps']), ex('dips', ['triceps'], ['chest']), ex('fly', ['chest']), ex('curl', ['biceps'])]
const base = { query: '', equipment: '' }

describe('filterExercises by muscle', () => {
  it('matches primary and secondary muscles, primary matches first', () => {
    expect(names(filterExercises(list, { ...base, muscleIds: new Set(['chest']) }))).toEqual(['bench', 'fly', 'dips'])
  })

  it('primaryOnly leaves out exercises that only help the muscle', () => {
    expect(names(filterExercises(list, { ...base, muscleIds: new Set(['chest']), primaryOnly: true }))).toEqual(['bench', 'fly'])
  })
})

describe('matchesQuery', () => {
  const row = { name: 'Seated Cable Rows', equipment: 'cable' }
  it('finds every word in the name or the equipment, ignoring case and accents', () => {
    expect(matchesQuery(row, 'cable row')).toBe(true)
    expect(matchesQuery(row, 'ROWS  seated')).toBe(true)
    expect(matchesQuery({ name: 'Pushups', equipment: 'body only' }, 'body')).toBe(true)
    expect(matchesQuery(row, 'cable curl')).toBe(false)
    expect(matchesQuery(row, '  ')).toBe(true)
  })
  it('searches the equipment as shown too (translated)', () => {
    const label = (eq: string) => ({ dumbbell: 'Mancuerna', none: 'Sin equipo' })[eq] ?? eq
    expect(matchesQuery({ name: 'Hammer Curls', equipment: 'dumbbell' }, 'mancuerna curl', label)).toBe(true)
    expect(matchesQuery({ name: 'Plank' }, 'sin equipo', label)).toBe(true)
  })
})
