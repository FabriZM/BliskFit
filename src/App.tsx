import { useEffect } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useSettings } from './stores/settings'
import WorkoutPage from './pages/workout/WorkoutPage'
import Summary from './pages/workout/Summary'
import History from './pages/workout/History'
import ForgottenGuard from './components/ForgottenGuard'
import InProgressBar from './components/InProgressBar'
import RoutineEditor from './pages/routines/RoutineEditor'
import ProgramList from './pages/programs/ProgramList'
import ProgramEditor from './pages/programs/ProgramEditor'
import Profile from './pages/Profile'
import Gyms from './pages/Gyms'
import ExerciseList from './pages/exercises/ExerciseList'
import ExerciseDetail from './pages/exercises/ExerciseDetail'
import ExerciseForm from './pages/exercises/ExerciseForm'
import { ExercisesIcon, ProfileIcon, WorkoutIcon } from './components/TabIcons'
import { db } from './db/db'
import { ensureSeed } from './db/seed'

// Three tabs. Routines and programs live under Workout, so those routes keep the Workout tab highlighted.
const TABS = [
  { path: '/profile', key: 'profile', Icon: ProfileIcon, match: ['/profile'] },
  { path: '/workout', key: 'workout', Icon: WorkoutIcon, match: ['/workout', '/routines'] },
  { path: '/exercises', key: 'exercises', Icon: ExercisesIcon, match: ['/exercises'] },
] as const

export default function App() {
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()
  const { settings, loaded, load } = useSettings()
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  useEffect(() => {
    void load()
    void ensureSeed(db)
    // Ask the browser not to evict our IndexedDB data.
    void navigator.storage?.persist?.()
  }, [load])

  useEffect(() => {
    if (loaded) void i18n.changeLanguage(settings.language)
  }, [loaded, settings.language, i18n])

  return (
    <div className="app">
      {needRefresh && (
        <div className="update-banner">
          {t('profile.updateAvailable')}
          <button onClick={() => void updateServiceWorker(true)}>{t('profile.reload')}</button>
        </div>
      )}
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/profile" replace />} />
          <Route path="/workout" element={<WorkoutPage />} />
          <Route path="/workout/history" element={<History />} />
          <Route path="/workout/summary/:id" element={<Summary />} />
          <Route path="/routines" element={<Navigate to="/workout" replace />} />
          <Route path="/routines/programs" element={<ProgramList />} />
          <Route path="/routines/programs/:id" element={<ProgramEditor />} />
          <Route path="/routines/:id" element={<RoutineEditor />} />
          <Route path="/exercises" element={<ExerciseList />} />
          <Route path="/exercises/new" element={<ExerciseForm />} />
          <Route path="/exercises/:id" element={<ExerciseDetail />} />
          <Route path="/exercises/:id/edit" element={<ExerciseForm />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/gyms" element={<Gyms />} />
          <Route path="*" element={<Navigate to="/profile" replace />} />
        </Routes>
      </main>
      <ForgottenGuard />
      <InProgressBar />
      <nav className="tabbar">
        {TABS.map(({ path, key, Icon, match }) => {
          const active = match.some((m) => pathname === m || pathname.startsWith(m + '/'))
          return (
            <Link key={key} to={path} className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined}>
              <Icon />
              <span>{t(`tabs.${key}`)}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
