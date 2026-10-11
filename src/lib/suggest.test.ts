import { describe, expect, it } from 'vitest'
import type { Exercise, MuscleGroup, SetLog } from '../db/types'
import { epley } from './prs'
import { roundWeightKg, similarity, suggestStart, type SuggestSource } from './suggest'

const muscles: MuscleGroup[] = [
  { id: 'legs', name: 'Legs' }, { id: 'calves', name: 'Calves', parentId: 'legs' },
  { id: 'gastro', name: 'Gastrocnemius', parentId: 'calves' }, { id: 'quads', name: 'Quads', parentId: 'legs' },
  { id: 'chest', name: 'Chest' }, { id: 'triceps', name: 'Triceps' }, { id: 'shoulders', name: 'Shoulders' },
]
const MS = { muscles, units: 'kg' as const }

let n = 0
const ex = (id: string, extra: Partial<Exercise> = {}): Exercise => ({
  id, name: id, trackingType: 'weight_reps', primaryMuscleIds: ['chest'], secondaryMuscleIds: ['triceps'], source: 'seeded',
  equipment: 'barbell', mechanic: 'compound', ...extra,
})
const set = (extra: Partial<SetLog>): SetLog => ({ id: `s${++n}`, sessionId: 'a', exerciseId: 'e', order: 0, setType: 'working', doneAt: 1000, ...extra })
const hist = (exercise: Exercise, sessions: [string, number, [number, number][]][]): SuggestSource => ({
  exercise,
  sets: sessions.flatMap(([sid, at, sets]) => sets.map(([weight, reps], i) => set({ sessionId: sid, doneAt: at + i, order: i, weight, reps, exerciseId: exercise.id }))),
})

describe('similarity', () => {
  const byId = new Map(muscles.map((m) => [m.id, m]))
  it('same muscle and equipment scores highest', () => {
    const t = ex('incline')
    expect(similarity(t, ex('bench'), byId)).toBeGreaterThan(similarity(t, ex('db-bench', { equipment: 'dumbbell' }), byId))
    expect(similarity(t, ex('bench', { equipment: 'dumbbell' }), byId)).toBeGreaterThan(0.5)
  })
  it('different muscle, different tracking type, itself, and mechanic mismatch score zero', () => {
    const t = ex('incline')
    expect(similarity(t, ex('ohp', { primaryMuscleIds: ['shoulders'] }), byId)).toBe(0)
    expect(similarity(t, ex('plank', { trackingType: 'duration' }), byId)).toBe(0)
    expect(similarity(t, t, byId)).toBe(0)
    expect(similarity(t, ex('fly', { mechanic: 'isolation' }), byId)).toBe(0)
  })
  it('treats parent and child muscles as the same (Calves vs Gastrocnemius)', () => {
    expect(similarity(ex('seated', { primaryMuscleIds: ['calves'] }), ex('standing', { primaryMuscleIds: ['gastro'] }), byId)).toBeGreaterThan(0.5)
  })
  it('compound vs unknown mechanic is allowed', () => {
    expect(similarity(ex('x', { mechanic: undefined }), ex('bench'), byId)).toBeGreaterThan(0)
  })
})

