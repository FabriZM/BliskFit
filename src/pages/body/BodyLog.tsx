import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { BackLink } from '../../components/PageHeader'
import { ChevronRightIcon } from '../../components/Icons'
import { measurementLabel } from '../../components/stats/measurementLabel'
import { BODY_FAT, STANDARD_MEASUREMENTS, isCustomMeasurement, latestByType, measurementType, parseMeasurementType } from '../../lib/body'
import { formatNum, kgToDisplay } from '../../lib/units'
import { useSettings } from '../../stores/settings'
import { useDayFormat } from './shared'

const measurementPath = (base: string, sided = false) => `/profile/body/m/${encodeURIComponent(base)}${sided ? '?sided=1' : ''}`

function Item({ to, title, detail }: { to: string; title: string; detail?: string }) {
  return (
    <li>
      <Link to={to} className="body-item">
        <span className="body-item-text"><span>{title}</span>{detail && <small className="muted">{detail}</small>}</span>
        <ChevronRightIcon />
      </Link>
    </li>
  )
}

/** Starts a custom measurement: picks a name (reusing an existing one that matches) and opens its page. */
function AddCustom({ existing }: { existing: string[] }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [sided, setSided] = useState(false)
  const clean = name.trim().replace(/\s+/g, ' ')
  return (
    <form className="card body-form" onSubmit={(e) => {
      e.preventDefault()
      if (!clean) return
      const lower = clean.toLowerCase()
      const standard = [...STANDARD_MEASUREMENTS, BODY_FAT].find((m) => m === lower || measurementLabel(m, t).toLowerCase() === lower)
      const match = standard ?? existing.find((m) => m.toLowerCase() === lower)
      navigate(match ? measurementPath(match) : measurementPath(clean, sided))
    }}>
      <h2>{t('body.addCustom')}</h2>
      <div className="form-line">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('body.customName')} aria-label={t('body.customName')} maxLength={40} />
        <button className="primary" disabled={!clean}>{t('common.add')}</button>
      </div>
      <label className="inline"><input type="checkbox" checked={sided} onChange={(e) => setSided(e.target.checked)} />{t('body.leftRight')}</label>
    </form>
  )
}

/** Everything that can be logged, each with its latest value; tapping one opens its chart, log form and history. */
export default function BodyLog() {
  const { t } = useTranslation()
  const units = useSettings((s) => s.settings.units)
  const fmt = useDayFormat()
  const rows = useLiveQuery(async () => ({
    weights: await db.bodyWeights.toArray(),
    measurements: await db.measurements.toArray(),
    photoCount: await db.progressPhotos.count(),
  }), [])
  if (!rows) return null

  const lastWeight = rows.weights.reduce<typeof rows.weights[number] | undefined>((a, w) => (!a || w.date >= a.date ? w : a), undefined)
  const latest = latestByType(rows.measurements)
  const customBases = [...new Set(rows.measurements.map((m) => parseMeasurementType(m.type).base))]
    .filter(isCustomMeasurement).sort((a, b) => a.localeCompare(b))

  const measurementDetail = (base: string) => {
    const one = latest.get(base)
    if (one) return `${formatNum(one.value)} cm · ${fmt.format(one.date)}`
    const l = latest.get(measurementType(base, 'l')), r = latest.get(measurementType(base, 'r'))
    if (!l && !r) return undefined
    const sides = [l && `${t('body.leftShort')} ${formatNum(l.value)}`, r && `${t('body.rightShort')} ${formatNum(r.value)}`].filter(Boolean).join(' · ')
    return `${sides} cm · ${fmt.format(Math.max(l?.date ?? 0, r?.date ?? 0))}`
  }

  return (
    <section>
      <BackLink to="/profile" label={t('tabs.profile')} />
      <div className="row head">
        <h1>{t('body.title')}</h1>
        <Link className="btn" to="/profile/stats?s=body">{t('body.seeStats')}</Link>
      </div>
      <ul className="list grouped">
        <Item to="/profile/body/weight" title={t('body.weight')}
          detail={lastWeight && `${formatNum(kgToDisplay(lastWeight.weight, units))} ${units} · ${fmt.format(lastWeight.date)}`} />
        <Item to={measurementPath(BODY_FAT)} title={t('body.bodyFat')}
          detail={latest.get(BODY_FAT) && `${formatNum(latest.get(BODY_FAT)!.value)}% · ${fmt.format(latest.get(BODY_FAT)!.date)}`} />
        <Item to="/profile/body/photos" title={t('body.photos')} detail={rows.photoCount ? t('body.photoCount', { count: rows.photoCount }) : undefined} />
      </ul>
      <h2>{t('body.measurements')}</h2>
      <ul className="list grouped">
        {[...STANDARD_MEASUREMENTS, ...customBases].map((base) => (
          <Item key={base} to={measurementPath(base)} title={measurementLabel(base, t)} detail={measurementDetail(base)} />
        ))}
      </ul>
      <AddCustom existing={customBases} />
    </section>
  )
}
