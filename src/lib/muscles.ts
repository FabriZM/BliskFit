import type { Exercise, ID, MuscleGroup, RoutineExercise } from '../db/types'
import type { MuscleText } from './exerciseFilter'

/** The muscle plus every descendant, so filtering by "Calves" also finds gastrocnemius-tagged exercises. */
export function withDescendants(muscles: MuscleGroup[], rootId: ID): Set<ID> {
  const result = new Set<ID>([rootId])
  let grew = true
  while (grew) {
    grew = false
    for (const m of muscles) {
      if (m.parentId && result.has(m.parentId) && !result.has(m.id)) {
        result.add(m.id)
        grew = true
      }
    }
  }
  return result
}

/** Display name: translated for seeded muscles (id `m:<slug>`), raw name for any custom one. */
export function muscleLabel(m: MuscleGroup, t: (k: string, o?: { defaultValue: string }) => string): string {
  return m.id.startsWith('m:') ? t(`muscles.${m.id.slice(2)}`, { defaultValue: m.name }) : m.name
}

/**
 * Text the exercise search matches against: the name of each muscle the exercise trains and of the groups above it
 * (so "legs" finds quadriceps work), in the app's language and as stored (English), so both "chest" and "pecho" work.
 */
export function muscleSearchText(muscles: MuscleGroup[], t: (k: string, o?: { defaultValue: string }) => string): MuscleText {
  const byId = new Map(muscles.map((m) => [m.id, m]))
  const names = new Map<ID, string>()
  const text = (id: ID): string => {
    if (!names.has(id)) {
      const m = byId.get(id)
      names.set(id, m ? `${muscleLabel(m, t)} ${m.name} ${m.parentId ? text(m.parentId) : ''}` : '')
    }
    return names.get(id)!
  }
  return (e: Exercise, scope) => [...e.primaryMuscleIds, ...(scope === 'all' ? e.secondaryMuscleIds : [])].map(text).join(' ')
}

/** Depth-first tree order (parent, then its children), siblings alphabetical by id, so indentation reads correctly. */
export function orderMuscles(muscles: MuscleGroup[]): MuscleGroup[] {
  const kids = new Map<string | undefined, MuscleGroup[]>()
  for (const m of muscles) kids.set(m.parentId, [...(kids.get(m.parentId) ?? []), m])
  const out: MuscleGroup[] = []
  const walk = (parent?: string) => {
    for (const m of (kids.get(parent) ?? []).sort((a, b) => a.name.localeCompare(b.name))) {
      out.push(m)
      walk(m.id)
    }
  }
  walk()
  return out
}

/**
 * The main muscle groups a routine trains, most sets first: each exercise's primary muscles count its target sets
 * and roll up to their top-level group (triceps -> Arms), so a routine reads "Chest, Shoulders, Arms".
 */
export function routineMuscles(items: Pick<RoutineExercise, 'exerciseId' | 'targetSets'>[], exercises: (Pick<Exercise, 'id' | 'primaryMuscleIds'> | undefined)[], muscles: MuscleGroup[], limit = 3): MuscleGroup[] {
  const byId = new Map(muscles.map((m) => [m.id, m]))
  const root = (id: ID): MuscleGroup | undefined => {
    let m = byId.get(id)
    for (let hops = 0; m?.parentId && byId.has(m.parentId) && hops < 10; hops++) m = byId.get(m.parentId)
    return m
  }
  const sets = new Map<ID, number>()
  items.forEach((item, i) => {
    for (const g of new Set((exercises[i]?.primaryMuscleIds ?? []).map((id) => root(id)?.id).filter((id): id is ID => !!id))) {
      sets.set(g, (sets.get(g) ?? 0) + item.targetSets)
    }
  })
  return [...sets].sort((a, b) => b[1] - a[1]).slice(0, limit).flatMap(([id]) => byId.get(id) ?? [])
}
