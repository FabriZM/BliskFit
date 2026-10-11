export interface MuscleDef {
  slug: string
  parent?: string
}

/** Our own hierarchy. Leaf slugs match free-exercise-db names where they exist (see DATASET_MUSCLE). */
export const MUSCLES: MuscleDef[] = [
  { slug: 'chest' },
  { slug: 'back' },
  { slug: 'lats', parent: 'back' },
  { slug: 'middle-back', parent: 'back' },
  { slug: 'lower-back', parent: 'back' },
  { slug: 'traps', parent: 'back' },
  { slug: 'shoulders' },
  { slug: 'arms' },
  { slug: 'biceps', parent: 'arms' },
  { slug: 'triceps', parent: 'arms' },
  { slug: 'forearms', parent: 'arms' },
  { slug: 'legs' },
  { slug: 'quadriceps', parent: 'legs' },
  { slug: 'hamstrings', parent: 'legs' },
  { slug: 'glutes', parent: 'legs' },
  { slug: 'adductors', parent: 'legs' },
  { slug: 'abductors', parent: 'legs' },
  { slug: 'calves', parent: 'legs' },
  { slug: 'gastrocnemius', parent: 'calves' },
  { slug: 'soleus', parent: 'calves' },
  { slug: 'core' },
  { slug: 'abdominals', parent: 'core' },
  { slug: 'neck' },
]

export const DATASET_MUSCLE: Record<string, string> = {
  'lower back': 'lower-back',
  'middle back': 'middle-back',
}

export const muscleId = (slug: string) => `m:${slug}`
