import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { daysLeftIn, effectiveVisitDays, gymPeriods, paceHint, qualifyingSessionIds, visitDays } from '../lib/gymVisits'
import VisitDaysEditor from './VisitDaysEditor'
import { useNow } from '../lib/useNow'
import { PencilIcon } from './Icons'

/** One card per gym that has a visit plan (nothing at all if none do). Profile only. */
export default function GymVisitsCard() {
  const { t, i18n } = useTranslation()
  const now = useNow(60_000)
  const [editing, setEditing] = useState<string | null>(null)
  const data = useLiveQuery(async () => {
    const gyms = (await db.gyms.toArray()).filter((g) => g.allowance)
    if (!gyms.length) return { gyms }
    const sessions = await db.sessions.where('status').equals('finished').toArray()
    const sets = await db.setLogs.filter((s) => s.doneAt !== undefined && s.setType !== 'warmup').toArray()
    return { gyms, sessions, qualifying: qualifyingSessionIds(sets) }
  }, [])
  if (!data || !data.gyms.length || !data.sessions || !data.qualifying) return null

  const today = new Date(now)
  const fmt = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' })

  return (
    <>
      <h2>{t('gymplan.title')}</h2>
      {data.gyms.map((g) => {
        const workoutDays = visitDays(data.sessions!, data.qualifying!, g.id)
        const periods = gymPeriods(g.allowance!, effectiveVisitDays(workoutDays, g.visitAdjustments), today)
        const cur = periods[periods.length - 1]
        const prev = periods[periods.length - 2]
        const left = daysLeftIn(cur, today)
        const pace = paceHint(cur.left, left)
        const pct = Math.min(100, Math.round((cur.used / Math.max(1, cur.total)) * 100))
        return (
          <div className="card gym-card" key={g.id}>
            <div className="row head">
              <strong>{g.name}</strong>
              <button className="icon" aria-label={t('gymplan.edit')} title={t('gymplan.edit')} onClick={() => setEditing(g.id)}><PencilIcon /></button>
            </div>
            <p className="muted small period-range">{fmt.format(cur.start)} – {fmt.format(new Date(cur.end.getFullYear(), cur.end.getMonth(), cur.end.getDate() - 1))}</p>
            <p className="gym-line">
              <strong>{t('gymplan.usedOf', { used: cur.used, total: cur.total })}</strong>
              {' · '}{t('gymplan.left', { count: cur.left })}{' · '}{t('gymplan.daysLeft', { count: left })}
            </p>
            <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={cur.total} aria-valuenow={cur.used}
              aria-label={t('gymplan.usedOf', { used: cur.used, total: cur.total })}><i style={{ width: `${pct}%` }} /></div>
            {pace.kind !== 'none' && <p className="muted small">{t(`gymplan.pace_${pace.kind}`, { count: 'days' in pace ? pace.days : 'surplus' in pace ? pace.surplus : 0 })}</p>}
            {prev && <p className="muted small">{t('gymplan.lastPeriod', { used: prev.used, total: prev.total })}</p>}
            {editing === g.id && <VisitDaysEditor gym={g} workoutDays={workoutDays} onClose={() => setEditing(null)} />}
          </div>
        )
      })}
    </>
  )
}
