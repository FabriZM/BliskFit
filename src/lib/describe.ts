import type { Exercise } from '../db/types'

type T = (key: string, opts?: Record<string, unknown>) => string

/**
 * One or two sentences about the exercise: the user's own description, or one built from its mechanic and
 * muscles (the seed dataset has none). `muscle` turns a muscle id into its display name.
 */
export function describeExercise(ex: Exercise, muscle: (id: string) => string, t: T, lang: string): string {
  if (ex.description?.trim()) return ex.description.trim()
  const list = (ids: string[]) =>
    new Intl.ListFormat(lang, { type: 'conjunction' }).format(ids.map((id) => muscle(id).toLocaleLowerCase(lang)))
  if (!ex.primaryMuscleIds.length) return ''
  const kind = ex.trackingType === 'cardio' ? 'aboutCardio'
    : ex.mechanic === 'compound' ? 'aboutCompound' : ex.mechanic === 'isolation' ? 'aboutIsolation' : 'about'
  const first = t(`exercises.${kind}`, { primary: list(ex.primaryMuscleIds) })
  return ex.secondaryMuscleIds.length ? `${first} ${t('exercises.aboutSecondary', { secondary: list(ex.secondaryMuscleIds) })}` : first
}
