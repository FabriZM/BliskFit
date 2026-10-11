import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type { ID } from './types'

export function useFavorites(): Set<ID> {
  const rows = useLiveQuery(() => db.favorites.toArray(), [])
  return new Set((rows ?? []).map((r) => r.exerciseId))
}

export async function toggleFavorite(exerciseId: ID): Promise<void> {
  if (await db.favorites.get(exerciseId)) await db.favorites.delete(exerciseId)
  else await db.favorites.put({ exerciseId })
}
