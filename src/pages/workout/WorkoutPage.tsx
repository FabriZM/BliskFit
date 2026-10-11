import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { getActiveSession, startSession } from '../../db/workout'
import TodayCard from '../../components/TodayCard'
import ActiveWorkout from './ActiveWorkout'

export default function WorkoutPage() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const state = useLiveQuery(async () => ({ session: await getActiveSession() }), [])
  const routines = useLiveQuery(() => db.routines.filter((r) => !r.archived).toArray(), []) ?? []

  if (!state) return <p className="muted">…</p>
  if (state.session) return <ActiveWorkout session={state.session} />

  const start = async (routineId?: string) => { await startSession(routineId); nav('/workout') }
  return (
    <section>
      <h1>{t('tabs.workout')}</h1>
      <TodayCard />
      <button className="primary wide" onClick={() => void start()}>{t('workout.startEmpty')}</button>
      <h2>{t('workout.startFromRoutine')}</h2>
      {routines.length === 0 && <p className="muted">{t('routines.none')}</p>}
      <ul className="list">
        {[...routines].sort((a, b) => a.name.localeCompare(b.name)).map((r) => (
          <li key={r.id}>
            <div className="routine-row">
              <div className="grow"><strong>{r.name}</strong><span className="muted small"> · {t('routines.exerciseCount', { count: r.exercises.length })}</span></div>
              <button className="primary" onClick={() => void start(r.id)}>{t('workout.start')}</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
