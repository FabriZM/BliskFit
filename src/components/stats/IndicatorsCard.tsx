import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BODY_FAT, ageOn, latestByType } from '../../lib/body'
import { V_TAPER_TARGET, bmr, leanMass, maintenanceKcal, navyBodyFat, shoulderToWaist, whr, whrRaised, whtr, whtrBand } from '../../lib/indicators'
import { formatNum, kgToDisplay } from '../../lib/units'
import { useSettings } from '../../stores/settings'
import type { StatsCtx } from '../../pages/stats/ctx'

/**
 * Indicators worked out from the latest logged measurements and the Profile details (height, age, sex): waist-to-height
 * and waist-to-hip (health), shoulder-to-waist (V-taper), lean mass with FFMI, an estimated body fat and calorie
 * needs. A missing input says what to log or fill in.
 */
export default function IndicatorsCard({ ctx }: { ctx: StatsCtx }) {
  const { t } = useTranslation()
  const { heightCm, birthDate, bodyModel, weeklyGoal } = useSettings((s) => s.settings)
  const sex = bodyModel === 'female' ? 'female' : 'male'
  const { data, units, today } = ctx
  const latest = latestByType(data.measurements)
  const weight = data.bodyWeights[data.bodyWeights.length - 1]?.weight
  const waist = latest.get('waist')?.value
  const shoulders = latest.get('shoulders')?.value
  const hips = latest.get('hips')?.value
  const neck = latest.get('neck')?.value
  const fat = latest.get(BODY_FAT)?.value
  const age = ageOn(birthDate, today)

  const ratio = whtr(waist, heightCm)
  const hipRatio = whr(waist, hips)
  const taper = shoulderToWaist(shoulders, waist)
  const lean = leanMass(weight, fat, heightCm)
  const navy = navyBodyFat(sex, heightCm, waist, neck, hips)
  const resting = bmr(sex, weight, heightCm, age)
  const kg = (v: number) => `${formatNum(kgToDisplay(v, units))} ${units}`

  /** What's still missing: measurements to log (L) and profile details to fill in (P). */
  const missing = (log: [boolean, string][], profile: [boolean, string][] = []): ReactNode => {
    const L = log.filter(([m]) => m).map(([, k]) => t(`indicators.${k}`))
    const P = profile.filter(([m]) => m).map(([, k]) => t(`indicators.${k}`))
    return (
      <span className="muted small">
        {L.length > 0 && t('indicators.need', { what: L.join(' + ') })}{L.length > 0 && P.length > 0 && ' · '}
        {P.length > 0 && <>{t('indicators.fillIn', { what: P.join(' + ') })} <Link to="/profile/settings">{t('profile.settings')}</Link></>}
      </span>
    )
  }
  const row = (title: string, value: ReactNode, help: string) => (
    <div><dt>{title}</dt><dd>{value}</dd><dd className="muted small">{help}</dd></div>
  )

  return (
    <div className="card indicators">
      <h3>{t('indicators.title')}</h3>
      <dl>
        {row(t('indicators.whtr'), ratio !== undefined
          ? <><strong>{ratio.toFixed(2)}</strong> <span className={`bmi-band whtr-${whtrBand(ratio)}`}>{t(`indicators.whtrBand.${whtrBand(ratio)}`)}</span></>
          : missing([[!waist, 'waist']], [[!heightCm, 'height']]), t('indicators.whtrHelp'))}
        {row(t('indicators.whr'), hipRatio !== undefined
          ? <><strong>{hipRatio.toFixed(2)}</strong> <span className={`bmi-band whtr-${whrRaised(hipRatio, sex) ? 'raised' : 'healthy'}`}>{t(`indicators.whrBand.${whrRaised(hipRatio, sex) ? 'raised' : 'healthy'}`)}</span></>
          : missing([[!waist, 'waist'], [!hips, 'hips']]), t('indicators.whrHelp', { limit: sex === 'male' ? '0.90' : '0.85' }))}
        {row(t('indicators.taper'), taper !== undefined
          ? <><strong>{taper.toFixed(2)}</strong> <span className="muted small">{t('indicators.taperTarget', { target: V_TAPER_TARGET })}</span></>
          : missing([[!shoulders, 'shoulders'], [!waist, 'waist']]), t('indicators.taperHelp'))}
        {row(t('indicators.lean'), lean
          ? <><strong>{kg(lean.leanKg)}</strong> <span className="muted small">{t('indicators.leanDetail', { fat: kg(lean.fatKg), ffmi: formatNum(lean.ffmi) })}</span></>
          : missing([[weight === undefined, 'weight'], [fat === undefined, 'bodyFat']], [[!heightCm, 'height']]), t('indicators.leanHelp'))}
        {row(t('indicators.navy'), navy !== undefined
          ? <><strong>{navy}%</strong>{fat !== undefined && <span className="muted small"> {t('indicators.navyLogged', { value: formatNum(fat) })}</span>}</>
          : missing([[!waist, 'waist'], [neck === undefined, 'neck'], ...(sex === 'female' ? [[!hips, 'hips'] as [boolean, string]] : [])], [[!heightCm, 'height']]),
        t('indicators.navyHelp'))}
        {row(t('indicators.energy'), resting !== undefined
          ? <><strong>{maintenanceKcal(resting, weeklyGoal)} kcal</strong> <span className="muted small">{t('indicators.energyDetail', { bmr: resting, days: weeklyGoal })}</span></>
          : missing([[weight === undefined, 'weight']], [[!heightCm, 'height'], [age === undefined, 'birthDate']]), t('indicators.energyHelp'))}
      </dl>
      <p className="small"><Link to="/profile/body">{t('stats.openBodyLog')}</Link></p>
    </div>
  )
}
