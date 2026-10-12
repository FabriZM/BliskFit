import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { pointsInRange, rangeStart, trend } from '../lib/stats'
import { formatNum, kgToDisplay } from '../lib/units'
import { useNow } from '../lib/useNow'
import { useSettings } from '../stores/settings'
import LineChart from './stats/LineChart'

/** Profile's body card: the last 3 months of body weight (all of it if that's too little) and a way into the Body log. */
export default function BodyCard() {
  const { t } = useTranslation()
  const units = useSettings((s) => s.settings.units)
  const now = useNow(60_000)
  const weights = useLiveQuery(() => db.bodyWeights.toArray(), [])
  if (!weights) return null

  const all = weights.map((w) => ({ at: w.date, value: w.weight }))
  const smooth = trend(all)
  const from = rangeStart('3m', new Date(now))
  const recent = pointsInRange(all, from).length >= 2 ? from : undefined

  return (
    <div className="card">
      <div className="row head">
        <h3>{t('body.weight')}</h3>
        <Link className="btn" to="/profile/body">{t('body.card.open')}</Link>
      </div>
      {all.length
        ? <LineChart label={t('body.weight')} points={pointsInRange(all, recent)} trend={pointsInRange(smooth, recent)} format={(v) => `${formatNum(kgToDisplay(v, units))} ${units}`} />
        : <p className="muted small">{t('body.card.empty')} <Link to="/profile/body/weight">{t('body.card.logWeight')}</Link></p>}
    </div>
  )
}
