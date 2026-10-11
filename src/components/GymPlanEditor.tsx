import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import NumInput from './NumInput'
import { db } from '../db/db'
import type { Gym } from '../db/types'
import { dateKey } from '../lib/goals'

/** Optional visit plan for one gym. Collapsed by default; a gym without a plan behaves exactly as before. */
export default function GymPlanEditor({ gym }: { gym: Gym }) {
  const { t } = useTranslation()
  const a = gym.allowance
  const [visits, setVisits] = useState<number | undefined>(a?.visits)
  const [startDay, setStartDay] = useState(a?.startDay ?? 1)
  const [rollover, setRollover] = useState(a?.rollover ?? false)

  const save = () => visits && db.gyms.update(gym.id, {
    // `since` stays when you adjust an existing plan; a new plan starts counting from today's period.
    allowance: { visits, startDay, rollover, since: a?.since ?? dateKey(new Date()) },
  })
  const remove = async () => {
    await db.gyms.update(gym.id, { allowance: undefined }) // history is untouched; only the plan goes
    setVisits(undefined); setStartDay(1); setRollover(false)
  }

  const summary = a
    ? t(a.startDay === 1 ? 'gymplan.summaryMonth' : 'gymplan.summaryDay', { count: a.visits, day: a.startDay })
    : t('gymplan.optional')

  return (
    <details className="plan-editor">
      <summary>{summary}</summary>
      <div className="form">
        <label>{t('gymplan.visits')}
          <NumInput label={t('gymplan.visits')} value={visits} min={1} max={99} allowEmpty placeholder="12" onCommit={setVisits} />
        </label>
        <label>{t('gymplan.startDay')}
          <select value={startDay} onChange={(e) => setStartDay(Number(e.target.value))}>
            <option value={1}>{t('gymplan.calendarMonth')}</option>
            {Array.from({ length: 30 }, (_, i) => i + 2).map((d) => <option key={d} value={d}>{t('gymplan.dayN', { day: d })}</option>)}
          </select>
        </label>
        <label className="inline"><input type="checkbox" checked={rollover} onChange={(e) => setRollover(e.target.checked)} /> {t('gymplan.rollover')}</label>
        <p className="muted small help">{t('gymplan.help')}</p>
        <div className="actions">
          <button className="primary" disabled={!visits} onClick={() => void save()}>{t('gymplan.save')}</button>
          {a && <button className="danger" onClick={() => void remove()}>{t('gymplan.remove')}</button>}
        </div>
      </div>
    </details>
  )
}
