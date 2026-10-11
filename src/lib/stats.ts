import type { Exercise, ExerciseMetric, ID, MuscleGroup, SetLog, StatsRange, TrackingType, WorkoutSession } from '../db/types'
import { dateKey } from './goals'
import { epley } from './prs'
import { weekStart } from './programs'

/**
 * Stats are derived from finished sessions and their completed non-warm-up sets; nothing aggregated is stored,
 * so edits and deletes in History flow straight through (same approach as goals, PRs and gym visits).
 */

export type SessionLite = Pick<WorkoutSession, 'id' | 'startedAt' | 'status' | 'gymId'>
export type ExerciseLite = Pick<Exercise, 'id' | 'trackingType' | 'primaryMuscleIds' | 'secondaryMuscleIds'>
export interface Point { at: number; value: number }

export const RANGES: StatsRange[] = ['4w', '3m', '6m', '1y', 'all']

/** First day included in the range (local midnight); undefined = from the beginning. */
export function rangeStart(range: StatsRange, today: Date): Date | undefined {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  switch (range) {
    case '4w': d.setDate(d.getDate() - 27); return d
    case '3m': d.setMonth(d.getMonth() - 3); return d
    case '6m': d.setMonth(d.getMonth() - 6); return d
    case '1y': d.setFullYear(d.getFullYear() - 1); return d
    case 'all': return undefined
  }
}

const inRange = (at: number, from?: Date) => from === undefined || at >= from.getTime()
export const isWorkingSet = (s: SetLog): boolean => s.doneAt !== undefined && s.setType !== 'warmup'

const finishedStart = (sessions: SessionLite[]): Map<ID, number> =>
  new Map(sessions.filter((s) => s.status === 'finished').map((s) => [s.id, s.startedAt]))

// ---- per-exercise series ---------------------------------------------------------------------------

export type MetricValues = Partial<Record<ExerciseMetric, number>>
export interface ExercisePoint { sessionId: ID; at: number; values: MetricValues }

/** Charts that make sense for each tracking type; the first is the default. */
export function metricsFor(t: TrackingType): ExerciseMetric[] {
  switch (t) {
    case 'weight_reps':
    case 'bodyweight_added': return ['e1rm', 'maxWeight', 'volume', 'reps']
    case 'bodyweight_reps': return ['bestReps', 'reps']
    case 'assisted_bodyweight': return ['minAssist', 'reps']
    case 'duration': return ['bestDuration', 'totalDuration']
    case 'cardio': return ['totalDuration', 'distance', 'pace']
  }
}

/** Assistance and pace improve by going down. */
export const lowerIsBetter = (m: ExerciseMetric): boolean => m === 'minAssist' || m === 'pace'

/** True when `a` is an improvement over `b` for the metric. */
export const isBetter = (m: ExerciseMetric, a: number, b: number): boolean => (lowerIsBetter(m) ? a < b - 1e-6 : a > b + 1e-6)

function sessionValues(sets: SetLog[], t: TrackingType): MetricValues | undefined {
  const sum = (f: (s: SetLog) => number) => sets.reduce((a, s) => a + f(s), 0)
  const reps = (s: SetLog) => s.reps ?? 0
  switch (t) {
    case 'weight_reps':
    case 'bodyweight_added': {
      const load = (s: SetLog) => (t === 'weight_reps' ? s.weight : s.extraWeight ?? 0)
      const valid = sets.filter((s) => load(s) !== undefined && reps(s) >= 1)
      if (!valid.length) return undefined
      return {
        maxWeight: Math.max(...valid.map((s) => load(s)!)),
        e1rm: Math.max(...valid.map((s) => epley(load(s)!, reps(s)))),
        volume: valid.reduce((a, s) => a + load(s)! * reps(s), 0),
        reps: valid.reduce((a, s) => a + reps(s), 0),
      }
    }
    case 'bodyweight_reps': {
      const valid = sets.filter((s) => reps(s) >= 1)
      return valid.length ? { bestReps: Math.max(...valid.map(reps)), reps: valid.reduce((a, s) => a + reps(s), 0) } : undefined
    }
    case 'assisted_bodyweight': {
      const valid = sets.filter((s) => reps(s) >= 1)
      return valid.length ? { minAssist: Math.min(...valid.map((s) => s.extraWeight ?? 0)), reps: valid.reduce((a, s) => a + reps(s), 0) } : undefined
    }
    case 'duration': {
      const valid = sets.filter((s) => (s.durationSec ?? 0) >= 1)
      return valid.length ? { bestDuration: Math.max(...valid.map((s) => s.durationSec!)), totalDuration: sum((s) => s.durationSec ?? 0) } : undefined
    }
    case 'cardio': {
      const valid = sets.filter((s) => (s.durationSec ?? 0) >= 1 || (s.distanceM ?? 0) > 0)
      if (!valid.length) return undefined
      const dur = sum((s) => s.durationSec ?? 0), dist = sum((s) => s.distanceM ?? 0)
      return {
        ...(dur > 0 ? { totalDuration: dur } : {}),
        ...(dist > 0 ? { distance: dist } : {}),
        ...(dur > 0 && dist > 0 ? { pace: dur / (dist / 1000) } : {}),
      }
    }
  }
}

