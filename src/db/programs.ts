import { db } from './db'
import type { ID } from './types'

export async function getActiveProgramId(): Promise<ID | undefined> {
  return (await db.meta.get('activeProgramId'))?.value as ID | undefined
}
export async function setActiveProgramId(id: ID | undefined): Promise<void> {
  if (id) await db.meta.put({ key: 'activeProgramId', value: id })
  else await db.meta.delete('activeProgramId')
}
