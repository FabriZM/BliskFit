import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { Exercise } from '../db/types'
import es from '../data/seed-names-es.json'

/** Translated names of the built-in (seeded) exercises, by language and dataset id. */
const NAMES: Record<string, Record<string, string>> = { es }

/**
 * The name to show: a built-in exercise in the app's language (its stored name, from the dataset, is English and
 * stays the fallback); a custom exercise exactly as the user typed it.
 */
export function exerciseName(ex: Pick<Exercise, 'id' | 'name'>, lang: string): string {
  return (ex.id.startsWith('x:') && NAMES[lang.slice(0, 2)]?.[ex.id.slice(2)]) || ex.name
}

/** exerciseName bound to the current language; missing exercises read as `fallback`. */
export function useExerciseName(): (ex: Pick<Exercise, 'id' | 'name'> | undefined, fallback?: string) => string {
  const lang = useTranslation().i18n.language
  return useCallback((ex, fallback = '…') => (ex ? exerciseName(ex, lang) : fallback), [lang])
}