/** One point per finished session in which the exercise was done, oldest first. `sets` may hold other exercises. */
export function exerciseSeries(sets: SetLog[], sessions: SessionLite[], exerciseId: ID, tracking: TrackingType): ExercisePoint[] {
  const starts = finishedStart(sessions)
  const bySession = new Map<ID, SetLog[]>()
  for (const s of sets) {
    if (s.exerciseId !== exerciseId || !isWorkingSet(s) || !starts.has(s.sessionId)) continue
    bySession.set(s.sessionId, [...(bySession.get(s.sessionId) ?? []), s])
  }
  const out: ExercisePoint[] = []
  for (const [sessionId, list] of bySession) {
    const values = sessionValues(list, tracking)
    if (values) out.push({ sessionId, at: starts.get(sessionId)!, values })
  }
  return out.sort((a, b) => a.at - b.at)
}

export function metricPoints(points: ExercisePoint[], metric: ExerciseMetric, from?: Date): Point[] {
  return points.flatMap((p) => (p.values[metric] !== undefined && inRange(p.at, from) ? [{ at: p.at, value: p.values[metric]! }] : []))
}

const WEEK_MS = 7 * 86_400_000

/**
 * Plateau: the best value of the last `n` sessions (at least 3) hasn't improved on everything before them, and
 * those sessions span at least 3 weeks. With no earlier sessions the window's first session is the baseline.
 * Fewer than `n` sessions is never a plateau.
 */
export function isPlateau(points: ExercisePoint[], metric: ExerciseMetric, n = 5): boolean {
  const window = Math.max(3, n)
  const pts = metricPoints(points, metric)
  if (pts.length < window) return false
  const recent = pts.slice(-window)
  if (recent[recent.length - 1].at - recent[0].at < 3 * WEEK_MS) return false
  const prior = pts.slice(0, -window)
  const baseline = prior.length ? prior.reduce((b, p) => (isBetter(metric, p.value, b) ? p.value : b), prior[0].value) : recent[0].value
  const candidates = prior.length ? recent : recent.slice(1)
  return !candidates.some((p) => isBetter(metric, p.value, baseline))
}

// ---- weekly buckets, muscle credit ----------------------------------------------------------------

/** Share of a set credited to a muscle: primary muscles in full, secondary ones partially. */
export const SECONDARY_CREDIT = 0.5

export function muscleCredit(ex: Pick<Exercise, 'primaryMuscleIds' | 'secondaryMuscleIds'>): Map<ID, number> {
  const out = new Map<ID, number>()
  for (const id of ex.secondaryMuscleIds) out.set(id, SECONDARY_CREDIT)
  for (const id of ex.primaryMuscleIds) out.set(id, 1)
  return out
}

/** Load x reps for weighted lifts; bodyweight-only, timed and cardio sets carry no volume. */
export function setVolume(s: SetLog, t: TrackingType): number {
  if (t === 'weight_reps') return (s.weight ?? 0) * (s.reps ?? 0)
  if (t === 'bodyweight_added') return (s.extraWeight ?? 0) * (s.reps ?? 0)
  return 0
}

export interface Credit { sets: number; volume: number }
export interface WeekBucket {
  key: string
  start: Date
  sessions: number
  sets: number
  volume: number
  prs: number
  /** Credit per muscle exactly as tagged on the exercises (not rolled up to parent groups). */
  muscle: Map<ID, Credit>
}

const emptyBucket = (start: Date): WeekBucket => ({ key: dateKey(start), start, sessions: 0, sets: 0, volume: 0, prs: 0, muscle: new Map() })

function addCredit(map: Map<ID, Credit>, id: ID, sets: number, volume: number) {
  const c = map.get(id) ?? { sets: 0, volume: 0 }
  map.set(id, { sets: c.sets + sets, volume: c.volume + volume })
}

