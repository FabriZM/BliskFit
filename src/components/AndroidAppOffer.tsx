import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchLatestRelease } from '../db/appUpdate'
import { platform } from '../lib/platform'
import { dismissOffer, installOptions, offerDismissed } from '../lib/installOptions'
import { usePwaInstall } from '../lib/pwaInstall'
import { RELEASES_PAGE, type AppRelease } from '../lib/updates'

/** The web version opened in a browser on an Android phone (where the APK can be installed instead). */
export const isAndroidWeb = () => !platform.isNative && typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)


/** Running as the installed web app (PWA): they already chose, so the bar stays away (Settings still has the row). */
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches === true

/** Latest release's APK link; the releases page until it's known (or if GitHub can't be reached). */
function useApkLink(enabled: boolean): { href: string; release?: AppRelease } {
  const [release, setRelease] = useState<AppRelease>()
  useEffect(() => { if (enabled) fetchLatestRelease().then(setRelease, () => undefined) }, [enabled])
  return { href: release?.apkUrl ?? RELEASES_PAGE, release }
}

/** The choice: Android app (APK) or web app (PWA), each with what it's good for. */
function ChoiceSheet({ href, onInstallPwa, onClose }: { href: string; onInstallPwa: () => void; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={t('apk.sheetTitle')} onClick={onClose}>
      <div className="modal-card install-sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{t('apk.sheetTitle')}</h2>
        <div className="install-choice">
          <strong>{t('apk.apkTitle')}</strong>
          <p className="muted small">{t('apk.apkDesc')}</p>
          <a className="btn" href={href} rel="noopener" onClick={onClose}>{t('apk.download')}</a>
        </div>
        <div className="install-choice">
          <strong>{t('apk.pwaTitle')}</strong>
          <p className="muted small">{t('apk.pwaDesc')}</p>
          <button className="primary" onClick={onInstallPwa}>{t('apk.install')}</button>
        </div>
        <p className="muted small help">{t('apk.dataNote')} <Link to="/profile/backup" onClick={onClose}>{t('apk.moveData')}</Link></p>
        <button onClick={onClose}>{t('common.close')}</button>
      </div>
    </div>
  )
}

/**
 * Android users of the web version get one short bar and one dismissal. With both options available, "Install" opens
 * a sheet to choose between the Android app (APK) and the web app (PWA); with only the APK, the bar links straight
 * to it. Settings (`row`) always offers the same choice. The Android app gives on-time rest alerts with the screen
 * locked and updates itself; each app keeps its own data, so the sheet points to a backup for moving over.
 */
export default function AndroidAppOffer({ variant }: { variant: 'banner' | 'row' }) {
  const { t } = useTranslation()
  const pwa = usePwaInstall()
  const options = installOptions({ androidWeb: isAndroidWeb(), canInstallPwa: pwa.canInstall })
  const [dismissed, setDismissed] = useState(() => variant === 'banner' && (offerDismissed(localStorage) || isStandalone()))
  const [open, setOpen] = useState(false)
  const { href, release } = useApkLink(options.length > 0 && (variant === 'row' || !dismissed))
  if (options.length === 0) return null
  const both = options.length === 2

  const installPwa = () => { setOpen(false); void pwa.install() }
  const sheet = open && <ChoiceSheet href={href} onInstallPwa={installPwa} onClose={() => setOpen(false)} />

  if (variant === 'row') {
    return (
      <>
        <div className="row">
          {t('apk.title')}
          {both
            ? <button className="primary" onClick={() => setOpen(true)}>{t('apk.install')}</button>
            : <a className="btn primary-link" href={href} rel="noopener">{release ? t('apk.downloadVersion', { version: release.version }) : t('apk.download')}</a>}
        </div>
        <p className="muted small help">{t('apk.help')} <Link to="/profile/backup">{t('apk.moveData')}</Link></p>
        {sheet}
      </>
    )
  }
  if (dismissed) return null
  return (
    <>
      <div className="update-banner apk-offer">
        <span>{both ? t('apk.banner') : t('apk.bannerApk')}</span>
        <span className="apk-offer-actions">
          <button onClick={() => { dismissOffer(localStorage); setDismissed(true) }}>{t('apk.notNow')}</button>
          {both
            ? <button className="primary" onClick={() => setOpen(true)}>{t('apk.install')}</button>
            : <a className="btn" href={href} rel="noopener">{t('apk.get')}</a>}
        </span>
      </div>
      {sheet}
    </>
  )
}
