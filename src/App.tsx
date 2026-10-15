import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
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
import AndroidAppOffer from './components/AndroidAppOffer'
import IosInstall from './components/IosInstall'
import IncomingLinks from './components/IncomingLinks'
import { platform } from './lib/platform'
import RoutineEditor from './pages/routines/RoutineEditor'
import ProgramList from './pages/programs/ProgramList'
import RoutineList from './pages/routines/RoutineList'
import TemplatePicker from './pages/templates/TemplatePicker'
import ProgramEditor from './pages/programs/ProgramEditor'
import Profile from './pages/Profile'
import BodyLog from './pages/body/BodyLog'
import WeightPage from './pages/body/WeightPage'
import MeasurementPage from './pages/body/MeasurementPage'
import PhotosPage from './pages/body/PhotosPage'
import StatsPanel from './pages/stats/StatsPanel'
import Gyms from './pages/Gyms'
import Settings from './pages/Settings'
import Backup from './pages/Backup'
import Import from './pages/Import'
import ExerciseList from './pages/exercises/ExerciseList'
import ExerciseDetail from './pages/exercises/ExerciseDetail'
import ExerciseForm from './pages/exercises/ExerciseForm'
import TabBar from './components/TabBar'
import { db } from './db/db'
import { ensureSeed } from './db/seed'
import { autoBackupToDrive } from './db/driveBackup'

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

  // Fade out the launch screen from index.html once settings are in; it never waits longer than loading does.
  useEffect(() => {
    if (!loaded) return
    const launch = document.getElementById('launch')
    if (!launch) return
    launch.classList.add('done')
    const timer = setTimeout(() => launch.remove(), 300)
    return () => clearTimeout(timer)
  }, [loaded])

  return (
    <div className="app">
      {needRefresh && (
        <div className="update-banner">
          {t('profile.updateAvailable')}
          <button onClick={() => void updateServiceWorker(true)}>{t('profile.reload')}</button>
        </div>
      )}
      {platform.isNative && <><UpdateBanner /><IncomingLinks /></>}
      {!platform.isNative && <AndroidAppOffer variant="banner" />}
      {!platform.isNative && <IosInstall variant="banner" />}
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
          <Route path="/routines/all" element={<RoutineList />} />
          <Route path="/routines/templates" element={<TemplatePicker />} />
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
          <Route path="/profile/body/weight" element={<WeightPage />} />
          <Route path="/profile/body/photos" element={<PhotosPage />} />
          <Route path="/profile/body/m/:name" element={<MeasurementPage />} />
          <Route path="*" element={<Navigate to="/profile" replace />} />
        </Routes>
        </div>
      </main>
      <ForgottenGuard />
      <TimerNotifications />
      <TrainingReminders />
      <InProgressBar />
      <TabBar />
    </div>
  )
}
