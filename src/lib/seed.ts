import type { Exercise, MuscleGroup, TrackingType } from '../db/types'
import { DATASET_MUSCLE, MUSCLES, muscleId } from '../data/muscles'

export interface SeedRow {
  id: string
  n: string
  c: string
  e: string | null
  m?: string | null
  l?: string
  p: string[]
  s: string[]
  i: number
  /** How-to steps. */
  h?: string[]
}

/** v2: adds `mechanic` (compound/isolation). v3: adds `level` and how-to `instructions`. v4: shoulders split into delts, obliques added. */
export const SEED_VERSION = 4

const LEVELS = ['beginner', 'intermediate', 'expert'] as const

const DURATION_NAMES = /\b(plank|wall sit|hold|hang)\b/i

export function inferTrackingType(row: Pick<SeedRow, 'n' | 'c' | 'e'>): TrackingType {
  if (row.c === 'cardio') return 'cardio'
  if (row.c === 'stretching' || DURATION_NAMES.test(row.n)) return 'duration'
  if (/assisted/i.test(row.n)) return 'assisted_bodyweight'
  if (row.e === 'body only') return /weighted/i.test(row.n) ? 'bodyweight_added' : 'bodyweight_reps'
  if (/^weighted\b/i.test(row.n) && /pull|chin|dip/i.test(row.n)) return 'bodyweight_added'
  return 'weight_reps'
}

const slug = (dataset: string) => DATASET_MUSCLE[dataset] ?? dataset

export function seedMuscles(): MuscleGroup[] {
  return MUSCLES.map((m) => ({
    id: muscleId(m.slug),
    name: m.slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()),
    parentId: m.parent ? muscleId(m.parent) : undefined,
  }))
}

export function demoImageUrls(seedId: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/${seedId}/${i}.jpg`)
}

const REAR_DELT = /\b(rear|reverse (machine )?fl(y|ye)s?|face pull|pull apart|bent.?over|back flyes|sled reverse)\b/i
const SIDE_DELT = /\b(lateral|laterals|side raise|upright row|raise to the side)\b/i
const FRONT_DELT = /\b(front|deltoid raise|shoulder raise|dumbbell raise|incline raise|scaption|straight raises)\b/i
const PRESS = /\b(press|jerk|thruster|snatch|clean|push-?ups?|dips?)\b/i
const PULL = /\b(row|pull|curl|chin)/i
const OBLIQUE = /\b(oblique|twist|side bend|wood ?chop|side jackknife|side bridge|windshield|russian|pallof|suitcase)/i

/**
 * The dataset only knows "shoulders" and "abdominals". The finer muscles are guessed from the exercise name: raises
 * and rows say which delt; presses hit front and side; anything unclear keeps all three (as before the split). A
 * twist, side bend or side plank also works the obliques.
 */
export function refineMuscles(name: string, muscles: string[], role: 'primary' | 'secondary'): string[] {
  const out = muscles.flatMap((m) => {
    if (m !== 'shoulders') return [m]
    if (REAR_DELT.test(name)) return ['rear-delts']
    const found = [FRONT_DELT.test(name) && 'front-delts', SIDE_DELT.test(name) && 'side-delts'].filter((x): x is string => !!x)
    if (found.length) return found
    if (PRESS.test(name)) return role === 'primary' ? ['front-delts', 'side-delts'] : ['front-delts']
    if (role === 'secondary') return [PULL.test(name) ? 'rear-delts' : 'front-delts']
    return ['front-delts', 'side-delts', 'rear-delts']
  })
  if (OBLIQUE.test(name) && out.includes('abdominals') && !out.includes('obliques')) out.push('obliques')
  return [...new Set(out)]
}

export function seedExercise(row: SeedRow): Exercise {
  return {
    id: `x:${row.id}`,
    name: row.n,
    trackingType: inferTrackingType(row),
    equipment: row.e ?? undefined,
    mechanic: row.m === 'compound' || row.m === 'isolation' ? row.m : undefined,
    level: LEVELS.find((l) => l === row.l),
    instructions: row.h?.length ? row.h : undefined,
    primaryMuscleIds: refineMuscles(row.n, row.p.map(slug), 'primary').map(muscleId),
    secondaryMuscleIds: refineMuscles(row.n, row.s.map(slug), 'secondary').map(muscleId),
    demoUrl: row.i > 0 ? demoImageUrls(row.id, row.i)[0] : undefined,
    source: 'seeded',
  }
}
