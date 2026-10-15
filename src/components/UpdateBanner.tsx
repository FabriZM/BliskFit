import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppUpdate } from '../db/appUpdate'
import type { AppRelease } from '../lib/updates'

/** Install flow shared by the launch banner and Settings: backup first, ask if that fails. */
export function useInstall() {
  const { t } = useTranslation()
  const u = useAppUpdate()
  const [busy, setBusy] = useState(false)
  const install = async (r: AppRelease) => {
    setBusy(true)
    try { await u.install(r) } catch {
      if (confirm(t('updates.backupFailed'))) u.openDownload(r)
    } finally { setBusy(false) }
  }
  return { install, busy }
}

/** Android app only: offers a newer release found by the hourly check. "Later" hides it until the next launch. */
export default function UpdateBanner() {
  const { t } = useTranslation()
  const { available } = useAppUpdate(true)
  const { install, busy } = useInstall()
  const [hidden, setHidden] = useState(false)
  if (!available || hidden) return null
  return (
    <div className="update-banner">
      <span>{t('updates.available', { version: available.version })}</span>
      <span>
        <button onClick={() => setHidden(true)}>{t('updates.later')}</button>{' '}
        <button className="primary" disabled={busy} onClick={() => void install(available)}>{t('updates.update')}</button>
      </span>
    </div>
  )
}
