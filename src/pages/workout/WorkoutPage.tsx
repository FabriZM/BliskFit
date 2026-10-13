import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { getActiveSession, startSession } from '../../db/workout'
import { HistoryIcon } from '../../components/TabIcons'
import TodayCard from '../../components/TodayCard'
import PageHeader from '../../components/PageHeader'
import ActiveWorkout from './ActiveWorkout'
import RoutinesSection from './RoutinesSection'
import { useWorkoutView } from '../../stores/workoutView'

/**
 * Workout tab: the running workout if there is one, otherwise pick a routine or follow the program. A running
 * workout can be minimized to get to the routines; the in-progress bar brings it back.
 */
export default function WorkoutPage() {
  const { t } = useTranslation()
  const state = useLiveQuery(async () => ({ session: await getActiveSession() }), [])
  const { collapsed, setCollapsed } = useWorkoutView()
  const running = !!state?.session
  // A finished or discarded workout leaves nothing to minimize.
  useEffect(() => { if (state && !running && collapsed) setCollapsed(false) }, [state, running, collapsed, setCollapsed])
  if (!state) return <p className="muted">…</p>
  if (state.session && !collapsed) return <ActiveWorkout session={state.session} />
  return (
    <section>
      <PageHeader brand title={t('tabs.workout')}
        actions={<Link className="icon-link" to="/workout/history" aria-label={t('history.title')} title={t('history.title')}><HistoryIcon /></Link>} />
      <TodayCard />
      {!running && <button className="wide" onClick={() => void startSession()}>{t('workout.startEmpty')}</button>}
      <RoutinesSection running={running} />
    </section>
  )
}
