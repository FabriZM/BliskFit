import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { getActiveSession, startSession } from '../../db/workout'
import TodayCard from '../../components/TodayCard'
import ActiveWorkout from './ActiveWorkout'
import RoutinesSection from './RoutinesSection'

/** Workout tab: the running workout if there is one, otherwise pick a routine or follow the program. */
export default function WorkoutPage() {
  const { t } = useTranslation()
  const state = useLiveQuery(async () => ({ session: await getActiveSession() }), [])
  if (!state) return <p className="muted">…</p>
  if (state.session) return <ActiveWorkout session={state.session} />
  return (
    <section>
      <h1>{t('tabs.workout')}</h1>
      <TodayCard />
      <button className="wide" onClick={() => void startSession()}>{t('workout.startEmpty')}</button>
      <RoutinesSection />
    </section>
  )
}
