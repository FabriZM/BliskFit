import { db } from './db'
import type { ID } from './types'

export async function getActiveProgramId(): Promise<ID | undefined> {
  return (await db.meta.get('activeProgramId'))?.value as ID | undefined
}
export async function setActiveProgramId(id: ID | undefined): Promise<void> {
  if (id) await db.meta.put({ key: 'activeProgramId', value: id })
  else await db.meta.delete('activeProgramId')
}

/** Deletes a program (its routines stay) and clears the active program if it was this one. */
export async function deleteProgram(id: ID): Promise<void> {
  await db.transaction('rw', db.programs, db.meta, async () => {
    if ((await getActiveProgramId()) === id) await setActiveProgramId(undefined)
    await db.programs.delete(id)
  })
}
