import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import NumInput from '../../components/NumInput'
import type { Exercise, SessionExercise, WorkoutSession } from '../../db/types'
import { clearExerciseRest, setExerciseRest, setSessionRest } from '../../db/workout'
import { restFor, type RestKind, type RestTimes } from '../../lib/workout'
import { useExerciseName } from '../../lib/exerciseName'

const KINDS: RestKind[] = ['working', 'drop', 'warmup']

/**
 * This exercise's rest timers, by the kind of set coming next (to-failure sets use the working one), for the
 * running workout only or from now on. 0 = no timer.
 */
export default function RestEditor({ session, item, exercise, rests, onClose }: {
  session: WorkoutSession; item: SessionExercise; exercise?: Exercise; rests: RestTimes; onClose: () => void
}) {
  const { t } = useTranslation()
  const exName = useExerciseName()
  const [sec, setSec] = useState<RestTimes>(() => ({
    working: restFor(item, exercise, rests, 'working').sec,
    drop: restFor(item, exercise, rests, 'drop').sec,
    warmup: restFor(item, exercise, rests, 'warmup').sec,
  }))
  const set = (k: RestKind, v: number) => setSec((s) => ({ ...s, [k]: Math.min(3600, Math.max(0, v)) }))
  const ctx = { sessionId: session.id, itemId: item.id }
  const done = async (action: () => Promise<unknown>) => { await action(); onClose() }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={t('workout.restTimer')} onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>{t('workout.restTimer')}</h2>
        <p className="muted small">{exName(exercise, '')}</p>

        <div className="rest-kinds">
          {KINDS.map((k) => (
            <div key={k} className="rest-kind">
              <span className="rest-kind-name">{t(`workout.restKind.${k}`)}</span>
              <button aria-label={`${t(`workout.restKind.${k}`)} −15`} onClick={() => set(k, sec[k] - 15)}>−15</button>
              <label className="rest-field">
                <NumInput label={`${t(`workout.restKind.${k}`)} (${t('workout.secUnit')})`} value={sec[k]} min={0} max={3600} onCommit={(v) => v !== undefined && set(k, v)} />
                <span>{sec[k] === 0 ? t('workout.restOff') : t('workout.secUnit')}</span>
              </label>
              <button aria-label={`${t(`workout.restKind.${k}`)} +15`} onClick={() => set(k, sec[k] + 15)}>+15</button>
            </div>
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
