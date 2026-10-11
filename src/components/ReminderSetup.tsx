import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { platform } from '../lib/platform'
import { useNotificationState } from '../lib/platform/hooks'

const FLAG = 'exactAlarmPromptDismissed'
const wasDismissed = () => { try { return localStorage.getItem(FLAG) === '1' } catch { return false } }

/**
 * Android app only. Asks for notification permission when a workout starts, then (once) explains why exact
 * alarms matter: without that access Android may deliver "rest is over" minutes late.
 */
export default function ReminderSetup() {
  const { t } = useTranslation()
  const { permission, exact, request, openExactSettings } = useNotificationState()
  const [dismissed, setDismissed] = useState(wasDismissed)

  useEffect(() => {
    if (platform.isNative && permission === 'prompt') void request()
  }, [permission, request])

  if (!platform.isNative || permission !== 'granted' || exact !== 'denied' || dismissed) return null
  const dismiss = () => { try { localStorage.setItem(FLAG, '1') } catch { /* ignore */ } setDismissed(true) }
  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal-card">
        <h2>{t('reminders.exactTitle')}</h2>
        <p className="muted">{t('reminders.exactBody')}</p>
        <button className="primary" onClick={() => { void openExactSettings() }}>{t('reminders.openSettings')}</button>
        <button onClick={dismiss}>{t('reminders.notNow')}</button>
      </div>
    </div>
  )
}
