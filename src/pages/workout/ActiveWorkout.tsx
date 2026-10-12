import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Exercise, SetLog, WorkoutSession } from '../../db/types'
import {
  addExercisesToSession, discardSession, finishSession, pause, resume, setGym, swapExercise, type SwapScope,
} from '../../db/workout'
import { groupPositions } from '../../lib/routines'
import { formatClock } from '../../lib/units'
import { useNotificationState } from '../../lib/platform/hooks'
import { useNow } from '../../lib/useNow'
import { useWakeLock } from '../../lib/useWakeLock'
import { elapsedMs } from '../../lib/workout'
import { useSettings } from '../../stores/settings'
import ExercisePicker from '../routines/ExercisePicker'
import ExerciseCard from './ExerciseCard'
import MuscleCounter from './MuscleCounter'
import RestBar from './RestBar'
import ReminderSetup from '../../components/ReminderSetup'
import RestPopup from './RestPopup'
import EmptyState from '../../components/EmptyState'
import { WorkoutIcon } from '../../components/TabIcons'
import { MoreIcon, PauseIcon } from '../../components/Icons'

export default function ActiveWorkout({ session }: { session: WorkoutSession }) {
  const { t } = useTranslation()
  const nav = useNavigate()
  const { units, defaultRestSec, restPopup } = useSettings((s) => s.settings)
  const now = useNow(1000)
  const [adding, setAdding] = useState(false)
  const [swapping, setSwapping] = useState<string | null>(null)
  const [swapTo, setSwapTo] = useState<Exercise | null>(null)
  const [menu, setMenu] = useState(false)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const notif = useNotificationState()
  useWakeLock(true)

  const sets = useLiveQuery(() => db.setLogs.where('sessionId').equals(session.id).toArray(), [session.id]) ?? []
  const gyms = useLiveQuery(() => db.gyms.toArray(), []) ?? []
  const routineName = useLiveQuery(() => (session.routineId ? db.routines.get(session.routineId) : undefined), [session.routineId])?.name
  const exIds = session.exercises.map((e) => e.exerciseId).join('|')
  const exercises = useLiveQuery(async () => new Map((await db.exercises.bulkGet([...new Set(session.exercises.map((e) => e.exerciseId))])).filter((e): e is Exercise => !!e).map((e) => [e.id, e])), [exIds])
  const exMap = exercises ?? new Map<string, Exercise>()

  const byItem = useMemo(() => {
    const m = new Map<string, SetLog[]>()
    for (const s of sets) m.set(s.itemId ?? '', [...(m.get(s.itemId ?? '') ?? []), s])
    return m
  }, [sets])
  const positions = groupPositions(session.exercises)
  const paused = session.status === 'paused'
  const doneCount = sets.filter((s) => s.doneAt !== undefined).length

  const finish = async () => { await finishSession(session.id); nav(`/workout/summary/${session.id}`, { replace: true }) }
  const doSwap = async (scope: SwapScope) => {
    if (swapping && swapTo) await swapExercise(session.id, swapping, swapTo, scope)
    setSwapping(null); setSwapTo(null)
  }

  return (
    <section className="workout">
      <div className="wk-head">
        <div>
          <strong className="wk-timer" role="timer">{formatClock(elapsedMs(session, now))}</strong>
          <span className="muted small"> {paused ? <><PauseIcon /> {t('workout.paused')}</> : (routineName ?? t('workout.empty'))}</span>
        </div>
        <div className="wk-actions">
          <button onClick={() => void (paused ? resume(session.id) : pause(session.id))}>{paused ? t('workout.resumeBtn') : t('workout.pause')}</button>
          <button className="primary" onClick={() => (doneCount ? void finish() : setConfirmFinish(true))}>{t('workout.finish')}</button>
          <button className="icon" aria-expanded={menu} aria-label={t('workout.menu')} onClick={() => setMenu(!menu)}><MoreIcon /></button>
        </div>
      </div>

      {menu && (
        <div className="menu">
          {gyms.length > 0 && (
            <label>{t('gyms.gym')}
              <select value={session.gymId ?? ''} onChange={(e) => void setGym(session.id, e.target.value || undefined)}>
                <option value="">{t('workout.noGym')}</option>
                {gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
          )}
          {notif.permission === 'denied' && <span className="muted small">{t('workout.remindersDenied')}</span>}
          <button className="danger" onClick={() => setConfirmFinish(true)}>{t('workout.discard')}</button>
        </div>
      )}

      <MuscleCounter sets={sets} exercises={exMap} />

      {session.exercises.length === 0 && <EmptyState icon={<WorkoutIcon />}>{t('workout.emptyHint')}</EmptyState>}
      <ul className="rx-list">
        {session.exercises.map((item, i) => (
          <ExerciseCard key={item.id} session={session} item={item} exercise={exMap.get(item.exerciseId)}
            sets={byItem.get(item.id) ?? []} pos={positions[i]}
            units={units} defaultRest={defaultRestSec} onSwap={() => setSwapping(item.id)} />
        ))}
      </ul>
      <button className="primary wide" onClick={() => setAdding(true)}>+ {t('routines.addExercises')}</button>

      <ReminderSetup />
      <RestBar session={session} />
      {restPopup && <RestPopup session={session} />}

      {adding && <ExercisePicker onClose={() => setAdding(false)} onAdd={(exs) => { void addExercisesToSession(session.id, exs); setAdding(false) }} />}
      {swapping && !swapTo && <ExercisePicker single title={t('workout.swap')} onClose={() => setSwapping(null)}
        onAdd={(exs) => { if (!session.routineId) { void swapExercise(session.id, swapping, exs[0], 'session'); setSwapping(null) } else setSwapTo(exs[0]) }} />}
      {swapping && swapTo && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2>{t('workout.swapScope', { name: swapTo.name })}</h2>
            <button onClick={() => void doSwap('session')}>{t('workout.scopeSession')}</button>
            <button onClick={() => void doSwap('routine')}>{t('workout.scopeRoutine')}</button>
            <button onClick={() => void doSwap('all')}>{t('workout.scopeAll')}</button>
            <button onClick={() => { setSwapping(null); setSwapTo(null) }}>{t('common.cancel')}</button>
          </div>
        </div>
      )}
      {confirmFinish && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2>{doneCount ? t('workout.discard') : t('workout.noSetsTitle')}</h2>
            <p className="muted">{doneCount ? t('workout.confirmDiscard') : t('workout.noSetsBody')}</p>
            <button className="danger" onClick={async () => { await discardSession(session.id); nav('/workout', { replace: true }) }}>{t('workout.discard')}</button>
            <button onClick={() => { setConfirmFinish(false); setMenu(false) }}>{t('workout.keepGoing')}</button>
          </div>
        </div>
      )}
    </section>
  )
}
