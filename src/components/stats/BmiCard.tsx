import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ageOn } from '../../lib/body'
import { bmi, bmiCategory, suggestGoal } from '../../lib/bmi'
import { pointsInRange } from '../../lib/stats'
import { formatNum, kgToDisplay } from '../../lib/units'
import { useSettings } from '../../stores/settings'
import type { StatsCtx } from '../../pages/stats/ctx'
import LineChart from './LineChart'

/**
 * BMI from the latest body weight and the height in Profile settings, its band, the BMI at the goal weight, and a
 * suggested goal when the BMI is outside the healthy range. BMI is an adult measure, so it isn't shown under 18.
 */
export default function BmiCard({ ctx }: { ctx: StatsCtx }) {
  const { t } = useTranslation()
  const { heightCm, goalWeightKg, birthDate } = useSettings((s) => s.settings)
  const { units, data, from, today } = ctx
  const latest = data.bodyWeights[data.bodyWeights.length - 1]
  if (!latest) return null
  if (!heightCm) return <div className="card muted small">{t('bmi.needHeight')} <Link to="/profile/settings">{t('bmi.openSettings')}</Link></div>
  const age = ageOn(birthDate, today)
  if (age !== undefined && age < 18) return <div className="card muted small">{t('bmi.adultsOnly')}</div>

  const now = bmi(latest.weight, heightCm)!
  const goal = bmi(goalWeightKg, heightCm)
  const suggestion = goalWeightKg === undefined ? suggestGoal(latest.weight, heightCm) : undefined
  const points = pointsInRange(data.bodyWeights.map((w) => ({ at: w.date, value: bmi(w.weight, heightCm)! })), from)
  const w = (kg: number) => `${formatNum(kgToDisplay(kg, units))} ${units}`

  return (
    <div className="card bmi-card">
      <h3>{t('bmi.title')}</h3>
      <p className="bmi-now"><strong>{formatNum(now)}</strong> <span className={`bmi-band ${bmiCategory(now)}`}>{t(`bmi.${bmiCategory(now)}`)}</span></p>
      <LineChart label={t('bmi.title')} points={points} format={(v) => formatNum(v)} lowerBetter={now >= 25} />
      {goal !== undefined && goalWeightKg !== undefined && <p className="small">{t('bmi.goal', { weight: w(goalWeightKg), bmi: formatNum(goal) })} · {t(`bmi.${bmiCategory(goal)}`)}</p>}
      {suggestion && <p className="small">{t('bmi.suggest', { bmi: formatNum(suggestion.bmi), weight: w(suggestion.kg) })} <Link to="/profile/settings">{t('bmi.setGoal')}</Link></p>}
      <p className="muted small">{t('bmi.note')}</p>
    </div>
  )
}
