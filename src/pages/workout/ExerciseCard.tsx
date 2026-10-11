import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Exercise, SessionExercise, SetLog, Units, WorkoutSession } from '../../db/types'
import { addSet, completeSet, deleteSet, removeItem, toggleSkip, uncompleteSet, updateSet } from '../../db/workout'
import { primeAudio } from '../../lib/alerts'
import { formatSet } from '../../lib/format'
import type { GroupPos } from '../../lib/routines'
import { computePRs } from '../../lib/prs'
import { formatClock } from '../../lib/units'
import { lastSetFor, pickLastTime, restFor, shouldStartRest, valuesOf } from '../../lib/workout'
import { useStartingSuggestion } from './useStartingSuggestion'
import ExerciseNotes from './ExerciseNotes'
import SetRow from './SetRow'

export default function ExerciseCard({ session, item, exercise, sets, pos, units, defaultRest, onSwap }: {
  session: WorkoutSession
  item: SessionExercise
  exercise?: Exercise
  sets: SetLog[]
  pos: GroupPos
  units: Units
  defaultRest: number
  onSwap: () => void
}) {
  const { t, i18n } = useTranslation()
  const [menu, setMenu] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [addingNote, setAddingNote] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [dx, setDx] = useState(0)
  const drag = useRef<{ x: number; y: number; active: boolean } | null>(null)
  const tracking = exercise?.trackingType ?? 'weight_reps'
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
    return base as SetLog
  }, [suggestion, tracking])

  // Index among non-warm-up sets: "set 2 last time" lines up with set 2 now.
  let w = 0
  const workingIdx = sorted.map((s) => (s.setType === 'warmup' ? -1 : w++))
  const labelOf = (s: SetLog, i: number) => (s.setType === 'warmup' ? 'W' : s.setType === 'drop' ? 'D' : String(workingIdx[i] + 1))

  const useSuggestion = () => {
    if (!suggestedSet) return
    sorted.forEach((s, i) => { if (s.doneAt === undefined && workingIdx[i] >= 0) void updateSet(s.id, valuesOf(suggestedSet)) })
  }

  const useLast = () => {
    sorted.forEach((s, i) => {
      const src = lastSetFor(last, workingIdx[i])
      if (src && s.doneAt === undefined && workingIdx[i] >= 0) void updateSet(s.id, valuesOf(src))
    })
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
      <div className="swipe-bg" aria-hidden>🗑 {t('workout.removeExercise')}</div>
      <div className="swipe-body" style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : 'transform .2s' }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endSwipe} onPointerCancel={cancelSwipe}>
      {pos.pos === 'start' && <span className="group-tag">{pos.size > 2 ? t('routines.circuit') : t('routines.superset')} · {t('routines.sharedRest')}</span>}
      <div className="rx-head">
        <strong className="rx-name">{exercise?.name ?? '…'}</strong>
        <button className="icon" aria-expanded={menu} aria-label={t('workout.menu')} onClick={() => setMenu(!menu)}>⋯</button>
      </div>
      <p className="muted small meta">
        <button className="icon tiny" aria-label={t('workout.addNote')} title={t('workout.addNote')} onClick={() => setAddingNote(true)}>📝</button>
        {item.targetSets} × {item.repMin ? (item.repMax && item.repMax !== item.repMin ? `${item.repMin}–${item.repMax}` : item.repMin) : '—'}
        {' · '}{t('workout.rest')} {formatClock(rest.sec * 1000)}{rest.source === 'learned' ? ` (${t('workout.learned')})` : ''}
        {item.skipped ? ` · ${t('workout.skipped')}` : ''}
      </p>

      {menu && (
        <div className="menu icons" role="menu">
          <button role="menuitem" title={t('workout.swap')} aria-label={t('workout.swap')} onClick={() => { onSwap(); setMenu(false) }}>
            <span aria-hidden>🔄</span><small>{t('workout.swapShort')}</small>
          </button>
          <button role="menuitem" title={item.skipped ? t('workout.unskip') : t('workout.skip')} aria-label={item.skipped ? t('workout.unskip') : t('workout.skip')}
            onClick={() => { void toggleSkip(session.id, item.id); setMenu(false) }}>
            <span aria-hidden>{item.skipped ? '↩️' : '⏭️'}</span><small>{item.skipped ? t('workout.unskip') : t('workout.skipShort')}</small>
          </button>
        </div>
      )}

      <ExerciseNotes exerciseId={item.exerciseId} gymId={session.gymId} adding={addingNote} onDoneAdding={() => setAddingNote(false)} />

      {!item.skipped && (
        <>
          {last && (
            <div className="last-hint">
              <span className="muted small">
                {t('workout.lastTime', { date: new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric' }).format(last.startedAt) })}
                {session.gymId && !last.gymMatched ? ` · ${t('workout.otherGym')}` : ''}
                {': '}{last.sets.map((s) => formatSet(s, tracking, units)).join(' · ')}
              </span>
              <button onClick={useLast}>{t('workout.useLast')}</button>
            </div>
          )}
          {!last && suggestion && suggestedSet && (
            <div className="last-hint suggest">
              <span className="muted small">
                💡 {t('workout.suggested')}: {formatSet(suggestedSet, tracking, units)}
                {' · '}{t('workout.basedOn', { names: suggestion.basedOn.slice(0, 2).map((b) => b.name).join(', ') })}
                {suggestion.confidence === 'rough' ? ` (${t('workout.rough')})` : ''}
              </span>
              <button onClick={useSuggestion}>{t('workout.useSuggestion')}</button>
            </div>
          )}
          <ul className="sets">
            {sorted.map((s, i) => (
              <SetRow key={s.id} set={s} tracking={tracking} units={units} label={labelOf(s, i)}
                hint={workingIdx[i] >= 0 ? lastSetFor(last, workingIdx[i]) ?? suggestedSet : undefined} pr={prs.get(s.id)}
                expanded={expanded === s.id} canRepeat={i > 0} canUseLast={!!(lastSetFor(last, workingIdx[i]) ?? suggestedSet) && workingIdx[i] >= 0}
                onToggle={() => setExpanded(expanded === s.id ? null : s.id)}
                onChange={(patch) => void updateSet(s.id, patch)}
                onDone={() => { primeAudio(); void completeSet(s.id, shouldStartRest(session.exercises, item.id) ? rest.sec : null) }}
                onUndo={() => void uncompleteSet(s.id)}
                onRepeat={() => void updateSet(s.id, valuesOf(sorted[i - 1]))}
                onUseLast={() => { const src = lastSetFor(last, workingIdx[i]) ?? suggestedSet; if (src) void updateSet(s.id, valuesOf(src)) }}
                onDelete={() => void deleteSet(s.id)} />
            ))}
          </ul>
          <button className="link" onClick={() => void addSet(session.id, item.id)}>+ {t('workout.addSet')}</button>
        </>
      )}
      </div>
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
