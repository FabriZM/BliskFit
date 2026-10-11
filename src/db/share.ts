import { db, newId } from './db'
import type { Exercise, ID, Program, Routine } from './types'
import { packProgram, packRoutine, type SharePackage } from '../lib/share'
import { normalizeGroups } from '../lib/routines'
import { weekStart } from '../lib/programs'

const exerciseMap = async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e]))

export async function packRoutineById(id: ID): Promise<SharePackage | undefined> {
  const r = await db.routines.get(id)
  return r && packRoutine(r, await exerciseMap())
}

export async function packProgramById(id: ID): Promise<SharePackage | undefined> {
  const p = await db.programs.get(id)
  if (!p) return undefined
  return packProgram(p, new Map((await db.routines.toArray()).map((r) => [r.id, r])), await exerciseMap())
}

/** "Push", or "Push (2)" if you already have a "Push", so the copies are told apart in pickers. Marks it taken. */
export function freeName(name: string, taken: Set<string>): string {
  let out = name
  for (let n = 2; taken.has(out); n++) out = `${name} (${n})`
  taken.add(out)
  return out
}

export interface ImportPreview {
  /** Custom exercises this phone doesn't have yet; they get created. */
  newExercises: string[]
  /** Exercises that can't be resolved (a library exercise this app version lacks); left out of the routines. */
  missing: number
}

export async function previewImport(p: SharePackage): Promise<ImportPreview> {
  const shared = new Map(p.exercises.map((e) => [e.id, e]))
  const ids = [...new Set(p.routines.flatMap((r) => r.exercises.map((e) => e.exerciseId)))]
  const have = new Set((await db.exercises.bulkGet(ids)).flatMap((e) => (e ? [e.id] : [])))
  const unknown = ids.filter((id) => !have.has(id))
  return {
    newExercises: unknown.flatMap((id) => { const e = shared.get(id); return e ? [e.name] : [] }),
    missing: unknown.filter((id) => !shared.has(id)).length,
  }
}

/**
 * Adds the package as new routines (and program), never touching existing ones. Custom exercises keep the
 * sender's id, so adding a second routine that uses them doesn't create duplicates. A program isn't made active
 * and starts this week. Returns where to go next.
 */
export async function importPackage(p: SharePackage, weekStartDay: number, now = new Date()): Promise<{ kind: 'routine' | 'program'; id: ID }> {
  return db.transaction('rw', db.exercises, db.routines, db.programs, async () => {
    const shared = new Map(p.exercises.map((e) => [e.id, e]))
    const ids = [...new Set(p.routines.flatMap((r) => r.exercises.map((e) => e.exerciseId)))]
    const have = new Set((await db.exercises.bulkGet(ids)).flatMap((e) => (e ? [e.id] : [])))
    const created: Exercise[] = ids.flatMap((id) => {
      const e = shared.get(id)
      return !have.has(id) && e ? [{ ...e, source: 'custom' as const }] : []
    })
    await db.exercises.bulkAdd(created)
    const known = new Set([...have, ...created.map((e) => e.id)])

    const taken = new Set((await db.routines.toArray()).map((r) => r.name))
    const routines: Routine[] = p.routines.map((r) => ({
      id: newId(),
      name: freeName(r.name.trim() || 'Routine', taken),
      archived: false,
      exercises: normalizeGroups(r.exercises.filter((e) => known.has(e.exerciseId)).map((e) => ({ ...e, id: newId() }))),
    }))
    await db.routines.bulkAdd(routines)
    if (p.kind === 'routine' || !p.program) return { kind: 'routine' as const, id: routines[0].id }

    const sp = p.program
    const programNames = new Set((await db.programs.toArray()).map((x) => x.name))
    const program: Program = { id: newId(), name: freeName(sp.name.trim() || 'Program', programNames), weeks: sp.weeks, mode: sp.mode }
    if (sp.mode === 'rotation') program.rotation = [...new Set((sp.rotation ?? []).map((i) => routines[i].id))]
    else {
      program.startDate = weekStart(now, weekStartDay).getTime()
      program.schedule = {}
      for (let w = 0; w < sp.weeks; w++) {
        program.schedule[w] = Object.fromEntries(Object.entries(sp.schedule?.[w] ?? {}).map(([d, i]) => [Number(d), routines[i].id]))
      }
    }
    await db.programs.add(program)
    return { kind: 'program' as const, id: program.id }
  })
}
