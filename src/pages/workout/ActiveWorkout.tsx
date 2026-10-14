import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { db } from '../../db/db'
import type { Exercise, SetLog, WorkoutSession } from '../../db/types'
import {
  addExercisesToSession, discardSession, finishSession, moveItem, pause, resume, setGym, swapExercise, type SwapScope,
} from '../../db/workout'
import { groupPositions, routineUpdate, type RoutineChanges } from '../../lib/routines'
import { formatClock } from '../../lib/units'
import { useNotificationState } from '../../lib/platform/hooks'
import { useNow } from '../../lib/useNow'
import { useWakeLock } from '../../lib/useWakeLock'
import { elapsedMs, restDefaults } from '../../lib/workout'
import { useSettings } from '../../stores/settings'
import ExercisePicker from '../routines/ExercisePicker'
import ExerciseCard from './ExerciseCard'
import MuscleCounter from './MuscleCounter'
import RestBar from './RestBar'
import ReminderSetup from '../../components/ReminderSetup'
import RestPopup from './RestPopup'
import EmptyState from '../../components/EmptyState'
import { WorkoutIcon } from '../../components/TabIcons'
import { ChevronDownIcon, MoreIcon, PauseIcon } from '../../components/Icons'
import { useWorkoutView } from '../../stores/workoutView'
import { useExerciseName } from '../../lib/exerciseName'

