import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { addBodyWeight, deleteBodyWeight, updateBodyWeight } from '../../db/body'
import DecimalInput from '../../components/DecimalInput'
import { BackLink } from '../../components/PageHeader'
import { trend } from '../../lib/stats'
import { displayToKg, formatNum, kgToDisplay } from '../../lib/units'
import { useSettings } from '../../stores/settings'
import { ChartCard, DateField, EntryRow, History, today } from './shared'

/** Body weight: chart with trend, add a weigh-in, and every past weigh-in. */
export default function WeightPage() {
  const { t } = useTranslation()
  const units = useSettings((s) => s.settings.units)
  const [value, setValue] = useState<number>()
  const [day, setDay] = useState(today())
  const rows = useLiveQuery(() => db.bodyWeights.toArray(), [])
  if (!rows) return null
  const points = rows.map((r) => ({ at: r.date, value: r.weight }))

  return (
    <section>
      <BackLink to="/profile/body" label={t('body.title')} />
      <h1>{t('body.weight')}</h1>
      {rows.length > 0 && <ChartCard title={t('body.weight')} pin={{ kind: 'bodyweight', range: 'all' }} points={points} trend={trend(points)} unit="weight" />}
      <form className="card body-form" onSubmit={(e) => { e.preventDefault(); if (value) { void addBodyWeight(day, displayToKg(value, units)); setValue(undefined) } }}>
        <h2>{t('body.logNew')}</h2>
        <div className="form-line">
          <DecimalInput value={value} onCommit={setValue} label={`${t('body.weight')} (${units})`} placeholder={units} />
          <DateField value={day} onChange={setDay} label={t('body.date')} />
          <button className="primary" disabled={!value}>{t('common.add')}</button>
        </div>
      </form>
      <History items={rows} render={(r) => (
        <EntryRow key={r.id} date={r.date} label={`${formatNum(kgToDisplay(r.weight, units))} ${units}`} value={kgToDisplay(r.weight, units)}
          onSave={async (d, v) => { await updateBodyWeight(r.id, d, displayToKg(v!, units)); return true }}
          onDelete={() => void deleteBodyWeight(r.id)} />
      )} />
    </section>
  )
}
