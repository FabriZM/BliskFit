import { describe, expect, it } from 'vitest'
import type { Exercise } from '../db/types'
import { filterExercises } from './exerciseFilter'

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
