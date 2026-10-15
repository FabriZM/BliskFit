import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db, newId } from '../../db/db'
import type { Exercise, Routine, RoutineExercise } from '../../db/types'
import {
  addExercises, groupPositions, linkWithNext, moveExercise, removeExercise, setRepRange, setRest, unlinkFromNext,
} from '../../lib/routines'
import { useSettings } from '../../stores/settings'
import NumInput from '../../components/NumInput'
import ExercisePicker from './ExercisePicker'
import { BackLink } from '../../components/PageHeader'
import EmptyState from '../../components/EmptyState'
import { ExercisesIcon } from '../../components/TabIcons'
import { CloseIcon, GripIcon, LinkIcon } from '../../components/Icons'
import { useExerciseName } from '../../lib/exerciseName'
import { useDraftGuard } from '../../lib/useDraftGuard'
import { useRoutineDraft } from '../../stores/routineDraft'

interface RowProps {
  item: RoutineExercise
  exercise?: Exercise
  pos: ReturnType<typeof groupPositions>[number]
  canLink: boolean
  /** Where the exercise page's back button returns to (a new routine's draft is kept for it). */
  backTo: string
  defaultRest: number
  onChange: (next: RoutineExercise) => void
  onRest: (v: number | undefined) => void
  onRemove: () => void
  onToggleLink: () => void
}

