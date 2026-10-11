import { describe, expect, it } from 'vitest'
import type { SessionExercise, SetLog } from '../db/types'
import { MAX_CARD_EXERCISES, buildSummaryCard, type SummaryCardInput } from './summaryCard'

const item = (id: string, exerciseId: string): SessionExercise => ({ id, exerciseId, targetSets: 3 })
const set = (itemId: string, exerciseId: string, order: number, p: Partial<SetLog>): SetLog =>
  ({ id: `${itemId}-${order}`, sessionId: 's', itemId, exerciseId, order, setType: 'working', doneAt: 1, ...p })

const base = (over: Partial<SummaryCardInput> = {}): SummaryCardInput => ({
  title: 'Push', date: 'Monday', stats: [], units: 'kg', prs: new Map(),
  names: new Map([['bench', 'Bench press'], ['dips', 'Dips']]),
  trackingOf: (id) => (id === 'dips' ? 'bodyweight_added' : 'weight_reps'),
  items: [item('i1', 'bench'), item('i2', 'dips'), item('i3', 'bench')],
  sets: [
    set('i1', 'bench', 1, { weight: 80, reps: 8 }),
    set('i1', 'bench', 0, { weight: 40, reps: 10, setType: 'warmup' }),
    set('i1', 'bench', 2, { weight: 60, reps: 12, setType: 'drop' }),
    set('i1', 'bench', 3, { weight: 90, reps: 1, doneAt: undefined }), // not done
    set('i2', 'dips', 0, { extraWeight: 10, reps: 6 }),
    set('i3', 'bench', 0, { weight: 40, reps: 5, setType: 'warmup' }), // only a warm-up: exercise left off
  ],
  ...over,
})

describe('summary image content', () => {
  it('lists exercises in workout order with done working and drop sets, no warm-ups', () => {
    const card = buildSummaryCard(base())
    expect(card.exercises).toEqual([
      { name: 'Bench press', sets: ['80×8', 'D 60×12'], pr: false },
      { name: 'Dips', sets: ['+10×6'], pr: false },
    ])
    expect(card.more).toBe(0)
  })

  it('marks exercises with a PR (also from a warm-up) and only when PRs are passed in', () => {
    const card = buildSummaryCard(base({ prs: new Map([['i2-0', ['weight']]]) }))
    expect(card.exercises.map((e) => e.pr)).toEqual([false, true])
  })

  it('caps the number of exercises and counts the rest', () => {
    const items = Array.from({ length: 13 }, (_, i) => item(`i${i}`, 'bench'))
    const sets = items.map((it) => set(it.id, 'bench', 0, { weight: 50, reps: 5 }))
    const card = buildSummaryCard(base({ items, sets, units: 'lb' }))
    expect(card.exercises).toHaveLength(MAX_CARD_EXERCISES)
    expect(card.more).toBe(3)
    expect(card.exercises[0].sets).toEqual(['110.2×5'])
  })
})
