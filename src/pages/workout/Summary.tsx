import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Exercise } from '../../db/types'
import { formatSet } from '../../lib/format'
import { formatClock, formatNum, kgToDisplay } from '../../lib/units'
import { elapsedMs, sessionStats } from '../../lib/workout'
import { useSettings } from '../../stores/settings'

export default function Summary() {
  const { t } = useTranslation()
  const id = useParams().id!
  const units = useSettings((s) => s.settings.units)
  const data = useLiveQuery(async () => {
    const session = await db.sessions.get(id)
    const sets = (await db.setLogs.where('sessionId').equals(id).toArray()).filter((s) => s.doneAt !== undefined)
    const exs = await db.exercises.bulkGet([...new Set(sets.map((s) => s.exerciseId))])
    return { session, sets, exercises: new Map(exs.filter((e): e is Exercise => !!e).map((e) => [e.id, e])) }
  }, [id])
  if (!data) return <p className="muted">…</p>
  const { session, sets, exercises } = data
  if (!session) return <section><p>{t('workout.notFound')}</p><Link to="/">{t('tabs.home')}</Link></section>

  const stats = sessionStats(sets, (eid) => exercises.get(eid)?.trackingType ?? 'weight_reps')
  const items = session.exercises.filter((it) => sets.some((s) => s.itemId === it.id))
  return (
    <section>
      <h1>{t('summary.title')}</h1>
      <div className="stats">
        <div><strong>{formatClock(elapsedMs(session, Date.now()))}</strong><span>{t('summary.duration')}</span></div>
        <div><strong>{stats.sets}</strong><span>{t('summary.sets')}</span></div>
        <div><strong>{formatNum(kgToDisplay(stats.volume, units))} {units}</strong><span>{t('summary.volume')}</span></div>
        <div><strong>{stats.exercises}</strong><span>{t('summary.exercises')}</span></div>
      </div>
      <ul className="list">
        {items.map((it) => {
          const ex = exercises.get(it.exerciseId)
          return (
            <li key={it.id}><div>
              <strong>{ex?.name}</strong>
              <p className="muted small">{sets.filter((s) => s.itemId === it.id).sort((a, b) => a.order - b.order).map((s) => formatSet(s, ex?.trackingType ?? 'weight_reps', units)).join(' · ')}</p>
            </div></li>
          )
        })}
      </ul>
      <Link className="btn wide-link" to="/">{t('common.done')}</Link>
    </section>
  )
}
