import type { Exercise, StatsRange, Units } from '../../db/types'
import type { Derived, StatsData } from '../../db/stats'
import type { CardInput } from '../../lib/pinCards'

/** Shared inputs of every Stats panel section. */
export interface StatsCtx {
  data: StatsData
  derived: Derived
  range: StatsRange
  from?: Date
  today: Date
  weekStartDay: number
  units: Units
  input: CardInput
  exById: Map<string, Exercise>
}