/** Finished sessions and their working sets grouped by the week the session started in. `prSetIds` marks PR sets. */
export function weekBuckets(
  sessions: SessionLite[], sets: SetLog[], exById: Map<ID, ExerciseLite>, weekStartDay: number, prSetIds: Set<ID> = new Set(),
): Map<string, WeekBucket> {
  const out = new Map<string, WeekBucket>()
  const sessionWeek = new Map<ID, WeekBucket>()
  const bucketFor = (at: number) => {
    const start = weekStart(new Date(at), weekStartDay)
    const key = dateKey(start)
    let b = out.get(key)
    if (!b) out.set(key, (b = emptyBucket(start)))
    return b
  }
  for (const s of sessions) {
    if (s.status !== 'finished') continue
    const b = bucketFor(s.startedAt)
    b.sessions++
    sessionWeek.set(s.id, b)
  }
  for (const s of sets) {
    const b = sessionWeek.get(s.sessionId)
    const ex = exById.get(s.exerciseId)
    if (!b || !ex || !isWorkingSet(s)) continue
    const vol = setVolume(s, ex.trackingType)
    b.sets++
    b.volume += vol
    if (prSetIds.has(s.id)) b.prs++
    for (const [m, share] of muscleCredit(ex)) addCredit(b.muscle, m, share, vol * share)
  }
  return out
}

/** Consecutive weeks from the range start (or the first week with data) to the current week; empty weeks included. */
export function weekSeries(buckets: Map<string, WeekBucket>, weekStartDay: number, today: Date, from?: Date): WeekBucket[] {
  const thisWeek = weekStart(today, weekStartDay)
  let first = from ? weekStart(from, weekStartDay) : thisWeek
  if (!from) for (const b of buckets.values()) if (b.start < first) first = b.start
  const out: WeekBucket[] = []
  for (let c = first; c <= thisWeek; c = new Date(c.getFullYear(), c.getMonth(), c.getDate() + 7)) {
    out.push(buckets.get(dateKey(c)) ?? emptyBucket(c))
  }
  return out
}

/** Credit per muscle summed over some weeks. */
export function sumMuscles(weeks: WeekBucket[]): Map<ID, Credit> {
  const out = new Map<ID, Credit>()
  for (const w of weeks) for (const [m, c] of w.muscle) addCredit(out, m, c.sets, c.volume)
  return out
}

/** Adds every muscle's credit to all its ancestors too, so a group's total includes its muscles. */
export function rollUp(direct: Map<ID, Credit>, muscles: Pick<MuscleGroup, 'id' | 'parentId'>[]): Map<ID, Credit> {
  const parent = new Map(muscles.map((m) => [m.id, m.parentId]))
  const out = new Map<ID, Credit>()
  for (const [id, c] of direct) {
    let cur: ID | undefined = id
    for (let guard = 0; cur !== undefined && guard < 10; guard++) {
      addCredit(out, cur, c.sets, c.volume)
      cur = parent.get(cur)
    }
  }
  return out
}

/** Muscles that ignore the weekly-sets target (rarely trained on purpose). */
export const TARGET_EXEMPT = new Set(['m:neck'])

export interface UnderTrained { muscleId: ID; perWeek: number }

/** Top-level groups whose average weekly sets over `weeks` weeks are below `target`, least trained first. */
export function underTrained(totals: Map<ID, Credit>, muscles: Pick<MuscleGroup, 'id' | 'parentId'>[], weeks: number, target: number): UnderTrained[] {
  const w = Math.max(1, weeks)
  return muscles
    .filter((m) => !m.parentId && !TARGET_EXEMPT.has(m.id))
    .map((m) => ({ muscleId: m.id, perWeek: (totals.get(m.id)?.sets ?? 0) / w }))
    .filter((r) => r.perWeek < target)
    .sort((a, b) => a.perWeek - b.perWeek || a.muscleId.localeCompare(b.muscleId))
}

export const PUSH_MUSCLES = ['m:chest', 'm:shoulders', 'm:triceps']
export const PULL_MUSCLES = ['m:back', 'm:biceps']

/** Push/pull sets from the muscle groups worked (not exercise names); an exercise hitting both counts for both. */
export function pushPull(direct: Map<ID, Credit>, muscles: Pick<MuscleGroup, 'id' | 'parentId'>[]): { push: number; pull: number } {
  const parent = new Map(muscles.map((m) => [m.id, m.parentId]))
  let push = 0, pull = 0
  for (const [id, c] of direct) {
    const chain = new Set<ID>()
    for (let cur: ID | undefined = id, guard = 0; cur !== undefined && guard < 10; guard++) { chain.add(cur); cur = parent.get(cur) }
    if (PUSH_MUSCLES.some((m) => chain.has(m))) push += c.sets
    if (PULL_MUSCLES.some((m) => chain.has(m))) pull += c.sets
  }
  return { push, pull }
}

