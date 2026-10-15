import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { deleteProgram, getActiveProgramId, setActiveProgramId } from './programs'

describe('deleting a program', () => {
  beforeEach(async () => {
    await Promise.all([db.programs.clear(), db.meta.clear()])
    await db.programs.bulkAdd([
      { id: 'p1', name: 'One', mode: 'rotation', weeks: 1, rotation: [] },
      { id: 'p2', name: 'Two', mode: 'rotation', weeks: 1, rotation: [] },
    ])
  })

  it('removes the program and clears the active one when it was active', async () => {
    await setActiveProgramId('p1')
    await deleteProgram('p1')
    expect(await db.programs.get('p1')).toBeUndefined()
    expect(await getActiveProgramId()).toBeUndefined()
  })
  it('leaves the active program alone when another one is deleted', async () => {
    await setActiveProgramId('p1')
    await deleteProgram('p2')
    expect(await db.programs.count()).toBe(1)
    expect(await getActiveProgramId()).toBe('p1')
  })
})
