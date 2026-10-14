import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { platform } from '../lib/platform'

/**
 * iPhone/iPad: web apps can't offer an install button there; the only way is Share → "Add to Home Screen", which
 * people don't find. This explains it, for the browser they're in. Note that a Home Screen app gets its own
 * storage, separate from Safari, so it's worth doing before logging anything.
 */
type IosBrowser = 'safari' | 'other' | 'inApp'

const ua = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent)
/** iPadOS reports itself as a Mac, so also check for touch. */
const isIos = () => /iPhone|iPad|iPod/.test(ua()) || (/Macintosh/.test(ua()) && navigator.maxTouchPoints > 1)
const isInstalled = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

/** In-app browsers (Instagram, Facebook, Google app...) have no "Add to Home Screen"; Chrome/Edge/Firefox do (iOS 16.4+). */
export function iosBrowser(userAgent: string): IosBrowser {
  if (/FBAN|FBAV|Instagram|Line\/|GSA\/|Snapchat|TikTok|musical_ly|LinkedInApp|Twitter/i.test(userAgent)) return 'inApp'
  if (/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(userAgent)) return 'other'
  return 'safari'
}

export const showIosInstall = () => !platform.isNative && isIos() && !isInstalled()

const DISMISSED = 'bliskfit.iosInstallDismissed'
const wasDismissed = () => { try { return localStorage.getItem(DISMISSED) === '1' } catch { return false } }

const ShareIcon = () => (
  <svg className="ios-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12M8 7l4-4 4 4" /><path d="M7 10H5.5A1.5 1.5 0 0 0 4 11.5v8A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H17" />
  </svg>
)
const AddIcon = () => (
  <svg className="ios-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M12 8v8M8 12h8" />
  </svg>
)

/** The steps for this browser. */
function Steps() {
  const { t } = useTranslation()
  const browser = iosBrowser(ua())
  const [copied, setCopied] = useState(false)
  if (browser === 'inApp') {
    return (
      <div className="ios-steps">
        <p>{t('ios.inApp')}</p>
        <button onClick={() => void navigator.clipboard?.writeText(location.href).then(() => setCopied(true), () => undefined)}>
          {copied ? t('ios.copied') : t('ios.copyLink')}
        </button>
      </div>
    )
  }
  return (
    <ol className="ios-steps">
      <li>{t(browser === 'safari' ? 'ios.step1Safari' : 'ios.step1Other')} <ShareIcon /></li>
      <li>{t('ios.step2')} <AddIcon /></li>
      <li>{t('ios.step3')}</li>
      <li className="muted small">{t('ios.dataNote')} <Link to="/profile/backup">{t('ios.moveData')}</Link></li>
    </ol>
  )
}

/**
 * "Install on your iPhone": a bar at the top that opens the steps and can be dismissed (`banner`), or a row in
 * Settings that's always there (`row`). Shown only on iPhone/iPad, in the browser, before it's installed.
 */
export default function IosInstall({ variant }: { variant: 'banner' | 'row' }) {
  const { t } = useTranslation()
  const [hidden, setHidden] = useState(() => variant === 'banner' && wasDismissed())
  const [open, setOpen] = useState(false)
  if (!showIosInstall() || hidden) return null

  if (variant === 'row') {
    return (
      <>
        <div className="row">{t('ios.title')}<button onClick={() => setOpen(!open)}>{open ? t('common.close') : t('ios.how')}</button></div>
        {open && <Steps />}
      </>
    )
  }
  return (
    <div className="update-banner ios-install">
      <span>{t('ios.banner')}</span>
      <span className="ios-install-actions">
        <button onClick={() => { try { localStorage.setItem(DISMISSED, '1') } catch { /* ignore */ } setHidden(true) }}>{t('ios.notNow')}</button>
        <button className="primary" onClick={() => setOpen(!open)}>{open ? t('common.close') : t('ios.how')}</button>
      </span>
      {open && <Steps />}
    </div>
  )
}
