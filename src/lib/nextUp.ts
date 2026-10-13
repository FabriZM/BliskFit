import type { ID, SessionExercise, SetLog, TrackingType, Units } from '../db/types'
import { copyValues, isFilled, lastSetFor, valuesOf, workingIndexes, type LastTime, type SetValues } from './workout'

/** An exercise item's sets, in order. */
export function setsByItem(sets: SetLog[]): Map<ID, SetLog[]> {
  const m = new Map<ID, SetLog[]>()
  for (const s of sets) if (s.itemId) m.set(s.itemId, [...(m.get(s.itemId) ?? []), s])
  for (const list of m.values()) list.sort((a, b) => a.order - b.order)
  return m
}

/**
 * The set to do next. It continues where the last done set was (its exercise, or its superset's round: A1, B1,
 * A2…), then falls back to the first set not done, in plan order. Skipped exercises are left out.
 */
export function nextSet(items: SessionExercise[], sets: SetLog[]): SetLog | undefined {
  const byItem = setsByItem(sets)
  const live = items.filter((x) => !x.skipped)
  const groupOf = (it: SessionExercise) => (it.supersetGroup ? live.filter((x) => x.supersetGroup === it.supersetGroup) : [it])
  // The lowest set position not done across the group; ties go to the earlier exercise.
  const pick = (group: SessionExercise[]) => {
    let best: { set: SetLog; pos: number } | undefined
    for (const it of group) {
      const list = byItem.get(it.id) ?? []
      const pos = list.findIndex((s) => s.doneAt === undefined)
      if (pos >= 0 && (!best || pos < best.pos)) best = { set: list[pos], pos }
    }
    return best?.set
  }
  const lastDone = sets.filter((s) => s.doneAt !== undefined).sort((a, b) => b.doneAt! - a.doneAt!)[0]
  const current = live.find((x) => x.id === lastDone?.itemId)
  const here = current && pick(groupOf(current))
  if (here) return here
  for (const it of live) {
    const s = pick(groupOf(it))
    if (s) return s
  }
  return undefined
}

/** How a set is named: its number among working sets, or warm-up / drop. */
export type SetName = { kind: 'warmup' | 'drop' } | { kind: 'working'; n: number }

export function setName(set: SetLog, itemSets: SetLog[]): SetName {
  if (set.setType === 'warmup' || set.setType === 'drop') return { kind: set.setType }
  return { kind: 'working', n: workingIndexes(itemSets)[itemSets.findIndex((s) => s.id === set.id)] + 1 }
}

/**
 * What logging `set` without opening it would save: what was typed in it, else last time's matching set (the
 * "previous" column). Undefined when there is neither, so the user has to enter the values.
 */
export function valuesToLog(set: SetLog, itemSets: SetLog[], tracking: TrackingType, last: LastTime | undefined, appUnits: Units): SetValues | undefined {
  if (isFilled(set, tracking)) return valuesOf(set)
  const w = workingIndexes(itemSets)[itemSets.findIndex((s) => s.id === set.id)]
  const src = w >= 0 ? lastSetFor(last, w) : undefined
  return src && isFilled(src, tracking) ? copyValues(src, appUnits) : undefined
}