function Row({ backTo, item, exercise, pos, canLink, defaultRest, onChange, onRest, onRemove, onToggleLink }: RowProps) {
  const { t } = useTranslation()
  const exName = useExerciseName()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const hasReps = exercise ? !['duration', 'cardio'].includes(exercise.trackingType) : true
  const grouped = pos.pos !== 'single'
  const linkedToNext = pos.pos === 'start' || pos.pos === 'middle'
  return (
    <li ref={setNodeRef} className={`rx ${grouped ? 'grouped ' + pos.pos : ''}${isDragging ? ' dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}>
      {pos.pos === 'start' && <span className="group-tag">{pos.size > 2 ? t('routines.circuit') : t('routines.superset')} · {t('routines.sharedRest')}</span>}
      <div className="rx-head">
        <button className="handle" aria-label={t('routines.drag')} {...attributes} {...listeners}><GripIcon /></button>
        {/* The exercise page's back button returns here (see ExerciseDetail). */}
        <Link className="rx-name" to={`/exercises/${encodeURIComponent(item.exerciseId)}`} state={{ back: backTo }}>{exName(exercise)}</Link>
        <button className="icon" aria-label={t('common.delete')} onClick={onRemove}><CloseIcon /></button>
      </div>
      <div className="rx-fields">
        <label>{t('routines.sets')}
          <NumInput label={t('routines.sets')} value={item.targetSets} min={1} max={50} onCommit={(v) => v && onChange({ ...item, targetSets: v })} />
        </label>
        {hasReps && (
          <label>{t('routines.reps')}
            <span className="range">
              <NumInput label={t('routines.repMin')} value={item.repMin} min={1} max={999} allowEmpty
                onCommit={(v) => onChange(setRepRange(item, { repMin: v }))} />–
              <NumInput label={t('routines.repMax')} value={item.repMax} min={1} max={999} allowEmpty
                onCommit={(v) => onChange(setRepRange(item, { repMax: v }))} />
            </span>
          </label>
        )}
        <label>{t('routines.rest')}
          <NumInput label={t('routines.rest')} value={item.restSec} min={0} max={3600} allowEmpty placeholder={String(defaultRest)} onCommit={onRest} />
        </label>
      </div>
      {canLink && (
        <button className={`link${linkedToNext ? ' on' : ''}`} onClick={onToggleLink}>
          <LinkIcon /> {linkedToNext ? t('routines.unlinkNext') : t('routines.linkNext')}
        </button>
      )}
    </li>
  )
}

/** `isNew`: a draft that is only stored when you press Save; going back asks before discarding it. */
export default function RoutineEditor({ isNew = false }: { isNew?: boolean }) {
  const { t } = useTranslation()
  const nav = useNavigate()
  const resume = new URLSearchParams(useLocation().search).get('draft') === '1'
  const id = useParams().id!
  const defaultRest = useSettings((s) => s.settings.defaultRestSec)
  const [routine, setRoutine] = useState<Routine | null | undefined>(() => (isNew ? (resume ? useRoutineDraft.getState().draft : undefined) ?? { id: newId(), name: '', exercises: [], archived: false } : undefined))
  const [picking, setPicking] = useState(false)

  useEffect(() => { if (!isNew) void db.routines.get(id).then((r) => setRoutine(r ?? null)) }, [id, isNew])
  const dirty = isNew && !!routine && (routine.name.trim() !== '' || routine.exercises.length > 0)
  // Opening an exercise keeps the draft (it comes back with ?draft=1); any other way out asks first.
  const guard = useDraftGuard(dirty, t('routines.discardNew'), { allow: (p) => p.startsWith('/exercises/'), onDiscard: () => useRoutineDraft.getState().clear() })
  useEffect(() => { if (isNew && !resume) useRoutineDraft.getState().clear() }, [isNew, resume])

  const exIds = routine?.exercises.map((e) => e.exerciseId) ?? []
  const exercises = useLiveQuery(async () => {
    const rows = await db.exercises.bulkGet([...new Set(exIds)])
    return new Map(rows.filter((r): r is Exercise => !!r).map((r) => [r.id, r]))
  }, [exIds.join('|')])

  // Keep the last loaded names while the live query re-runs after adding exercises (avoids a "…" flicker).
  const namesCache = useRef<Map<string, Exercise>>(new Map())
  if (exercises) namesCache.current = exercises
  const names = exercises ?? namesCache.current

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const positions = useMemo(() => groupPositions(routine?.exercises ?? []), [routine])

  if (routine === undefined) return <p className="muted">…</p>
  if (routine === null) return <section><p>{t('routines.notFound')}</p><Link to="/workout">{t('tabs.workout')}</Link></section>

  const save = (next: Routine) => { setRoutine(next); if (isNew) useRoutineDraft.getState().set(next); else void db.routines.put(next) }
  const commit = async () => {
    guard.release()
    useRoutineDraft.getState().clear()
    await db.routines.add({ ...routine, name: routine.name.trim() || t('routines.untitled') })
    nav('/workout', { replace: true })
  }
  const setExercises = (exs: RoutineExercise[]) => save({ ...routine, exercises: exs })
  const list = routine.exercises

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setExercises(moveExercise(list, list.findIndex((e) => e.id === active.id), list.findIndex((e) => e.id === over.id)))
  }

  return (
    <section>
      <div className="edit-bar">
        <BackLink to="/workout" label={t('tabs.workout')} />
        {isNew && <button className="primary" onClick={() => void commit()}>{t('common.save')}</button>}
      </div>
      <input className="title-input" aria-label={t('routines.name')} value={routine.name} placeholder={t('routines.name')}
        onChange={(e) => save({ ...routine, name: e.target.value })}
        onBlur={() => !isNew && !routine.name.trim() && save({ ...routine, name: t('routines.untitled') })} />
      {list.length === 0 && <EmptyState icon={<ExercisesIcon />}>{t('routines.emptyRoutine')}</EmptyState>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={list.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          <ul className="rx-list">
            {list.map((item, i) => (
              <Row backTo={isNew ? '/routines/new?draft=1' : `/routines/${routine.id}`} key={item.id} item={item} exercise={names.get(item.exerciseId)} pos={positions[i]}
                canLink={i < list.length - 1} defaultRest={defaultRest}
                onChange={(next) => setExercises(list.map((e, k) => (k === i ? next : e)))}
                onRest={(v) => setExercises(setRest(list, i, v))}
                onRemove={() => setExercises(removeExercise(list, i))}
                onToggleLink={() => setExercises(positions[i].pos === 'start' || positions[i].pos === 'middle' ? unlinkFromNext(list, i) : linkWithNext(list, i))} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <button className="primary wide" onClick={() => setPicking(true)}>+ {t('routines.addExercises')}</button>
      {picking && <ExercisePicker onClose={() => setPicking(false)} onAdd={(exs) => { save(addExercises(routine, exs)); setPicking(false) }} />}
    </section>
  )
}
