import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { getActiveProgramId } from '../db/programs'
import { suggestToday } from '../lib/programs'
import { useSettings } from '../stores/settings'

/** "Today's workout" suggestion from the active program. Starting a session arrives with M3. */
export default function TodayCard() {
  const { t, i18n } = useTranslation()
  const weekStartDay = useSettings((s) => s.settings.weekStartDay)
  const data = useLiveQuery(async () => {
    const pid = await getActiveProgramId()
    const [program, routines, sessions, exercises] = await Promise.all([
      pid ? db.programs.get(pid) : undefined,
      db.routines.toArray(),
      db.sessions.where('status').equals('finished').toArray(),
      db.exercises.toArray(),
    ])
    return { program, routines, sessions, exercises }
  }, [])
  if (!data) return null

  const { program, routines, sessions, exercises } = data
  const valid = new Set(routines.filter((r) => !r.archived).map((r) => r.id))
  const s = suggestToday({ program, sessions, today: new Date(), weekStartDay, validRoutineIds: valid })

  let body: React.ReactNode
  if (s.kind === 'none') {
    body = <><p className="muted">{t('today.noProgram')}</p><Link to="/routines/programs">{t('programs.title')} →</Link></>
  } else if (s.kind === 'notStarted') {
    body = <p className="muted">{t('today.notStarted', { date: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(s.startDate) })}</p>
  } else if (s.kind === 'rest') {
    body = <p>{t('today.rest')}</p>
  } else {
    const r = routines.find((x) => x.id === s.routineId)!
    const names = new Map(exercises.map((e) => [e.id, e.name]))
    body = (
      <>
        <p className="muted">{s.mode === 'rotation' ? t('today.nextInRotation') : t('today.scheduled')}{s.trainedToday ? ` · ${t('today.trainedToday')}` : ''}</p>
        <Link to={`/routines/${r.id}`}><strong>{r.name}</strong></Link>
        <p className="muted small">{r.exercises.map((e) => names.get(e.exerciseId)).filter(Boolean).join(' · ') || t('routines.emptyRoutine')}</p>
      </>
    )
  }
  return (
    <div className="card">
      <h2>{t('today.title')}{program ? <span className="muted small"> · {program.name}</span> : null}</h2>
      {body}
    </div>
  )
}
