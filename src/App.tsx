import { useEffect } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useSettings } from './stores/settings'
import WorkoutPage from './pages/workout/WorkoutPage'
import SessionDetail from './pages/workout/SessionDetail'
import History from './pages/workout/History'
import ForgottenGuard from './components/ForgottenGuard'
import InProgressBar from './components/InProgressBar'
import TimerNotifications from './components/TimerNotifications'
import TrainingReminders from './components/TrainingReminders'
import UpdateBanner from './components/UpdateBanner'
import IncomingLinks from './components/IncomingLinks'
import { platform } from './lib/platform'
import RoutineEditor from './pages/routines/RoutineEditor'
import ProgramList from './pages/programs/ProgramList'
import ProgramEditor from './pages/programs/ProgramEditor'
import Profile from './pages/Profile'
import BodyLog from './pages/BodyLog'
import StatsPanel from './pages/stats/StatsPanel'
import Gyms from './pages/Gyms'
import Settings from './pages/Settings'
import Backup from './pages/Backup'
import Import from './pages/Import'
import ExerciseList from './pages/exercises/ExerciseList'
import ExerciseDetail from './pages/exercises/ExerciseDetail'
import ExerciseForm from './pages/exercises/ExerciseForm'
import { ExercisesIcon, ProfileIcon, WorkoutIcon } from './components/TabIcons'
import { db } from './db/db'
import { ensureSeed } from './db/seed'
import { autoBackupToDrive } from './db/driveBackup'

// Three tabs. Routines and programs live under Workout, so those routes keep the Workout tab highlighted.
const TABS = [
  { path: '/profile', key: 'profile', Icon: ProfileIcon, match: ['/profile'] },
  { path: '/workout', key: 'workout', Icon: WorkoutIcon, match: ['/workout', '/routines', '/import'] },
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
    // Daily Google Drive backup, if connected; a little later so it never slows the start.
    const driveTimer = setTimeout(() => void autoBackupToDrive(false), 5000)
    return () => clearTimeout(driveTimer)
  }, [load])

  useEffect(() => {
    if (loaded) void i18n.changeLanguage(settings.language)
  }, [loaded, settings.language, i18n])

  const activeTab = TABS.findIndex(({ match }) => match.some((m) => pathname === m || pathname.startsWith(m + '/')))

  return (
    <div className="app">
      {needRefresh && (
        <div className="update-banner">
          {t('profile.updateAvailable')}
          <button onClick={() => void updateServiceWorker(true)}>{t('profile.reload')}</button>
        </div>
      )}
      {platform.isNative && <><UpdateBanner /><IncomingLinks /></>}
      <main>
        {/* Keyed by path so each screen change replays the short fade-in. */}
        <div className="page" key={pathname}>
        <Routes>
          <Route path="/" element={<Navigate to="/profile" replace />} />
          <Route path="/workout" element={<WorkoutPage />} />
          <Route path="/workout/history" element={<History />} />
          <Route path="/workout/summary/:id" element={<SessionDetail justFinished />} />
          <Route path="/workout/history/:id" element={<SessionDetail />} />
          <Route path="/routines" element={<Navigate to="/workout" replace />} />
          <Route path="/import" element={<Import />} />
          <Route path="/routines/programs" element={<ProgramList />} />
          <Route path="/routines/programs/:id" element={<ProgramEditor />} />
          <Route path="/routines/:id" element={<RoutineEditor />} />
          <Route path="/exercises" element={<ExerciseList />} />
          <Route path="/exercises/new" element={<ExerciseForm />} />
          <Route path="/exercises/:id" element={<ExerciseDetail />} />
          <Route path="/exercises/:id/edit" element={<ExerciseForm />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/settings" element={<Settings />} />
          <Route path="/profile/gyms" element={<Gyms />} />
          <Route path="/profile/backup" element={<Backup />} />
          <Route path="/profile/stats" element={<StatsPanel />} />
          <Route path="/profile/body" element={<BodyLog />} />
          <Route path="*" element={<Navigate to="/profile" replace />} />
        </Routes>
        </div>
      </main>
      <ForgottenGuard />
      <TimerNotifications />
      <TrainingReminders />
      <InProgressBar />
      <nav className="tabbar" style={{ '--i': Math.max(0, activeTab) } as React.CSSProperties}>
        {/* Bar surface with a notch under the active tab (slides as one strip), and the bubble sitting in it. */}
        <div className="tabbar-bg" aria-hidden>
          <div className="tabbar-fill" />
          <div className="tabbar-notch">
            <svg viewBox="0 0 112 40" width="112" height="40" preserveAspectRatio="none">
              <path className="notch-fill" d="M0 0H10C24 0 26 40 56 40S88 0 102 0H112V40H0Z" />
              <path className="notch-edge" d="M0 .5H10C24 .5 26 40.5 56 40.5S88 .5 102 .5H112" />
            </svg>
            <div className="tabbar-fill" />
          </div>
          <div className="tabbar-fill" />
        </div>
        {activeTab >= 0 && <span className="tabbar-bubble" aria-hidden><i key={activeTab} /></span>}
        {TABS.map(({ path, key, Icon }, i) => {
          const active = i === activeTab
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
