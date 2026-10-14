import { describe, expect, it } from 'vitest'
import type { Exercise } from '../db/types'
import seed from '../data/seed-exercises.json'
import es from '../data/seed-names-es.json'
import { filterExercises } from './exerciseFilter'
import { exerciseName } from './exerciseName'

const bench: Exercise = {
  id: 'x:Barbell_Bench_Press_-_Medium_Grip', name: 'Barbell Bench Press - Medium Grip', trackingType: 'weight_reps',
  primaryMuscleIds: [], secondaryMuscleIds: [], source: 'seeded',
}
const mine: Exercise = { ...bench, id: 'abc', name: 'Press de banca de Fabri', source: 'custom' }

describe('exerciseName', () => {
  it('translates built-in exercises and leaves custom ones as typed', () => {
    expect(exerciseName(bench, 'es')).toBe('Press de banca con barra - agarre medio')
    expect(exerciseName(bench, 'es-UY')).toBe('Press de banca con barra - agarre medio')
    expect(exerciseName(bench, 'en')).toBe('Barbell Bench Press - Medium Grip')
    expect(exerciseName(mine, 'es')).toBe('Press de banca de Fabri')
  })

  it('has a unique Spanish name for every seeded exercise', () => {
    const names = (seed as { id: string }[]).map((r) => (es as Record<string, string>)[r.id])
    expect(names.every(Boolean)).toBe(true)
    expect(new Set(names).size).toBe(names.length)
  })

  it('search finds an exercise by its English or its Spanish name', () => {
    const f = (query: string) => filterExercises([bench], { query, muscleIds: new Set(), equipment: '', displayName: (e) => exerciseName(e, 'es') })
    expect(f('press banca')).toHaveLength(1)
    expect(f('bench press')).toHaveLength(1)
    expect(f('sentadilla')).toHaveLength(0)
  })
})
