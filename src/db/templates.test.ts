import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { deleteRoutine } from './routines'
import { addTemplate, templatePackage } from './templates'
import { TEMPLATES } from '../data/templates'
import { validatePackage } from '../lib/share'
import seed from '../data/seed-exercises.json'

const t = (k: string) => k
const seeded = new Set((seed as { id: string }[]).map((r) => `x:${r.id}`))

describe('starter templates', () => {
  beforeEach(async () => {
    await Promise.all([db.exercises.clear(), db.routines.clear(), db.programs.clear(), db.meta.clear()])
    await db.exercises.bulkAdd([...seeded].map((id) => ({ id, name: id, trackingType: 'weight_reps' as const, primaryMuscleIds: [], secondaryMuscleIds: [], source: 'seeded' as const })))
  })

  it('are valid packages that only use library exercises', () => {
    for (const tpl of TEMPLATES) {
      expect(() => validatePackage(templatePackage(tpl, t))).not.toThrow()
      for (const r of tpl.routines) for (const [id] of r.exercises) expect(seeded.has(id), `${tpl.id}: ${id}`).toBe(true)
    }
  })

  it('add every exercise, create an inactive program, and de-duplicate on a second add', async () => {
    for (const tpl of TEMPLATES) {
      const id = await addTemplate(tpl.id, t, 1)
      const program = await db.programs.get(id)
      expect(program?.name).toBe(`templates.${tpl.id}.name`)
      const used = program?.mode === 'rotation' ? program.rotation! : Object.values(program!.schedule!).flatMap((d) => Object.values(d))
      expect(used.length).toBeGreaterThan(0)
      const names = new Map((await db.routines.toArray()).map((r) => [r.id, r]))
      for (const rid of new Set(used)) {
        const spec = tpl.routines.find((r) => `templates.${tpl.id}.r.${r.key}` === names.get(rid)?.name)
        expect(names.get(rid)?.exercises.length, `${tpl.id} routine ${rid}`).toBe(spec?.exercises.length)
      }
    }
    expect(await db.meta.get('activeProgramId')).toBeUndefined()
    await addTemplate('ppl', t, 1)
    expect((await db.programs.toArray()).map((p) => p.name)).toContain('templates.ppl.name (2)')
  })

  it('leave a program usable after one of its routines is deleted', async () => {
    const id = await addTemplate('ppl', t, 1)
    const [rid] = (await db.programs.get(id))!.rotation!
    await deleteRoutine(rid)
    expect((await db.programs.get(id))?.rotation).toHaveLength(2)
  })
})
