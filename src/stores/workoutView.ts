import { create } from 'zustand'

/**
 * Whether the running workout is minimized: the Workout tab then shows routines and programs (to check, edit or
 * share them) while the session keeps running, reachable from the in-progress bar. Not persisted: the app opens
 * on the workout itself.
 */
export const useWorkoutView = create<{ collapsed: boolean; setCollapsed: (v: boolean) => void }>((set) => ({
  collapsed: false,
  setCollapsed: (collapsed) => set({ collapsed }),
}))
