import { create } from 'zustand'
import type { Routine } from '../db/types'

/**
 * The new routine being built, kept in memory so opening an exercise's page from it and coming back doesn't lose it.
 * Only restored when returning (`?draft=1`); starting a new routine always starts blank. Not persisted.
 */
export const useRoutineDraft = create<{ draft?: Routine; set: (r: Routine) => void; clear: () => void }>((set) => ({
  draft: undefined,
  set: (draft) => set({ draft }),
  clear: () => set({ draft: undefined }),
}))
