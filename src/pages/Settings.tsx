import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { setWeeklyGoal } from '../db/goals'
import { orderedWeekdays, weekdayNames } from '../lib/dates'
import { platform } from '../lib/platform'
import { useNotificationState } from '../lib/platform/hooks'
import { useSettings } from '../stores/settings'

export default function Settings() {
  const { t, i18n } = useTranslation()
  const { settings, update } = useSettings()
  const rem = useNotificationState()
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
        <select value={settings.weeklyGoal} onChange={(e) => void setWeeklyGoal(Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{t('profile.goalDays', { count: n })}</option>)}
        </select>
      </label>
      <label className="row">
        {t('profile.streakFreezes')}
        <select value={settings.streakFreezes} onChange={(e) => void update({ streakFreezes: Number(e.target.value) })}>
          <option value={0}>{t('profile.freezeOff')}</option>
          {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <p className="muted small help">{t('profile.freezeHelp')}</p>
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
        {t('profile.prBadges')}
        <input type="checkbox" className="toggle" checked={settings.prBadges} onChange={(e) => void update({ prBadges: e.target.checked })} />
      </label>
      <label className="row">
        {t('profile.restPopup')}
        <input type="checkbox" className="toggle" checked={settings.restPopup} onChange={(e) => void update({ restPopup: e.target.checked })} />
      </label>
      <h2>{t('reminders.title')}</h2>
      <div className="row">
        {t('reminders.notifications')}
        <span>
          <span className="muted">{rem.permission ? t(`reminders.state.${rem.permission}`) : '…'} </span>
          {rem.permission === 'prompt' && <button onClick={() => void rem.request()}>{t('reminders.enable')}</button>}
        </span>
      </div>
      {platform.isNative && (
        <div className="row">
          {t('reminders.exact')}
          <span>
            <span className="muted">{rem.exact ? t(`reminders.state.${rem.exact}`) : '…'} </span>
            {rem.exact === 'denied' && <button onClick={() => void rem.openExactSettings()}>{t('reminders.openSettings')}</button>}
          </span>
        </div>
      )}
      <div className="reminder-days">
        <span>{t('reminders.trainingDays')}</span>
        <div className="chips">
          {orderedWeekdays(settings.weekStartDay).map((d) => {
            const on = settings.reminderDays.includes(d)
            return (
              <button key={d} className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={async () => {
                // Read the latest value, not this render's snapshot: quick consecutive taps must not overwrite each other.
                const current = useSettings.getState().settings.reminderDays
                const turningOn = !current.includes(d)
                await update({ reminderDays: turningOn ? [...current, d].sort() : current.filter((x) => x !== d) })
                if (turningOn && rem.permission === 'prompt') void rem.request() // asked when you actually turn one on
              }}>{weekdayNames(i18n.language, 'short')[d].slice(0, 3)}</button>
            )
          })}
        </div>
      </div>
      <label className="row">
        {t('reminders.time')}
        <input type="time" className="time-input" value={settings.reminderTime} disabled={settings.reminderDays.length === 0}
          onChange={(e) => e.target.value && void update({ reminderTime: e.target.value })} />
      </label>
      <p className="muted small help">{t('reminders.trainHelp')}{platform.isNative ? '' : ` ${t('reminders.webNote')}`}</p>
      <p className="row">
        {t('profile.persist')}
        <span className="muted">{persisted ? t('profile.persistGranted') : t('profile.persistDenied')}</span>
      </p>
      <p className="row">
        <Link to="/profile/gyms">{t('gyms.title')}</Link>
      </p>
      <p className="row">
        {t('profile.version')}
        <span className="muted">{__APP_VERSION__}</span>
      </p>
    </section>
  )
}