export default function ActiveWorkout({ session }: { session: WorkoutSession }) {
  const { t } = useTranslation()
  const exName = useExerciseName()
  const nav = useNavigate()
  const settings = useSettings((s) => s.settings)
  const { units, restPopup } = settings
  const rests = restDefaults(settings)
  const now = useNow(1000)
  const [adding, setAdding] = useState(false)
  const [swapping, setSwapping] = useState<string | null>(null)
  const [swapTo, setSwapTo] = useState<Exercise | null>(null)
  const [menu, setMenu] = useState(false)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [routineChanges, setRoutineChanges] = useState<RoutineChanges | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const notif = useNotificationState()
  const minimize = useWorkoutView((s) => s.setCollapsed)
  useWakeLock(true)

  const sets = useLiveQuery(() => db.setLogs.where('sessionId').equals(session.id).toArray(), [session.id]) ?? []
  const gyms = useLiveQuery(() => db.gyms.toArray(), []) ?? []
  const routineName = useLiveQuery(() => (session.routineId ? db.routines.get(session.routineId) : undefined), [session.routineId])?.name ?? session.routineName
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

  const end = async (updateRoutine?: RoutineChanges) => {
    if (updateRoutine && session.routineId) await db.routines.update(session.routineId, { exercises: updateRoutine.exercises })
    await finishSession(session.id)
    nav(`/workout/summary/${session.id}`, { replace: true })
  }
  // A workout started from a routine whose plan changed on the way (order, exercises, sets) asks whether to keep that.
  const finish = async () => {
    const routine = session.routineId ? await db.routines.get(session.routineId) : undefined
    const changes = routine ? routineUpdate(routine, session.exercises, sets) : null
    if (changes) setRoutineChanges(changes)
    else await end()
  }
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) void moveItem(session.id, String(active.id), String(over.id))
  }
  const removedNames = useLiveQuery(async () => new Map((await db.exercises.bulkGet(routineChanges?.removed ?? [])).filter((e): e is Exercise => !!e).map((e) => [e.id, e.name])), [routineChanges])
  const nameOf = (exId: string) => (exMap.get(exId) ? exName(exMap.get(exId)) : removedNames?.get(exId) ?? '…')
  const doSwap = async (scope: SwapScope) => {
    if (swapping && swapTo) await swapExercise(session.id, swapping, swapTo, scope)
    setSwapping(null); setSwapTo(null)
  }

  return (
    <section className="workout">
      {/* Header and rest bar stay at the top, clear of the fields being typed in (and the keyboard). */}
      <div className="wk-top">
      <div className="wk-head">
        <div>
          <strong className="wk-timer" role="timer">{formatClock(elapsedMs(session, now))}</strong>
          <span className="muted small"> {paused ? <><PauseIcon /> {t('workout.paused')}</> : (routineName ?? t('workout.empty'))}</span>
        </div>
        <div className="wk-actions">
          <button className="icon" aria-label={t('workout.minimize')} title={t('workout.minimize')} onClick={() => minimize(true)}><ChevronDownIcon /></button>
          <button onClick={() => void (paused ? resume(session.id) : pause(session.id))}>{paused ? t('workout.resumeBtn') : t('workout.pause')}</button>
          <button className="primary" onClick={() => (doneCount ? void finish() : setConfirmFinish(true))}>{t('workout.finish')}</button>
          <button className="icon" aria-haspopup="dialog" aria-label={t('workout.options')} onClick={() => setMenu(true)}><MoreIcon /></button>
        </div>
      </div>
      <RestBar session={session} />
      </div>

      {menu && (
        <div className="modal" role="dialog" aria-modal="true" aria-label={t('workout.options')} onClick={() => setMenu(false)}>
          <div className="modal-card form" onClick={(e) => e.stopPropagation()}>
            <h2>{t('workout.options')}</h2>
            {gyms.length > 0 && (
              <label>{t('gyms.gym')}
                <select value={session.gymId ?? ''} onChange={(e) => void setGym(session.id, e.target.value || undefined)}>
                  <option value="">{t('workout.noGym')}</option>
                  {gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </label>
            )}
            {notif.permission === 'denied' && <p className="muted small">{t('workout.remindersDenied')}</p>}
            <button className="danger" onClick={() => { setMenu(false); setConfirmFinish(true) }}>{t('workout.discard')}</button>
            <button onClick={() => setMenu(false)}>{t('common.done')}</button>
          </div>
        </div>
      )}

      <MuscleCounter sets={sets} exercises={exMap} />

      {session.exercises.length === 0 && <EmptyState icon={<WorkoutIcon />}>{t('workout.emptyHint')}</EmptyState>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={session.exercises.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          <ul className="rx-list">
            {session.exercises.map((item, i) => (
              <ExerciseCard key={item.id} session={session} item={item} exercise={exMap.get(item.exerciseId)}
                sets={byItem.get(item.id) ?? []} pos={positions[i]}
                units={units} rests={rests} onSwap={() => setSwapping(item.id)} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <button className="primary wide" onClick={() => setAdding(true)}>+ {t('routines.addExercises')}</button>

      <ReminderSetup />
      {restPopup && <RestPopup session={session} />}

      {adding && <ExercisePicker onClose={() => setAdding(false)} onAdd={(exs) => { void addExercisesToSession(session.id, exs); setAdding(false) }} />}
      {swapping && !swapTo && <ExercisePicker single title={t('workout.swap')} onClose={() => setSwapping(null)}
        replacing={exMap.get(session.exercises.find((e) => e.id === swapping)?.exerciseId ?? '')}
        onAdd={(exs) => { if (!session.routineId) { void swapExercise(session.id, swapping, exs[0], 'session'); setSwapping(null) } else setSwapTo(exs[0]) }} />}
      {swapping && swapTo && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2>{t('workout.swapScope', { name: exName(swapTo) })}</h2>
            <button onClick={() => void doSwap('session')}>{t('workout.scopeSession')}</button>
            <button onClick={() => void doSwap('routine')}>{t('workout.scopeRoutine')}</button>
            <button onClick={() => void doSwap('all')}>{t('workout.scopeAll')}</button>
            <button onClick={() => { setSwapping(null); setSwapTo(null) }}>{t('common.cancel')}</button>
          </div>
        </div>
      )}
      {routineChanges && (
        <div className="modal" role="dialog" aria-modal="true" aria-label={t('workout.updateRoutineTitle', { name: routineName ?? '' })}>
          <div className="modal-card">
            <h2>{t('workout.updateRoutineTitle', { name: routineName ?? '' })}</h2>
            <p className="muted">{t('workout.updateRoutineBody')}</p>
            <ul className="change-list">
              {routineChanges.reordered && <li>{t('workout.changeOrder')}</li>}
              {routineChanges.added.map((x, i) => <li key={`a${i}`}>{t('workout.changeAdded', { name: nameOf(x) })}</li>)}
              {routineChanges.removed.map((x, i) => <li key={`r${i}`}>{t('workout.changeRemoved', { name: nameOf(x) })}</li>)}
              {routineChanges.sets.map((c, i) => <li key={`s${i}`}>{t('workout.changeSets', { name: nameOf(c.exerciseId), from: c.from, to: c.to })}</li>)}
            </ul>
            <button className="primary" onClick={() => void end(routineChanges)}>{t('workout.updateRoutine')}</button>
            <button onClick={() => void end()}>{t('workout.keepRoutine')}</button>
            <button className="link plain" onClick={() => setRoutineChanges(null)}>{t('workout.keepGoing')}</button>
          </div>
        </div>
      )}
      {confirmFinish && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2>{doneCount ? t('workout.discard') : t('workout.noSetsTitle')}</h2>
            <p className="muted">{doneCount ? t('workout.confirmDiscard') : t('workout.noSetsBody')}</p>
            <button className="danger" onClick={async () => { await discardSession(session.id); nav('/workout', { replace: true }) }}>{t('workout.discard')}</button>
            <button onClick={() => setConfirmFinish(false)}>{t('workout.keepGoing')}</button>
          </div>
        </div>
      )}
    </section>
  )
}
