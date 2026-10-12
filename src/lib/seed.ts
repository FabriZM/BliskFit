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

/** v2: adds `mechanic` (compound/isolation). v3: adds `level` and how-to `instructions`. */
export const SEED_VERSION = 3

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

export function seedExercise(row: SeedRow): Exercise {
  return {
    id: `x:${row.id}`,
    name: row.n,
    trackingType: inferTrackingType(row),
    equipment: row.e ?? undefined,
    mechanic: row.m === 'compound' || row.m === 'isolation' ? row.m : undefined,
    level: LEVELS.find((l) => l === row.l),
    instructions: row.h?.length ? row.h : undefined,
    primaryMuscleIds: row.p.map((p) => muscleId(slug(p))),
    secondaryMuscleIds: row.s.map((p) => muscleId(slug(p))),
    demoUrl: row.i > 0 ? demoImageUrls(row.id, row.i)[0] : undefined,
    source: 'seeded',
  }
}
