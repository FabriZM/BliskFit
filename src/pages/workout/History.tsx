import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Exercise } from '../../db/types'
import { formatClock, formatNum, kgToDisplay } from '../../lib/units'
import { elapsedMs, sessionStats } from '../../lib/workout'
import { useSettings } from '../../stores/settings'

/** Finished workouts, newest first. Detail view is the summary page; calendar, edit and PRs arrive with M4. */
export default function History() {
  const { t, i18n } = useTranslation()
  const units = useSettings((s) => s.settings.units)
  const data = useLiveQuery(async () => {
    const sessions = (await db.sessions.where('status').equals('finished').toArray()).sort((a, b) => b.startedAt - a.startedAt)
    const sets = await db.setLogs.filter((s) => s.doneAt !== undefined).toArray()
    const exercises = new Map((await db.exercises.bulkGet([...new Set(sets.map((s) => s.exerciseId))])).filter((e): e is Exercise => !!e).map((e) => [e.id, e]))
    const routines = new Map((await db.routines.toArray()).map((r) => [r.id, r.name]))
    return { sessions, sets, exercises, routines }
  }, [])
  if (!data) return <p className="muted">…</p>
  const date = new Intl.DateTimeFormat(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <section>
      <p><Link to="/workout">← {t('tabs.workout')}</Link></p>
      <h1>{t('history.title')}</h1>
      {data.sessions.length === 0 && <p className="muted">{t('history.empty')}</p>}
      <ul className="list">
        {data.sessions.map((s) => {
          const stats = sessionStats(data.sets.filter((x) => x.sessionId === s.id), (id) => data.exercises.get(id)?.trackingType ?? 'weight_reps')
          return (
            <li key={s.id}>
              <Link to={`/workout/summary/${s.id}`}>
                <strong>{date.format(s.startedAt)} · {(s.routineId && data.routines.get(s.routineId)) || t('workout.empty')}</strong>
                <span className="muted">
                  {formatClock(elapsedMs(s, Date.now()))} · {t('history.sets', { count: stats.sets })}
                  {stats.volume > 0 ? ` · ${formatNum(kgToDisplay(stats.volume, units))} ${units}` : ''}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
