import { describe, expect, it } from 'vitest'
import { leafMuscles, routineMuscles } from './muscles'

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

describe('leafMuscles', () => {
  const ms = [{ id: 'm:shoulders', name: 'Shoulders' }, { id: 'm:front-delts', name: 'Front delts', parentId: 'm:shoulders' },
    { id: 'm:rear-delts', name: 'Rear delts', parentId: 'm:shoulders' }, { id: 'm:chest', name: 'Chest' }]
  it('turns a group into its leaves and keeps leaves as they are', () => {
    expect(leafMuscles(ms, ['m:shoulders', 'm:chest']).sort()).toEqual(['m:chest', 'm:front-delts', 'm:rear-delts'])
    expect(leafMuscles(ms, ['m:rear-delts'])).toEqual(['m:rear-delts'])
    expect(leafMuscles(ms, [])).toEqual([])
  })
})
