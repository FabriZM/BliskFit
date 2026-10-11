import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { getActiveSession } from '../db/workout'
import { formatClock } from '../lib/units'
import { useNow } from '../lib/useNow'
import { elapsedMs } from '../lib/workout'

/** Sits above the tab bar on every screen except the workout itself, so a running session is never out of sight. */
export default function InProgressBar() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const now = useNow(1000)
  const state = useLiveQuery(async () => ({ session: await getActiveSession() }), [])
  const session = state?.session
  if (!session || pathname === '/workout') return null
  const paused = session.status === 'paused'
  return (
    <Link to="/workout" className="inprogress">
      <span><span className={`dot${paused ? ' paused' : ''}`} aria-hidden /> {paused ? t('workout.paused') : t('workout.inProgress')}</span>
      <strong role="timer">{formatClock(elapsedMs(session, now))}</strong>
      <span>{t('workout.resumeBtn')} ›</span>
    </Link>
  )
}
