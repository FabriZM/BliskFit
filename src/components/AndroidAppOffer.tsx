import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchLatestRelease } from '../db/appUpdate'
import { platform } from '../lib/platform'
import { RELEASES_PAGE, type AppRelease } from '../lib/updates'

/** The web version opened in a browser on an Android phone (where the APK can be installed instead). */
export const isAndroidWeb = () => !platform.isNative && typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)

const DISMISSED = 'bliskfit.apkOfferDismissed'
const wasDismissed = () => { try { return localStorage.getItem(DISMISSED) === '1' } catch { return false } }

/** Latest release's APK link; the releases page until it's known (or if GitHub can't be reached). */
function useApkLink(enabled: boolean): { href: string; release?: AppRelease } {
  const [release, setRelease] = useState<AppRelease>()
  useEffect(() => { if (enabled) fetchLatestRelease().then(setRelease, () => undefined) }, [enabled])
  return { href: release?.apkUrl ?? RELEASES_PAGE, release }
}

/**
 * "Get the Android app" for Android users of the web version: a dismissible bar at the top (`banner`) or a
 * row that's always there in Settings (`row`). The app gives on-time rest alerts with the screen locked and
 * updates itself; its data is separate, so it points to a backup for moving over.
 */
export default function AndroidAppOffer({ variant }: { variant: 'banner' | 'row' }) {
  const { t } = useTranslation()
  const [hidden, setHidden] = useState(() => variant === 'banner' && wasDismissed())
  const show = isAndroidWeb() && !hidden
  const { href, release } = useApkLink(show)
  if (!show) return null

  const download = (
    <a className={variant === 'banner' ? 'btn' : 'btn primary-link'} href={href} rel="noopener">
      {release ? t('apk.downloadVersion', { version: release.version }) : t('apk.download')}
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
  return (
    <div className="update-banner apk-offer">
      <span>{t('apk.banner')}</span>
      <span className="apk-offer-actions">
        <button onClick={() => { try { localStorage.setItem(DISMISSED, '1') } catch { /* ignore */ } setHidden(true) }}>{t('apk.notNow')}</button>
        {download}
      </span>
    </div>
  )
}
