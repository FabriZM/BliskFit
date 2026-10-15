import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchLatestRelease } from '../db/appUpdate'
import { platform } from '../lib/platform'
import { usePwaInstall } from '../lib/pwaInstall'
import { RELEASES_PAGE, type AppRelease } from '../lib/updates'

/** The web version opened in a browser on an Android phone (where the APK can be installed instead). */
export const isAndroidWeb = () => !platform.isNative && typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)

const DISMISSED = 'bliskfit.apkOfferDismissed'
const PWA_DISMISSED = 'bliskfit.pwaOfferDismissed'
const read = (key: string) => { try { return localStorage.getItem(key) === '1' } catch { return false } }
const remember = (key: string) => { try { localStorage.setItem(key, '1') } catch { /* ignore */ } }
const wasDismissed = () => read(DISMISSED)
const pwaWasDismissed = () => read(PWA_DISMISSED)

/** Latest release's APK link; the releases page until it's known (or if GitHub can't be reached). */
function useApkLink(enabled: boolean): { href: string; release?: AppRelease } {
  const [release, setRelease] = useState<AppRelease>()
  useEffect(() => { if (enabled) fetchLatestRelease().then(setRelease, () => undefined) }, [enabled])
  return { href: release?.apkUrl ?? RELEASES_PAGE, release }
}

/**
 * Android users of the web version: first a short bar offering the APK; once that's dismissed, the bar offering to
 * install the web app (PWA) instead, if the browser can. In Settings (`row`) the APK offer is always there.
 * The app gives on-time rest alerts with the screen locked and updates itself; its data is separate, so it
 * points to a backup for moving over.
 */
export default function AndroidAppOffer({ variant }: { variant: 'banner' | 'row' }) {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(() => variant === 'banner' && wasDismissed())
  const pwa = usePwaInstall()
  const [pwaHidden, setPwaHidden] = useState(() => variant === 'banner' && pwaWasDismissed())
  const showApk = isAndroidWeb() && !dismissed
  const { href, release } = useApkLink(isAndroidWeb() && (variant === 'row' || showApk))
  if (!isAndroidWeb()) return null

  const download = (
    <a className={variant === 'banner' ? 'btn' : 'btn primary-link'} href={href} rel="noopener">
      {variant === 'row' ? (release ? t('apk.downloadVersion', { version: release.version }) : t('apk.download')) : t('apk.get')}
    </a>
  )

  if (variant === 'row') {
    return (
      <>
        <div className="row">{t('apk.title')}{download}</div>
        <p className="muted small help">{t('apk.help')} <Link to="/profile/backup">{t('apk.moveData')}</Link></p>
      </>
    )
  }
  if (showApk) {
    return (
      <div className="update-banner apk-offer">
        <span>{t('apk.banner')}</span>
        <span className="apk-offer-actions">
          <button onClick={() => { remember(DISMISSED); setDismissed(true) }}>{t('apk.notNow')}</button>
          {download}
        </span>
      </div>
    )
  }
  if (pwa.canInstall && !pwaHidden) {
    return (
      <div className="update-banner apk-offer">
        <span>{t('apk.pwaBanner')}</span>
        <span className="apk-offer-actions">
          <button onClick={() => { remember(PWA_DISMISSED); setPwaHidden(true) }}>{t('apk.notNow')}</button>
          <button className="primary" onClick={() => void pwa.install()}>{t('apk.pwaInstall')}</button>
        </span>
      </div>
    )
  }
  return null
}
