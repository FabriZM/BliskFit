import { useTranslation } from 'react-i18next'
import type { Measurement } from '../../db/types'
import { asymmetries, latestByType } from '../../lib/body'
import { formatNum } from '../../lib/units'
import { measurementLabel } from './measurementLabel'

/** Left/right differences from the latest measurement of each pair (nothing at all without a complete pair). */
export default function AsymmetryList({ measurements }: { measurements: Measurement[] }) {
  const { t } = useTranslation()
  const list = asymmetries(latestByType(measurements))
  if (!list.length) return null
  return (
    <>
      <h4>{t('stats.asymmetry')}</h4>
      <ul className="plain">
        {list.map((a) => (
          <li key={a.base} className="row">
            <span>{measurementLabel(a.base, t)}</span>
            <span>
              {t('body.left')} {formatNum(a.left)} · {t('body.right')} {formatNum(a.right)} cm
              <span className={a.pct >= 5 ? ' delta' : ' muted'}> · {a.diff === 0 ? t('stats.balanced') : t('stats.biggerSide', { side: a.diff > 0 ? t('body.left') : t('body.right'), pct: formatNum(Math.round(a.pct * 10) / 10) })}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}
