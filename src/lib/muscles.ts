import type { ID, MuscleGroup } from '../db/types'

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