describe('suggestStart: weighted lifts', () => {
  it('suggests from a similar exercise with the same equipment, conservatively', () => {
    const bench = hist(ex('bench'), [['s1', 10_000, [[100, 5]]]])
    const s = suggestStart(ex('incline'), [bench], MS)!
    const target = epley(100, 5) / (1 + 10 / 30) * 0.85 // 74.4 -> rounded to 75
    expect(s.weightKg).toBe(75)
    expect(Math.abs(s.weightKg! - target)).toBeLessThanOrEqual(1.25)
    expect(s.reps).toBe(10)
    expect(s.basedOn.map((b) => b.id)).toEqual(['bench'])
    expect(s.confidence).toBe('rough') // only one source
  })

  it('converts between equipment (barbell bench -> dumbbell press is per hand and much lighter)', () => {
    const bench = hist(ex('bench'), [['s1', 10_000, [[100, 5]]]])
    const s = suggestStart(ex('db-press', { equipment: 'dumbbell' }), [bench], MS)!
    expect(s.weightKg).toBeGreaterThan(25)
    expect(s.weightKg).toBeLessThan(35)
    expect(s.confidence).toBe('rough')
  })

  it('uses the mean of recent workouts, not just the best ever, and ignores old ones', () => {
    const bench = hist(ex('bench'), [
      ['new', 40_000, [[100, 5]]], ['mid', 30_000, [[100, 5]]], ['mid2', 20_000, [[100, 5]]],
      ['ancient', 1_000, [[200, 5]]], // older than the 3 most recent workouts
    ])
    expect(suggestStart(ex('incline'), [bench], MS)!.weightKg).toBe(75)
  })

  it('ignores warm-ups, undone sets and sets above 12 reps when better ones exist', () => {
    const b = hist(ex('bench'), [['s1', 10_000, [[100, 5]]]])
    b.sets.push(set({ sessionId: 's1', weight: 300, reps: 5, setType: 'warmup', exerciseId: 'bench' }))
    b.sets.push(set({ sessionId: 's1', weight: 300, reps: 5, doneAt: undefined, exerciseId: 'bench' }))
    b.sets.push(set({ sessionId: 's1', weight: 60, reps: 25, exerciseId: 'bench' })) // would give e1RM 110
    expect(suggestStart(ex('incline'), [b], MS)!.weightKg).toBe(75)
  })

  it('blends several similar exercises and reports an estimate when equipment matches', () => {
    const a = hist(ex('bench'), [['s1', 10_000, [[100, 5]]]])
    const b = hist(ex('flat2', { name: 'flat2' }), [['s2', 10_000, [[100, 5]]]])
    const s = suggestStart(ex('incline'), [a, b], MS)!
    expect(s.confidence).toBe('estimate')
    expect(s.basedOn).toHaveLength(2)
  })

  it('honours the routine rep target', () => {
    const bench = hist(ex('bench'), [['s1', 10_000, [[100, 5]]]])
    const light = suggestStart(ex('incline'), [bench], { ...MS, targetReps: 12 })!
    const heavy = suggestStart(ex('incline'), [bench], { ...MS, targetReps: 5 })!
    expect(heavy.weightKg!).toBeGreaterThan(light.weightKg!)
    expect([light.reps, heavy.reps]).toEqual([12, 5])
  })

  it('suggests nothing without a comparable exercise that has history', () => {
    expect(suggestStart(ex('incline'), [], MS)).toBeUndefined()
    expect(suggestStart(ex('incline'), [hist(ex('ohp', { primaryMuscleIds: ['shoulders'] }), [['s', 1, [[50, 5]]]])], MS)).toBeUndefined()
    expect(suggestStart(ex('incline'), [{ exercise: ex('bench'), sets: [] }], MS)).toBeUndefined()
    expect(suggestStart(ex('run', { trackingType: 'cardio' }), [hist(ex('bench'), [['s', 1, [[50, 5]]]])], MS)).toBeUndefined()
  })

  it('does not draw a compound lift from an isolation one', () => {
    const fly = hist(ex('fly', { mechanic: 'isolation', equipment: 'cable' }), [['s', 1, [[20, 12]]]])
    expect(suggestStart(ex('incline'), [fly], MS)).toBeUndefined()
  })
})

describe('suggestStart: other tracking types', () => {
  it('bodyweight reps: a bit under what similar exercises reach', () => {
    const pushups = hist(ex('pushups', { trackingType: 'bodyweight_reps', equipment: 'body only' }), [['s', 1, [[0, 20]]]])
    // bodyweight sets carry reps only
    pushups.sets.forEach((x) => { delete x.weight })
    const s = suggestStart(ex('dips', { trackingType: 'bodyweight_reps', equipment: 'body only' }), [pushups], MS)!
    expect(s.reps).toBe(17) // 20 * 0.85
    expect(s.weightKg).toBeUndefined()
  })
  it('duration: rounded to 5 s', () => {
    const plank = hist(ex('plank', { trackingType: 'duration', mechanic: 'isolation', equipment: 'body only' }), [])
    plank.sets = [set({ sessionId: 's', durationSec: 60, exerciseId: 'plank' })]
    const s = suggestStart(ex('sideplank', { trackingType: 'duration', mechanic: 'isolation', equipment: 'body only' }), [plank], MS)!
    expect(s.durationSec).toBe(50) // 51 -> 50
  })
  it('weighted bodyweight: added load from similar weighted exercises', () => {
    const wp = hist(ex('wpull', { trackingType: 'bodyweight_added', equipment: 'body only' }), [])
    wp.sets = [set({ sessionId: 's', extraWeight: 20, reps: 5, exerciseId: 'wpull' })]
    const s = suggestStart(ex('wchin', { trackingType: 'bodyweight_added', equipment: 'body only' }), [wp], MS)!
    expect(s.weightKg).toBeGreaterThan(0)
    expect(s.weightKg).toBeLessThanOrEqual(20)
  })
})

describe('roundWeightKg', () => {
  it('rounds to practical steps in the user\'s units and never below one step', () => {
    expect(roundWeightKg(74.4, 'kg')).toBe(75)
    expect(roundWeightKg(1, 'kg')).toBe(2.5)
    const lb = roundWeightKg(60, 'lb') * 2.2046226218 // ~132 lb -> 130 or 135
    expect(Math.round(lb) % 5).toBe(0)
  })
})
