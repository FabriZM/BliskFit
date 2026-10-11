import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { adjustRest, clearRest } from '../../db/workout'
import type { WorkoutSession } from '../../db/types'
import { formatClock } from '../../lib/units'
import { useNow } from '../../lib/useNow'

const R = 90
const C = 2 * Math.PI * R

/**
 * Full-screen countdown ring shown each time a rest starts. Dismissing it only hides the popup: the rest keeps
 * running in the card at the bottom (RestBar, which also owns the end-of-rest vibration and beep).
 */
export default function RestPopup({ session }: { session: WorkoutSession }) {
  const { t } = useTranslation()
  const now = useNow(250)
  const rest = session.rest
  const [shownFor, setShownFor] = useState<number | null>(null)

  // Open for a rest that just began; a rest already in progress when the page loads stays a card.
  useEffect(() => {
    if (rest && Date.now() - rest.startedAt < 3000) setShownFor(rest.startedAt)
  }, [rest?.startedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!rest || shownFor !== rest.startedAt) return null
  const remaining = rest.endsAt - now
  const over = remaining <= 0
  const frac = over ? 0 : Math.min(1, remaining / Math.max(1, rest.endsAt - rest.startedAt))
  const close = () => setShownFor(null)

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={t('workout.rest')} onClick={close}>
      <div className={`modal-card rest-card${over ? ' over' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="ring">
          <svg viewBox="0 0 200 200" aria-hidden>
            <circle cx="100" cy="100" r={R} className="ring-track" />
            <circle cx="100" cy="100" r={R} className="ring-fill" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform="translate(200 0) scale(-1 1) rotate(-90 100 100)" />
          </svg>
          <div className="ring-text" role="timer">
            <strong>{over ? t('workout.restOverShort') : formatClock(remaining)}</strong>
            <span>{t('workout.rest')}</span>
          </div>
        </div>
        <div className="rest-actions">
          <button onClick={() => void adjustRest(session.id, -15)}>−15</button>
          <button onClick={() => void adjustRest(session.id, 15)}>+15</button>
          <button onClick={() => { void clearRest(session.id); close() }}>{t('workout.skipRest')}</button>
        </div>
        <button className="primary" onClick={close}>{t('workout.dismiss')}</button>
      </div>
    </div>
  )
}
