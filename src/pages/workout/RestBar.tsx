import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { adjustRest, clearRest } from '../../db/workout'
import type { WorkoutSession } from '../../db/types'
import { beep, vibrate } from '../../lib/alerts'
import { platform } from '../../lib/platform'
import { useNotificationState } from '../../lib/platform/hooks'
import { formatClock } from '../../lib/units'
import { useNow } from '../../lib/useNow'
import BasiliskEye from '../../components/BasiliskEye'

/** Seconds left at which the rest buzzes a short warning. */
const REST_WARN_SECS = [10, 3, 2, 1]

/**
 * Rest countdown in the workout's sticky header, derived from stored timestamps; the fill drains from right to left.
 * It vibrates and beeps once when it reaches zero. The basilisk's
 * pupil narrows from round to a slit as rest runs out: at zero the gaze is locked, time to lift.
 */
export default function RestBar({ session }: { session: WorkoutSession }) {
  const { t } = useTranslation()
  const now = useNow(250)
  const rest = session.rest
  const alerted = useRef<number | null>(null)
  // In the Android app the scheduled notification already sounds and vibrates, so don't double up.
  const { permission } = useNotificationState()
  const osAlerts = platform.isNative && permission === 'granted'
  const remaining = rest ? rest.endsAt - now : 0

  useEffect(() => {
    // Only alert for a timer that ends while we're looking; never replay one that expired while away.
    if (rest && remaining <= 0 && alerted.current !== rest.endsAt) {
      if (now - rest.endsAt < 5000 && !osAlerts) { vibrate(); beep() }
      alerted.current = rest.endsAt
    }
  }, [rest, remaining, now, osAlerts])

  // Short pulses as the rest runs out (the Android app's countdown service does the same with the app in the background).
  const secsLeft = rest ? Math.ceil(remaining / 1000) : 0
  const warned = useRef<{ endsAt: number; secs: number } | null>(null)
  useEffect(() => {
    if (!rest || osAlerts || secsLeft <= 0 || !REST_WARN_SECS.includes(secsLeft)) return
    // Once per second mark; adding time (+15) moves endsAt, so the marks fire again on the way down.
    if (warned.current?.endsAt === rest.endsAt && warned.current.secs === secsLeft) return
    warned.current = { endsAt: rest.endsAt, secs: secsLeft }
    vibrate([80])
  }, [rest, osAlerts, secsLeft])

  if (!rest) return null
  const over = remaining <= 0
  const total = Math.max(1, rest.endsAt - rest.startedAt)
  return (
    <div className={`restbar${over ? ' over' : ''}`} role="timer" aria-live="off">
      <div className="restbar-fill" style={{ width: `${Math.min(100, Math.max(0, (remaining / total) * 100))}%` }} />
      <button onClick={() => void adjustRest(session.id, -15)}>−15</button>
      <strong><BasiliskEye className="rest-eye" size={22} pupil={over ? 0 : remaining / total} />{over ? t('workout.restOver') : `${t('workout.rest')} ${formatClock(remaining)}`}</strong>
      <button onClick={() => void adjustRest(session.id, 15)}>+15</button>
      <button onClick={() => void clearRest(session.id)}>{over ? t('common.close') : t('workout.skipRest')}</button>
    </div>
  )
}
