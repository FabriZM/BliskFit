import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Exercise, SessionExercise, SetLog, Units, WorkoutSession } from '../../db/types'
import { addSet, completeSet, deleteSet, removeItem, setWarmups, toggleSkip, uncompleteSet, updateSet } from '../../db/workout'
import { primeAudio } from '../../lib/alerts'
import { formatSet } from '../../lib/format'
import type { GroupPos } from '../../lib/routines'
import { computePRs } from '../../lib/prs'
import { barWeight, isPlateLoaded, setUnit, usesWeight, weightUnitFor } from '../../lib/plates'
import { displayToKg, formatClock, kgToDisplay } from '../../lib/units'
import EquipmentSettings from '../../components/EquipmentSettings'
import { lastSetFor, pickLastTime, restFor, shouldStartRest, valuesOf } from '../../lib/workout'
import { WARMUP_REST_SEC, warmupSets } from '../../lib/warmup'
import { useStartingSuggestion } from './useStartingSuggestion'
import ExerciseNotes from './ExerciseNotes'
import PlateSheet from './PlateSheet'
import RestEditor from './RestEditor'
import SetRow from './SetRow'
import { BulbIcon, FlameIcon, MoreIcon, NoteIcon, SkipIcon, SlidersIcon, SwapIcon, TimerIcon, TrashIcon, UndoIcon } from '../../components/Icons'

