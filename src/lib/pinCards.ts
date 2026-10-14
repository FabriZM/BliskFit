import type { BodyWeight, ExerciseMetric, Measurement, MuscleGroup, PinSpec, SetLog, StatsRange } from '../db/types'
import type { Units } from '../db/types'
import { BODY_FAT, measurementUnit } from './body'
import { cardKey } from './pins'
import {
  exerciseSeries, metricPoints, pointsInRange, rangeStart, rollUp, trend, weekSeries,
  type ExerciseLite, type Point, type SessionLite, type WeekBucket,
} from './stats'
import { formatClock, formatNum, kgToDisplay } from './units'
import { volumeFactor } from './plates'

/** What one stat card (in the Stats panel or pinned on Profile) plots. */
export type ValueUnit = 'weight' | 'reps' | 'sec' | 'm' | 'pace' | 'sessions' | 'sets' | 'cm' | 'pct'

export interface CardSeries {
  points: Point[]
  unit: ValueUnit
  lowerBetter?: boolean
  /** Smoothed line (body weight). */
  trend?: Point[]
}

export interface CardInput {
  sessions: SessionLite[]
  sets: SetLog[]
  exById: Map<string, ExerciseLite>
  muscles: Pick<MuscleGroup, 'id' | 'parentId'>[]
  buckets: Map<string, WeekBucket>
  bodyWeights: Pick<BodyWeight, 'date' | 'weight'>[]
  measurements: Pick<Measurement, 'date' | 'type' | 'value'>[]
}

export const metricUnit = (m: ExerciseMetric): ValueUnit => {
  switch (m) {
    case 'e1rm': case 'maxWeight': case 'volume': case 'minAssist': return 'weight'
    case 'reps': case 'bestReps': return 'reps'
    case 'bestDuration': case 'totalDuration': return 'sec'
    case 'distance': return 'm'
    case 'pace': return 'pace'
  }
}

export function pinSeries(pin: PinSpec, input: CardInput, weekStartDay: number, today: Date): CardSeries | undefined {
  const from = rangeStart(pin.range, today)
  switch (pin.kind) {
    case 'weekly':
      return { unit: 'sessions', points: weekSeries(input.buckets, weekStartDay, today, from).map((w) => ({ at: w.start.getTime(), value: w.sessions })) }
    case 'muscles':
      return {
        unit: 'sets',
        points: weekSeries(input.buckets, weekStartDay, today, from).map((w) => ({
          at: w.start.getTime(),
          value: pin.muscleId ? rollUp(w.muscle, input.muscles).get(pin.muscleId)?.sets ?? 0 : w.sets,
        })),
      }
    case 'exercise': {
      const ex = pin.exerciseId ? input.exById.get(pin.exerciseId) : undefined
      if (!ex || !pin.metric) return undefined
      const points = exerciseSeries(input.sets, input.sessions, ex.id, ex.trackingType, volumeFactor(ex))
      return { unit: metricUnit(pin.metric), lowerBetter: pin.metric === 'minAssist' || pin.metric === 'pace', points: metricPoints(points, pin.metric, from) }
    }
    case 'bodyweight': {
      const all = input.bodyWeights.map((b) => ({ at: b.date, value: b.weight }))
      const smooth = trend(all)
      return { unit: 'weight', points: pointsInRange(all, from), trend: pointsInRange(smooth, from) }
    }
    case 'measurement':
      return { unit: measurementUnit(pin.measurement ?? '') === '%' ? 'pct' : 'cm', lowerBetter: pin.measurement === BODY_FAT, points: pointsInRange(input.measurements.filter((m) => m.type === pin.measurement).map((m) => ({ at: m.date, value: m.value })), from) }
    case 'photo':
      return undefined
  }
}

/** Formats a value in the card's unit (weights follow the kg/lb setting). */
export function formatValue(v: number, unit: ValueUnit, units: Units): string {
  switch (unit) {
    case 'weight': return `${formatNum(kgToDisplay(v, units))} ${units}`
    case 'reps': return formatNum(v)
    case 'sets': return formatNum(Math.round(v * 10) / 10)
    case 'sessions': return String(Math.round(v))
    case 'sec': return formatClock(v * 1000)
    case 'm': return v >= 1000 ? `${formatNum(v / 1000)} km` : `${Math.round(v)} m`
    case 'pace': return `${formatClock(v * 1000)} /km`
    case 'cm': return `${formatNum(v)} cm`
    case 'pct': return `${formatNum(v)}%`
  }
}

/** Signed change text ("+2.5 kg"). */
export function formatDelta(d: number, unit: ValueUnit, units: Units): string {
  const sign = d > 0 ? '+' : d < 0 ? '−' : ''
  return sign + formatValue(Math.abs(d), unit, units)
}

/** DOM id of a card, so Profile can open the panel scrolled to it. */
export const cardId = (p: PinSpec): string => 'card-' + cardKey(p).replace(/[^\w|:-]/g, '_')

export const sectionOf = (p: PinSpec): 'overview' | 'exercises' | 'muscles' | 'body' =>
  p.kind === 'weekly' ? 'overview' : p.kind === 'exercise' ? 'exercises' : p.kind === 'muscles' ? 'muscles' : 'body'

/** Link that opens the Stats panel on this card with the pin's range. */
export function statsLink(p: PinSpec): string {
  const q = new URLSearchParams({ s: sectionOf(p), r: p.range, card: cardId(p) })
  if (p.exerciseId) q.set('ex', p.exerciseId)
  return `/profile/stats?${q}`
}

export type { StatsRange }
