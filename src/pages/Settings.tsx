import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { weekdayNames } from '../lib/dates'
import { useSettings } from '../stores/settings'

export default function Settings() {
  const { t, i18n } = useTranslation()
  const { settings, update } = useSettings()
  const [persisted, setPersisted] = useState<boolean | null>(null)

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted)
  }, [])

  return (
    <section>
      <p><Link to="/profile">← {t('tabs.profile')}</Link></p>
      <h1>{t('profile.settings')}</h1>
      <label className="row">
        {t('profile.weeklyGoal')}
        <select value={settings.weeklyGoal} onChange={(e) => void update({ weeklyGoal: Number(e.target.value) })}>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{t('profile.goalDays', { count: n })}</option>)}
        </select>
      </label>
      <label className="row">
        {t('profile.weekStart')}
        <select value={settings.weekStartDay} onChange={(e) => void update({ weekStartDay: Number(e.target.value) })}>
          {[1, 0, 6].map((d) => <option key={d} value={d}>{weekdayNames(i18n.language)[d]}</option>)}
        </select>
      </label>
      <label className="row">
        {t('profile.language')}
        <select value={settings.language} onChange={(e) => void update({ language: e.target.value as 'en' | 'es' })}>
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </label>
      <label className="row">
        {t('profile.units')}
        <select value={settings.units} onChange={(e) => void update({ units: e.target.value as 'kg' | 'lb' })}>
          <option value="kg">kg</option>
          <option value="lb">lb</option>
        </select>
      </label>
      <label className="row">
        {t('profile.restPopup')}
        <input type="checkbox" className="toggle" checked={settings.restPopup} onChange={(e) => void update({ restPopup: e.target.checked })} />
      </label>
      <p className="row">
        {t('profile.persist')}
        <span className="muted">{persisted ? t('profile.persistGranted') : t('profile.persistDenied')}</span>
      </p>
      <p className="row">
        <Link to="/profile/gyms">{t('gyms.title')}</Link>
      </p>
    </section>
  )
}
