import { useState } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { addMeasurement, deleteMeasurement, updateMeasurement } from '../../db/body'
import DecimalInput from '../../components/DecimalInput'
import { BackLink } from '../../components/PageHeader'
import { measurementLabel } from '../../components/stats/measurementLabel'
import { SIDED, measurementType, measurementUnit, parseMeasurementType, type Side } from '../../lib/body'
import { formatNum } from '../../lib/units'
import { ChartCard, DateField, EntryRow, History, today } from './shared'

/**
 * One measurement (standard, custom, or body fat in %): chart, add a new value, and every past value. Left/right measurements
 * switch side for the chart and history; the form takes both sides at once since they're usually measured together.
 */
export default function MeasurementPage() {
  const { t } = useTranslation()
  const base = useParams().name ?? ''
  const [params] = useSearchParams()
  const [side, setSide] = useState<Side>('l')
  const [left, setLeft] = useState<number>()
  const [right, setRight] = useState<number>()
  const [value, setValue] = useState<number>()
  const [day, setDay] = useState(today())
  const rows = useLiveQuery(() => db.measurements.toArray().then((all) => all.filter((m) => parseMeasurementType(m.type).base === base)), [base])

  if (!base) return <Navigate to="/profile/body" replace />
  if (!rows) return null
  const sided = SIDED.has(base) || params.get('sided') === '1' || rows.some((m) => parseMeasurementType(m.type).side)
  const type = measurementType(base, sided ? side : undefined)
  const title = measurementLabel(base, t)
  const shown = rows.filter((m) => m.type === type)
  const unit = measurementUnit(base)
  const pct = unit === '%'
  // A percentage has to be below 100; circumferences only need to be positive.
  const ready = sided ? !!(left || right) : !!value && (!pct || value < 100)
  const show = (v: number) => (pct ? `${formatNum(v)}%` : `${formatNum(v)} cm`)

  return (
    <section>
      <BackLink to="/profile/body" label={t('body.title')} />
      <h1>{title}</h1>
      {sided && (
        <div className="segmented" role="group" aria-label={t('body.side')}>
          {(['l', 'r'] as const).map((s) => <button type="button" key={s} className={side === s ? 'on' : ''} aria-pressed={side === s} onClick={() => setSide(s)}>{t(s === 'l' ? 'body.left' : 'body.right')}</button>)}
        </div>
      )}
      {shown.length > 0 && <ChartCard title={measurementLabel(type, t)} pin={{ kind: 'measurement', measurement: type, range: 'all' }} points={shown.map((m) => ({ at: m.date, value: m.value }))} unit={pct ? 'pct' : 'cm'} lowerBetter={pct} />}
      <form className="card body-form" onSubmit={(e) => {
        e.preventDefault()
        if (!ready) return
        if (sided) {
          if (left) void addMeasurement(day, measurementType(base, 'l'), left)
          if (right) void addMeasurement(day, measurementType(base, 'r'), right)
          setLeft(undefined); setRight(undefined)
        } else {
          void addMeasurement(day, base, value!)
          setValue(undefined)
        }
      }}>
        <h2>{t('body.logNew')}</h2>
        <div className="form-line">
          {sided ? (
            <>
              <DecimalInput value={left} onCommit={setLeft} label={`${t('body.left')} (cm)`} placeholder={`${t('body.leftShort')} cm`} />
              <DecimalInput value={right} onCommit={setRight} label={`${t('body.right')} (cm)`} placeholder={`${t('body.rightShort')} cm`} />
            </>
          ) : <DecimalInput value={value} onCommit={setValue} label={`${title} (${unit})`} placeholder={unit} />}
        </div>
        <div className="form-line">
          <DateField value={day} onChange={setDay} label={t('body.date')} />
          <button className="primary" disabled={!ready}>{t('common.add')}</button>
        </div>
      </form>
      <History items={shown} render={(m) => (
        <EntryRow key={m.id} date={m.date} label={show(m.value)} value={m.value}
          onSave={async (d, v) => { await updateMeasurement(m.id, d, v!); return true }}
          onDelete={() => void deleteMeasurement(m.id)} />
      )} />
    </section>
  )
}
