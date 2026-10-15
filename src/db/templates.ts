import type { ID } from './types'
import { importPackage } from './share'
import { SHARE_APP, SHARE_FORMAT, type SharePackage } from '../lib/share'
import { TEMPLATES, type Template } from '../data/templates'

/** The template as a share package, with names from `t` (they're stored as plain text, so translated when added). */
export function templatePackage(tpl: Template, t: (key: string) => string): SharePackage {
  const { program } = tpl
  return {
    app: SHARE_APP, format: SHARE_FORMAT, kind: 'program', exercises: [],
    routines: tpl.routines.map((r) => ({
      name: t(`templates.${tpl.id}.r.${r.key}`),
      exercises: r.exercises.map(([exerciseId, targetSets, repMin, repMax]) => ({ exerciseId, targetSets, repMin, repMax })),
    })),
    program: program.mode === 'rotation'
      ? { name: t(`templates.${tpl.id}.name`), weeks: 1, mode: 'rotation', rotation: program.rotation }
      : { name: t(`templates.${tpl.id}.name`), weeks: program.weeks, mode: 'weekday', schedule: program.schedule },
  }
}

/** Adds a template's routines and program as ordinary, deletable copies. The program isn't made active. */
export async function addTemplate(id: string, t: (key: string) => string, weekStartDay: number, now = new Date()): Promise<ID> {
  const tpl = TEMPLATES.find((x) => x.id === id)
  if (!tpl) throw new Error(`Unknown template ${id}`)
  return (await importPackage(templatePackage(tpl, t), weekStartDay, now)).id
}

/** Adds a single routine of a template, on its own and without a program. */
export async function addTemplateRoutine(id: string, key: string, t: (key: string) => string, weekStartDay: number): Promise<ID> {
  const tpl = TEMPLATES.find((x) => x.id === id)
  const index = tpl?.routines.findIndex((r) => r.key === key) ?? -1
  if (!tpl || index < 0) throw new Error(`Unknown template routine ${id}/${key}`)
  const { routines } = templatePackage(tpl, t)
  return (await importPackage({ app: SHARE_APP, format: SHARE_FORMAT, kind: 'routine', exercises: [], routines: [routines[index]] }, weekStartDay)).id
}