// ---- body trends -----------------------------------------------------------------------------------

/** Exponential moving average, one smoothed value per input point (oldest first), so one odd weigh-in barely moves it. */
export function trend(points: Point[], alpha = 0.2): Point[] {
  const out: Point[] = []
  let cur: number | undefined
  for (const p of [...points].sort((a, b) => a.at - b.at)) {
    cur = cur === undefined ? p.value : cur + alpha * (p.value - cur)
    out.push({ at: p.at, value: cur })
  }
  return out
}

export interface Change { first: number; last: number; delta: number }

/** Change between the first and last point of a series (undefined when empty). */
export function changeOver(points: Point[]): Change | undefined {
  if (!points.length) return undefined
  const first = points[0].value, last = points[points.length - 1].value
  return { first, last, delta: last - first }
}

export const pointsInRange = (points: Point[], from?: Date): Point[] => points.filter((p) => inRange(p.at, from)).sort((a, b) => a.at - b.at)

// ---- gyms --------------------------------------------------------------------------------------------

export interface GymExerciseStats { gymId: ID; sessions: number; bestSet?: SetLog; bestE1rm?: number; avgVolume: number }

/** Gyms that have at least one finished session. */
export const gymsUsed = (sessions: SessionLite[]): ID[] =>
  [...new Set(sessions.filter((s) => s.status === 'finished' && s.gymId).map((s) => s.gymId!))]

/** How one exercise has gone at each gym (sessions without a gym are left out). Best set = highest estimated 1RM. */
export function gymComparison(sets: SetLog[], sessions: SessionLite[], exerciseId: ID, tracking: TrackingType): GymExerciseStats[] {
  const gymOf = new Map(sessions.filter((s) => s.status === 'finished' && s.gymId).map((s) => [s.id, s.gymId!]))
  const byGym = new Map<ID, { sessions: Map<ID, SetLog[]> }>()
  for (const s of sets) {
    const gym = gymOf.get(s.sessionId)
    if (!gym || s.exerciseId !== exerciseId || !isWorkingSet(s)) continue
    const g = byGym.get(gym) ?? { sessions: new Map() }
    g.sessions.set(s.sessionId, [...(g.sessions.get(s.sessionId) ?? []), s])
    byGym.set(gym, g)
  }
  const score = (s: SetLog): number => {
    if (tracking === 'weight_reps') return epley(s.weight ?? 0, s.reps ?? 0)
    if (tracking === 'bodyweight_added') return epley(s.extraWeight ?? 0, s.reps ?? 0)
    if (tracking === 'assisted_bodyweight') return -(s.extraWeight ?? 0) * 1000 + (s.reps ?? 0)
    if (tracking === 'duration') return s.durationSec ?? 0
    if (tracking === 'cardio') return s.distanceM ?? s.durationSec ?? 0
    return s.reps ?? 0
  }
  return [...byGym].map(([gymId, g]) => {
    const all = [...g.sessions.values()].flat()
    const best = all.reduce<SetLog | undefined>((b, s) => (!b || score(s) > score(b) ? s : b), undefined)
    const volumes = [...g.sessions.values()].map((l) => l.reduce((a, s) => a + setVolume(s, tracking), 0))
    return {
      gymId, sessions: g.sessions.size, bestSet: best,
      bestE1rm: tracking === 'weight_reps' || tracking === 'bodyweight_added' ? best && score(best) : undefined,
      avgVolume: volumes.reduce((a, v) => a + v, 0) / Math.max(1, volumes.length),
    }
  }).sort((a, b) => b.sessions - a.sessions || a.gymId.localeCompare(b.gymId))
}

/** Exercises done (working sets) in finished sessions at two or more gyms. */
export function exercisesAtSeveralGyms(sets: SetLog[], sessions: SessionLite[]): Set<ID> {
  const gymOf = new Map(sessions.filter((s) => s.status === 'finished' && s.gymId).map((s) => [s.id, s.gymId!]))
  const gyms = new Map<ID, Set<ID>>()
  for (const s of sets) {
    const g = gymOf.get(s.sessionId)
    if (!g || !isWorkingSet(s)) continue
    gyms.set(s.exerciseId, (gyms.get(s.exerciseId) ?? new Set()).add(g))
  }
  return new Set([...gyms].filter(([, g]) => g.size >= 2).map(([id]) => id))
}
