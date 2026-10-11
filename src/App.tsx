import { useEffect } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useSettings } from './stores/settings'
import Placeholder from './pages/Placeholder'
import Home from './pages/Home'
import RoutineList from './pages/routines/RoutineList'
import RoutineEditor from './pages/routines/RoutineEditor'
import ProgramList from './pages/programs/ProgramList'
import ProgramEditor from './pages/programs/ProgramEditor'
import Profile from './pages/Profile'
import Gyms from './pages/Gyms'
import ExerciseList from './pages/exercises/ExerciseList'
import ExerciseDetail from './pages/exercises/ExerciseDetail'
import ExerciseForm from './pages/exercises/ExerciseForm'
import { db } from './db/db'
import { ensureSeed } from './db/seed'

const TABS = [
  { path: '/', key: 'home', icon: '🏠' },
  { path: '/workout', key: 'workout', icon: '🏋️' },
  { path: '/routines', key: 'routines', icon: '📋' },
  { path: '/exercises', key: 'exercises', icon: '💪' },
  { path: '/stats', key: 'stats', icon: '📈' },
  { path: '/profile', key: 'profile', icon: '👤' },
] as const

export default function App() {
  const { t, i18n } = useTranslation()
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
          {TABS.filter((x) => !['profile', 'exercises', 'home', 'routines'].includes(x.key)).map((tab) => (
            <Route key={tab.key} path={tab.path} element={<Placeholder title={t(`tabs.${tab.key}`)} />} />
          ))}
          <Route path="/" element={<Home />} />
          <Route path="/routines" element={<RoutineList />} />
          <Route path="/routines/programs" element={<ProgramList />} />
          <Route path="/routines/programs/:id" element={<ProgramEditor />} />
          <Route path="/routines/:id" element={<RoutineEditor />} />
          <Route path="/exercises" element={<ExerciseList />} />
          <Route path="/exercises/new" element={<ExerciseForm />} />
          <Route path="/exercises/:id" element={<ExerciseDetail />} />
          <Route path="/exercises/:id/edit" element={<ExerciseForm />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/gyms" element={<Gyms />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <nav className="tabbar">
        {TABS.map((tab) => (
          <NavLink key={tab.key} to={tab.path} end={tab.path === '/'}>
            <span aria-hidden>{tab.icon}</span>
            <span>{t(`tabs.${tab.key}`)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
