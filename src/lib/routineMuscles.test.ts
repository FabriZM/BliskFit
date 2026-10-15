import { describe, expect, it } from 'vitest'
import { routineMuscles } from './muscles'

const muscles = [
  { id: 'm:chest', name: 'Chest' }, { id: 'm:arms', name: 'Arms' }, { id: 'm:triceps', name: 'Triceps', parentId: 'm:arms' },
  { id: 'm:biceps', name: 'Biceps', parentId: 'm:arms' }, { id: 'm:legs', name: 'Legs' }, { id: 'm:quadriceps', name: 'Quadriceps', parentId: 'm:legs' },
]
const ex = (id: string, ...primaryMuscleIds: string[]) => ({ id, primaryMuscleIds })

describe('routineMuscles', () => {
  it('rolls primary muscles up to their groups, most sets first', () => {
    const items = [{ exerciseId: 'a', targetSets: 4 }, { exerciseId: 'b', targetSets: 3 }, { exerciseId: 'c', targetSets: 3 }]
    const got = routineMuscles(items, [ex('a', 'm:chest'), ex('b', 'm:triceps'), ex('c', 'm:biceps')], muscles)
    expect(got.map((m) => m.id)).toEqual(['m:arms', 'm:chest'])
  })
  it('limits the result and ignores unknown exercises and muscles', () => {
    const items = [{ exerciseId: 'a', targetSets: 3 }, { exerciseId: 'b', targetSets: 2 }, { exerciseId: 'c', targetSets: 1 }]
    expect(routineMuscles(items, [ex('a', 'm:chest'), undefined, ex('c', 'x')], muscles).map((m) => m.id)).toEqual(['m:chest'])
    expect(routineMuscles(items, [ex('a', 'm:chest'), ex('b', 'm:legs'), ex('c', 'm:arms')], muscles, 2)).toHaveLength(2)
  })
})
