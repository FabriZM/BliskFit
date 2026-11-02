import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BODY_FAT, latestByType } from '../../lib/body'
import { V_TAPER_TARGET, leanMass, shoulderToWaist, whtr, whtrBand } from '../../lib/indicators'
import { formatNum, kgToDisplay } from '../../lib/units'
import { useSettings } from '../../stores/settings'
import type { StatsCtx } from '../../pages/stats/ctx'

/**
 * Indicators worked out from the latest logged measurements and the Profile height: waist-to-height (health),
 * shoulder-to-waist (V-taper) and lean mass with the fat-free mass index. A missing input says what to log.
 */
export default function IndicatorsCard({ ctx }: { ctx: StatsCtx }) {
  const { t } = useTranslation()
  const heightCm = useSettings((s) => s.settings.heightCm)
  const { data, units } = ctx
  const latest = latestByType(data.measurements)
  const weight = data.bodyWeights[data.bodyWeights.length - 1]?.weight
  const waist = latest.get('waist')?.value
  const shoulders = latest.get('shoulders')?.value
  const fat = latest.get(BODY_FAT)?.value

  const ratio = whtr(waist, heightCm)
  const taper = shoulderToWaist(shoulders, waist)
  const lean = leanMass(weight, fat, heightCm)
  const kg = (v: number) => `${formatNum(kgToDisplay(v, units))} ${units}`

  const need = (...what: string[]) => <span className="muted small">{t('indicators.need', { what: what.join(' + ') })}</span>
  const heightMissing = !heightCm && <Link to="/profile/settings">{t('indicators.height')}</Link>

  return (
    <div className="card indicators">
      <h3>{t('indicators.title')}</h3>
      <dl>
        <div>
          <dt>{t('indicators.whtr')}</dt>
          <dd>{ratio !== undefined
            ? <><strong>{ratio}</strong> <span className={`bmi-band whtr-${whtrBand(ratio)}`}>{t(`indicators.whtrBand.${whtrBand(ratio)}`)}</span></>
            : <>{need(...[!waist && t('indicators.waist'), !heightCm && t('indicators.height')].filter((x): x is string => !!x))} {heightMissing}</>}</dd>
          <dd className="muted small">{t('indicators.whtrHelp')}</dd>
        </div>
        <div>
          <dt>{t('indicators.taper')}</dt>
          <dd>{taper !== undefined
            ? <><strong>{taper}</strong> <span className="muted small">{t('indicators.taperTarget', { target: V_TAPER_TARGET })}</span></>
            : need(...[!shoulders && t('indicators.shoulders'), !waist && t('indicators.waist')].filter((x): x is string => !!x))}</dd>
          <dd className="muted small">{t('indicators.taperHelp')}</dd>
        </div>
        <div>
          <dt>{t('indicators.lean')}</dt>
          <dd>{lean
            ? <><strong>{kg(lean.leanKg)}</strong> <span className="muted small">{t('indicators.leanDetail', { fat: kg(lean.fatKg), ffmi: formatNum(lean.ffmi) })}</span></>
            : <>{need(...[!weight && t('indicators.weight'), fat === undefined && t('indicators.bodyFat'), !heightCm && t('indicators.height')].filter((x): x is string => !!x))} {heightMissing}</>}</dd>
          <dd className="muted small">{t('indicators.leanHelp')}</dd>
        </div>
      </dl>
      <p className="small"><Link to="/profile/body">{t('stats.openBodyLog')}</Link></p>
    </div>
  )
}
