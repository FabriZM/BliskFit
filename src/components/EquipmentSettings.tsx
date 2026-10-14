import { useTranslation } from 'react-i18next'
import { db } from '../db/db'
import { setExerciseUnit } from '../db/equipment'
import type { Exercise, Units } from '../db/types'
import { barWeight, isPlateLoaded, pairedWeights, usesWeight, weightUnitFor } from '../lib/plates'
import { displayToKg, formatNum } from '../lib/units'
import { useSettings } from '../stores/settings'
import DecimalInput from './DecimalInput'

/**
 * Per-exercise equipment: the unit printed on it (the default for new sets; each set keeps the unit it was typed
 * in) and, for bars and plate-loaded machines, the bar weight. Saved straight onto the exercise (seeded ones too,
 * like the rest time). Also whether the weight is per dumbbell with two lifted, which doubles it for volume.
 */
export default function EquipmentSettings({ exercise }: { exercise: Exercise }) {
  const { t } = useTranslation()
  const appUnits = useSettings((s) => s.settings.units)
  if (!usesWeight(exercise.trackingType)) return null
  const unit = weightUnitFor(exercise, appUnits)
  const plates = isPlateLoaded(exercise)
  const save = (patch: Partial<Exercise>) => db.exercises.update(exercise.id, patch)
  // Bar weight shown as typed in the exercise's unit; empty = the usual bar for the equipment.
  const defaultBar = barWeight({ equipment: exercise.equipment }, unit)

  return (
    <div className="form equipment">
      <label>{t('equipmentSettings.unit')}
        <select value={exercise.weightUnit ?? ''} onChange={(e) => void setExerciseUnit(exercise.id, (e.target.value || undefined) as Units | undefined, appUnits)}>
          <option value="">{t('equipmentSettings.unitDefault', { units: appUnits })}</option>
          <option value="kg">kg</option>
          <option value="lb">lb</option>
        </select>
      </label>
      {exercise.trackingType === 'weight_reps' && (
        <label className="inline">
          <input type="checkbox" checked={pairedWeights(exercise)} onChange={(e) => void save({ pairedWeights: e.target.checked })} />
          {t('equipmentSettings.paired')}
        </label>
      )}
      {exercise.trackingType === 'weight_reps' && (
        <label className="inline">
          <input type="checkbox" checked={plates} onChange={(e) => void save({ plateLoaded: e.target.checked })} />
          {t('equipmentSettings.plateLoaded')}
        </label>
      )}
      {plates && (
        <label>{t('equipmentSettings.bar', { unit })}
          <span className="row">
            <DecimalInput label={t('equipmentSettings.bar', { unit })} placeholder={formatNum(defaultBar)}
              value={exercise.barKg === undefined ? undefined : barWeight(exercise, unit)}
              onCommit={(v) => void save({ barKg: v === undefined ? undefined : displayToKg(v, unit) })} />
          </span>
        </label>
      )}
      <p className="muted small">{plates ? t('equipmentSettings.hintPlates') : t('equipmentSettings.hint')}</p>
    </div>
  )
}
