import type { SetLog, TrackingType, Units } from '../db/types'
import { formatNum, kgToDisplay } from './units'

/**
 * Compact one-line description of a logged set, e.g. "80×8", "+10×6", "45s", "30min 5km". Weights show as typed:
 * in the set's own unit, with the unit added when it isn't the app's (`units`), e.g. "100lb×8".
 */
export function formatSet(s: SetLog, t: TrackingType, units: Units): string {
  const unit = s.unit ?? units
  const w = (kg?: number) => formatNum(kgToDisplay(kg ?? 0, unit)) + (unit !== units ? unit : '')
  switch (t) {
    case 'weight_reps': return `${w(s.weight)}×${s.reps ?? 0}`
    case 'bodyweight_reps': return `${s.reps ?? 0}`
    case 'bodyweight_added': return `+${w(s.extraWeight)}×${s.reps ?? 0}`
    case 'assisted_bodyweight': return `−${w(s.extraWeight)}×${s.reps ?? 0}`
    case 'duration': return `${s.durationSec ?? 0}s`
    case 'cardio': return `${formatNum((s.durationSec ?? 0) / 60)}min${s.distanceM ? ` ${formatNum(s.distanceM / 1000)}km` : ''}`
  }
}
