import { create } from 'zustand'
import { db } from '../db/db'
import { DEFAULT_SETTINGS, type Settings } from '../db/types'

interface SettingsState {
  settings: Settings
  loaded: boolean
  load: () => Promise<void>
  update: (patch: Partial<Omit<Settings, 'id'>>) => Promise<void>
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  load: async () => {
    const stored = await db.settings.get('settings')
    if (!stored) await db.settings.put(DEFAULT_SETTINGS)
    // Spread over defaults so settings added in later versions get a value.
    set({ settings: { ...DEFAULT_SETTINGS, ...stored }, loaded: true })
  },
  update: async (patch) => {
    const next = { ...get().settings, ...patch }
    set({ settings: next })
    await db.settings.put(next)
  },
}))
