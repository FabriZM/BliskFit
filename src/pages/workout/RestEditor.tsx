import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import NumInput from '../../components/NumInput'
import type { Exercise, SessionExercise, WorkoutSession } from '../../db/types'
import { clearExerciseRest, setExerciseRest, setSessionRest } from '../../db/workout'
import { formatClock } from '../../lib/units'
import { restFor } from '../../lib/workout'

const PRESETS = [30, 60, 90, 120, 180]

/** Change this exercise's rest time for the running workout only, or for it from now on. 0 = no rest timer. */
export default function RestEditor({ session, item, exercise, defaultRest, onClose }: {
  session: WorkoutSession; item: SessionExercise; exercise?: Exercise; defaultRest: number; onClose: () => void
}) {
  const { t } = useTranslation()
  const current = restFor(item, exercise, defaultRest)
  const [sec, setSec] = useState(current.sec)
  const ctx = { sessionId: session.id, itemId: item.id }
  const step = (d: number) => setSec((v) => Math.min(3600, Math.max(0, v + d)))
  const done = async (action: () => Promise<unknown>) => { await action(); onClose() }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={t('workout.restTimer')} onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>{t('workout.restTimer')}</h2>
        <p className="muted small">{exercise?.name} · {t('workout.restNow', { time: current.sec === 0 ? t('workout.restOff') : formatClock(current.sec * 1000) })} ({t(`workout.restSource_${current.source}`)})</p>

        <div className="rest-stepper">
          <button aria-label="−15" onClick={() => step(-15)}>−15</button>
          <label className="rest-field">
            <NumInput label={t('workout.restSeconds')} value={sec} min={0} max={3600} onCommit={(v) => v !== undefined && setSec(v)} />
            <span>{t('workout.secUnit')}</span>
          </label>
          <button aria-label="+15" onClick={() => step(15)}>+15</button>
        </div>
        <p className="muted small center">{sec === 0 ? t('workout.restOffHint') : formatClock(sec * 1000)}</p>
        <div className="chips center">
          {PRESETS.map((p) => (
            <button key={p} className={`chip${sec === p ? ' on' : ''}`} aria-pressed={sec === p} onClick={() => setSec(p)}>{formatClock(p * 1000)}</button>
          ))}
        </div>

        <button onClick={() => void done(() => setSessionRest(session.id, item.id, sec))}>{t('workout.restSessionOnly')}</button>
        <button className="primary" onClick={() => void done(() => setExerciseRest(item.exerciseId, sec, ctx))}>{t('workout.restFuture')}</button>
        <button className="link plain" onClick={() => void done(() => clearExerciseRest(item.exerciseId, ctx))}>{t('workout.restReset')}</button>
        <button onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </div>
  )
}