export default function ExerciseCard({ session, item, exercise, sets, pos, units: appUnits, defaultRest, onSwap }: {
  session: WorkoutSession
  item: SessionExercise
  exercise?: Exercise
  sets: SetLog[]
  pos: GroupPos
  /** The app's units; the exercise's own unit wins for its weights. */
  units: Units
  defaultRest: number
  onSwap: () => void
}) {
  const { t } = useTranslation()
  const [menu, setMenu] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [addingNote, setAddingNote] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [editingRest, setEditingRest] = useState(false)
  const [editingEquipment, setEditingEquipment] = useState(false)
  const [platesFor, setPlatesFor] = useState<string | null>(null)
  const [dx, setDx] = useState(0)
  const drag = useRef<{ x: number; y: number; active: boolean } | null>(null)
  const tracking = exercise?.trackingType ?? 'weight_reps'
  // New sets are typed in the unit on this exercise's equipment (e.g. a machine in lb); every set keeps its own.
  const units = weightUnitFor(exercise, appUnits)
  const barOf = exercise && isPlateLoaded(exercise) ? (u: Units) => barWeight(exercise, u) : undefined
  const sorted = [...sets].sort((a, b) => a.order - b.order)
  const rest = restFor(item, exercise, defaultRest)
  const doneCount = sorted.filter((s) => s.doneAt !== undefined).length

  const last = useLiveQuery(async () => {
    const logs = await db.setLogs.where('exerciseId').equals(item.exerciseId).filter((x) => x.doneAt !== undefined).toArray()
    const ids = [...new Set(logs.map((x) => x.sessionId))]
    const sessions = new Map((await db.sessions.bulkGet(ids)).filter((x) => !!x).map((x) => [x!.id, x!]))
    return pickLastTime({ logs, sessions, gymId: session.gymId, excludeSessionId: session.id })
  }, [item.exerciseId, session.gymId, session.id])

  // Records are always recomputed from every done set of this exercise (history + this session), so undoing or
  // editing a set can never leave a stale badge.
  const allDone = useLiveQuery(() => db.setLogs.where('exerciseId').equals(item.exerciseId).filter((x) => x.doneAt !== undefined).toArray(), [item.exerciseId])
  const prs = useMemo(() => computePRs(allDone ?? [], tracking), [allDone, tracking])

  // Never done before (no done set in any workout): suggest a start from similar exercises that have history.
  const neverDone = allDone !== undefined && allDone.length === 0
  const targetReps = item.repMin && item.repMax ? Math.round((item.repMin + item.repMax) / 2) : item.repMin
  const suggestion = useStartingSuggestion(exercise, neverDone && !item.skipped, units, targetReps)
  const suggestedSet = useMemo(() => {
    if (!suggestion) return undefined
    const base = { weight: tracking === 'weight_reps' ? suggestion.weightKg : undefined, extraWeight: tracking === 'bodyweight_added' ? suggestion.weightKg : undefined, reps: suggestion.reps, durationSec: suggestion.durationSec }
    return { ...base, unit: base.weight !== undefined || base.extraWeight !== undefined ? units : undefined } as SetLog
  }, [suggestion, tracking, units])

  // Copying a set copies what was typed, unit included; sets from before units were kept were typed in the app's.
  const copyOf = (src: SetLog) => {
    const { unit, ...v } = valuesOf(src)
    return v.weight !== undefined || v.extraWeight !== undefined ? { ...v, unit: unit ?? appUnits } : v
  }

  // Index among non-warm-up sets: "set 2 last time" lines up with set 2 now.
  let w = 0
  const workingIdx = sorted.map((s) => (s.setType === 'warmup' ? -1 : w++))
  const labelOf = (s: SetLog, i: number) => (s.setType === 'warmup' ? 'W' : s.setType === 'drop' ? 'D' : String(workingIdx[i] + 1))
  const hintFor = (i: number) => (workingIdx[i] >= 0 ? lastSetFor(last, workingIdx[i]) ?? suggestedSet : undefined)
  const nextId = sorted.find((s) => s.doneAt === undefined)?.id
  // Warm-ups ramp up to the first working set (its weight, else the one it would be filled from), in its unit.
  // Offered until a working set is done; asking again replaces the warm-ups not done yet.
  const warmup = (() => {
    if (tracking !== 'weight_reps' && tracking !== 'bodyweight_added') return undefined
    const first = sorted.findIndex((s) => s.setType !== 'warmup')
    if (first < 0 || sorted.some((s) => s.setType !== 'warmup' && s.doneAt !== undefined)) return undefined
    const key = tracking === 'weight_reps' ? 'weight' : 'extraWeight'
    const hint = hintFor(first)
    const kg = sorted[first][key] ?? hint?.[key]
    if (kg === undefined) return undefined
    const unit = setUnit(sorted[first], units, hint)
    const plan = warmupSets({ tracking, mechanic: exercise?.mechanic, work: kgToDisplay(kg, unit), unit, bar: barOf?.(unit) })
    if (!plan.length) return undefined
    return { redo: sorted.some((s) => s.setType === 'warmup' && s.doneAt === undefined), add: () => void setWarmups(session.id, item.id, plan.map((w) => ({ [key]: displayToKg(w.weight, unit), unit, reps: w.reps }))) }
  })()
  const plateSet = sorted.findIndex((s) => s.id === platesFor)
  const plateUnit = plateSet >= 0 ? setUnit(sorted[plateSet], units, hintFor(plateSet)) : units

  const useSuggestion = () => {
    if (!suggestedSet) return
    sorted.forEach((s, i) => { if (s.doneAt === undefined && workingIdx[i] >= 0) void updateSet(s.id, copyOf(suggestedSet)) })
  }

  // Swipe either way to remove (confirmed). Only starts on non-interactive areas, and vertical scrolling wins.
  const SWIPE_AT = 100
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('input,button,select,textarea,label,a')) return
    drag.current = { x: e.clientX, y: e.clientY, active: false }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d) return
    const ddx = e.clientX - d.x, ddy = e.clientY - d.y
    if (!d.active) {
      if (Math.abs(ddy) > 10 && Math.abs(ddy) > Math.abs(ddx)) { drag.current = null; return }
      if (Math.abs(ddx) > 10) {
        d.active = true
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* pointer already gone */ }
      }
    }
    if (d.active) setDx(ddx)
  }
  const endSwipe = () => {
    if (drag.current?.active && Math.abs(dx) > SWIPE_AT) setConfirmRemove(true)
    drag.current = null
    setDx(0)
  }
  const cancelSwipe = () => { drag.current = null; setDx(0) }

  return (
    <li className={`rx ex-card${dx ? ' swiping' : ''} ${pos.pos !== 'single' ? 'grouped ' + pos.pos : ''}${item.skipped ? ' skipped' : ''}`}>
      <div className="swipe-bg" aria-hidden><TrashIcon /> {t('workout.removeExercise')}</div>
      <div className="swipe-body" style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : 'transform .2s' }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endSwipe} onPointerCancel={cancelSwipe}>
      {pos.pos === 'start' && <span className="group-tag">{pos.size > 2 ? t('routines.circuit') : t('routines.superset')} · {t('routines.sharedRest')}</span>}
      <div className="rx-head">
        {/* The exercise page's back button returns here (see ExerciseDetail). */}
        <Link className="rx-name" to={`/exercises/${encodeURIComponent(item.exerciseId)}`} state={{ back: '/workout' }}>{exercise?.name ?? '…'}</Link>
        <button className="icon" aria-expanded={menu} aria-label={t('workout.menu')} onClick={() => setMenu(!menu)}><MoreIcon /></button>
      </div>
      <p className="muted small meta">
        <button className="icon tiny" aria-label={t('workout.addNote')} title={t('workout.addNote')} onClick={() => setAddingNote(true)}><NoteIcon /></button>
        {item.targetSets} × {item.repMin ? (item.repMax && item.repMax !== item.repMin ? `${item.repMin}–${item.repMax}` : item.repMin) : '—'}
        {' · '}{t('workout.rest')} {rest.sec === 0 ? t('workout.restOff') : formatClock(rest.sec * 1000)}{rest.source === 'learned' ? ` (${t('workout.learned')})` : rest.source === 'custom' ? ` (${t('workout.custom')})` : ''}
        {item.skipped ? ` · ${t('workout.skipped')}` : ''}
      </p>

      {menu && (
        <div className="menu icons" role="menu">
          <button role="menuitem" title={t('workout.swap')} aria-label={t('workout.swap')} onClick={() => { onSwap(); setMenu(false) }}>
            <SwapIcon /><small>{t('workout.swapShort')}</small>
          </button>
          <button role="menuitem" title={t('workout.restTimer')} aria-label={t('workout.restTimer')} onClick={() => { setEditingRest(true); setMenu(false) }}>
            <TimerIcon /><small>{t('workout.restShort')}</small>
          </button>
          {exercise && usesWeight(tracking) && (
            <button role="menuitem" title={t('equipmentSettings.title')} aria-label={t('equipmentSettings.title')} onClick={() => { setEditingEquipment(true); setMenu(false) }}>
              <SlidersIcon /><small>{t('equipmentSettings.short')}</small>
            </button>
          )}
          <button role="menuitem" title={item.skipped ? t('workout.unskip') : t('workout.skip')} aria-label={item.skipped ? t('workout.unskip') : t('workout.skip')}
            onClick={() => { void toggleSkip(session.id, item.id); setMenu(false) }}>
            {item.skipped ? <UndoIcon /> : <SkipIcon />}<small>{item.skipped ? t('workout.unskip') : t('workout.skipShort')}</small>
          </button>
        </div>
      )}

      <ExerciseNotes exerciseId={item.exerciseId} gymId={session.gymId} adding={addingNote} onDoneAdding={() => setAddingNote(false)} />

      {!item.skipped && (
        <>
          {!last && suggestion && suggestedSet && (
            <div className="last-hint suggest">
              <span className="muted small">
                <BulbIcon /> {t('workout.suggested')}: {formatSet(suggestedSet, tracking, appUnits)}
                {' · '}{t('workout.basedOn', { names: suggestion.basedOn.slice(0, 2).map((b) => b.name).join(', ') })}
                {suggestion.confidence === 'rough' ? ` (${t('workout.rough')})` : ''}
              </span>
              <button onClick={useSuggestion}>{t('workout.useSuggestion')}</button>
            </div>
          )}
          <ul className="sets">
            {sorted.map((s, i) => (
              <SetRow key={s.id} set={s} tracking={tracking} units={units} label={labelOf(s, i)}
                hint={hintFor(i)} pr={prs.get(s.id)} next={s.id === nextId} barOf={barOf}
                onPlates={() => setPlatesFor(s.id)}
                expanded={expanded === s.id} previous={workingIdx[i] >= 0 ? lastSetFor(last, workingIdx[i]) : undefined}
                onToggle={() => setExpanded(expanded === s.id ? null : s.id)}
                onChange={(patch) => void updateSet(s.id, patch)}
                onDone={() => {
                  primeAudio()
                  // Between warm-ups a short rest; after the last one, the usual rest before the work.
                  const sec = s.setType === 'warmup' && sorted[i + 1]?.setType === 'warmup' ? Math.min(rest.sec, WARMUP_REST_SEC) : rest.sec
                  void completeSet(s.id, shouldStartRest(session.exercises, item.id) && sec > 0 ? sec : null)
                }}
                onUndo={() => void uncompleteSet(s.id)}
                onUseLast={() => { const src = workingIdx[i] >= 0 ? lastSetFor(last, workingIdx[i]) : undefined; if (src) void updateSet(s.id, copyOf(src)) }}
                onDelete={sorted.length > 1 ? () => void deleteSet(s.id) : undefined} />
            ))}
          </ul>
          <div className="set-adds">
            <button className="link" onClick={() => void addSet(session.id, item.id)}>+ {t('workout.addSet')}</button>
            {warmup && <button className="link" onClick={warmup.add}><FlameIcon /> {warmup.redo ? t('workout.redoWarmup') : t('workout.addWarmup')}</button>}
          </div>
        </>
      )}
      </div>
      {plateSet >= 0 && exercise && (
        <PlateSheet exercise={exercise} unit={plateUnit} onClose={() => setPlatesFor(null)}
          weight={(() => { const kg = sorted[plateSet].weight ?? hintFor(plateSet)?.weight; return kg === undefined ? undefined : kgToDisplay(kg, plateUnit) })()}
          onUse={(total) => void updateSet(sorted[plateSet].id, { weight: displayToKg(total, plateUnit), unit: plateUnit })} />
      )}
      {editingEquipment && exercise && (
        <div className="modal" role="dialog" aria-modal="true" aria-label={t('equipmentSettings.title')} onClick={() => setEditingEquipment(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>{t('equipmentSettings.title')}</h2>
            <p className="muted small">{exercise.name}</p>
            <EquipmentSettings exercise={exercise} />
            <button className="primary" onClick={() => setEditingEquipment(false)}>{t('common.done')}</button>
          </div>
        </div>
      )}
      {editingRest && <RestEditor session={session} item={item} exercise={exercise} defaultRest={defaultRest} onClose={() => setEditingRest(false)} />}
      {confirmRemove && (
        <div className="modal" role="alertdialog" aria-modal="true">
          <div className="modal-card">
            <h2>{t('workout.removeTitle', { name: exercise?.name ?? '' })}</h2>
            {doneCount > 0 && <p className="muted">{t('workout.removeBody', { count: doneCount })}</p>}
            <button className="danger" onClick={() => { void removeItem(session.id, item.id) }}>{t('workout.removeExercise')}</button>
            <button onClick={() => setConfirmRemove(false)}>{t('common.cancel')}</button>
          </div>
        </div>
      )}
    </li>
  )
}
