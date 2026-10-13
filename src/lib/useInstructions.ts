import { useEffect, useState } from 'react'
import type { Exercise } from '../db/types'

type Steps = Record<string, string[]>

/** Translated how-to steps for seeded exercises, by language; loaded only when that language is in use. */
const LOADERS: Record<string, () => Promise<{ default: Steps }>> = {
  es: () => import('../data/seed-instructions-es.json'),
}

/**
 * The exercise's how-to steps in the app's language: a seeded exercise reads its translation when one exists,
 * otherwise (and for custom exercises, written by the user) the stored English steps.
 */
export function useInstructions(ex: Exercise | null | undefined, lang: string): string[] | undefined {
  const load = ex?.source === 'seeded' ? LOADERS[lang.slice(0, 2)] : undefined
  const [steps, setSteps] = useState<{ load: typeof load; map: Steps }>()
  useEffect(() => {
    if (!load) return
    let live = true
    void load().then((m) => { if (live) setSteps({ load, map: m.default }) })
    return () => { live = false }
  }, [load])
  const translated = ex && steps && steps.load === load ? steps.map[ex.id.replace(/^x:/, '')] : undefined
  return translated ?? ex?.instructions
}
