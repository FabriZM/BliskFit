import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import CalendarMonth from '../../components/CalendarMonth'
import { db } from '../../db/db'
import type { Exercise } from '../../db/types'
import { dateKey, trainingDayKeys } from '../../lib/goals'
import { computeAllPRs } from '../../lib/prs'
import { formatClock, formatNum, kgToDisplay } from '../../lib/units'
import { elapsedMs, sessionStats } from '../../lib/workout'
import { useSettings } from '../../stores/settings'
import { BackLink } from '../../components/PageHeader'
import EmptyState from '../../components/EmptyState'
import { HistoryIcon } from '../../components/TabIcons'

/** Finished workouts as a list or a calendar of training days; each opens its detail (edit, delete, PRs). */
export default function History() {
  const { t, i18n } = useTranslation()
  const { units, weekStartDay, prBadges } = useSettings((s) => s.settings)
  // ?day=YYYY-MM-DD (from a tapped day in the week strip) opens the calendar on that day.
  const dayParam = useSearchParams()[0].get('day')
  const [view, setView] = useState<'list' | 'calendar'>(dayParam ? 'calendar' : 'list')
  const [month, setMonth] = useState(() => {
    const d = dayParam ? new Date(`${dayParam}T12:00:00`) : new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [day, setDay] = useState<string | null>(dayParam)

  const data = useLiveQuery(async () => {
    const sessions = (await db.sessions.where('status').equals('finished').toArray()).sort((a, b) => b.startedAt - a.startedAt)
    const sets = await db.setLogs.filter((s) => s.doneAt !== undefined).toArray()
    const exercises = new Map((await db.exercises.bulkGet([...new Set(sets.map((s) => s.exerciseId))])).filter((e): e is Exercise => !!e).map((e) => [e.id, e]))
    const routines = new Map((await db.routines.toArray()).map((r) => [r.id, r.name]))
    return { sessions, sets, exercises, routines }
  }, [])

  const derived = useMemo(() => {
    if (!data) return undefined
    const trackingOf = (id: string) => data.exercises.get(id)?.trackingType ?? 'weight_reps'
    const prs = computeAllPRs(data.sets, trackingOf)
    return { trackingOf, prs, trained: trainingDayKeys(data.sessions) }
  }, [data])

  if (!data || !derived) return <p className="muted">…</p>
  const date = new Intl.DateTimeFormat(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })
  const shown = view === 'calendar' ? (day ? data.sessions.filter((s) => dateKey(new Date(s.startedAt)) === day) : []) : data.sessions

  return (
    <section>
      <BackLink to="/workout" label={t('tabs.workout')} />
      <h1>{t('history.title')}</h1>
      <div className="segmented" role="group" aria-label={t('history.view')}>
        <button className={view === 'list' ? 'on' : ''} aria-pressed={view === 'list'} onClick={() => setView('list')}>{t('history.list')}</button>
        <button className={view === 'calendar' ? 'on' : ''} aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}>{t('history.calendar')}</button>
      </div>
      {view === 'calendar' && (
        <>
          <CalendarMonth month={month} onMonthChange={setMonth} trained={derived.trained} selected={day} onSelect={setDay} weekStartDay={weekStartDay} />
          {!day && <p className="muted">{t('history.pickDay')}</p>}
          {day && shown.length === 0 && <p className="muted">{t('history.noWorkoutDay')}</p>}
        </>
      )}
      {view === 'list' && data.sessions.length === 0 && <EmptyState icon={<HistoryIcon />}>{t('history.empty')}</EmptyState>}
      <ul className="list">
        {shown.map((s) => {
          const sets = data.sets.filter((x) => x.sessionId === s.id)
          const stats = sessionStats(sets, derived.trackingOf)
          const prCount = sets.filter((x) => (derived.prs.get(x.id)?.length ?? 0) > 0).length
          return (
            <li key={s.id}>
              <Link to={`/workout/history/${s.id}`}>
                <strong>
                  {date.format(s.startedAt)} · {(s.routineId && data.routines.get(s.routineId)) || t('workout.empty')}
                  {prBadges && prCount > 0 && <span className="pr-badge inline" title={t('summary.prs')}>{prCount} PR</span>}
                </strong>
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
