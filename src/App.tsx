import { useEffect } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useSettings } from './stores/settings'
import Placeholder from './pages/Placeholder'
import Profile from './pages/Profile'

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
          {TABS.filter((x) => x.key !== 'profile').map((tab) => (
            <Route key={tab.key} path={tab.path} element={<Placeholder title={t(`tabs.${tab.key}`)} />} />
          ))}
          <Route path="/profile" element={<Profile />} />
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
