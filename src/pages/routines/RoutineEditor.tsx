import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db } from '../../db/db'
import type { Exercise, Routine, RoutineExercise } from '../../db/types'
import {
  addExercises, duplicateRoutine, groupPositions, linkWithNext, moveExercise, removeExercise, setRepRange, setRest, unlinkFromNext,
} from '../../lib/routines'
import { useSettings } from '../../stores/settings'
import NumInput from '../../components/NumInput'
import ShareButtons from '../../components/ShareButtons'
import { packRoutineById } from '../../db/share'
import ExercisePicker from './ExercisePicker'
import { BackLink } from '../../components/PageHeader'
import EmptyState from '../../components/EmptyState'
import { ExercisesIcon } from '../../components/TabIcons'

interface RowProps {
  item: RoutineExercise
  exercise?: Exercise
  pos: ReturnType<typeof groupPositions>[number]
  canLink: boolean
  defaultRest: number
  onChange: (next: RoutineExercise) => void
  onRest: (v: number | undefined) => void
  onRemove: () => void
  onToggleLink: () => void
}

function Row({ item, exercise, pos, canLink, defaultRest, onChange, onRest, onRemove, onToggleLink }: RowProps) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const hasReps = exercise ? !['duration', 'cardio'].includes(exercise.trackingType) : true
  const grouped = pos.pos !== 'single'
  const linkedToNext = pos.pos === 'start' || pos.pos === 'middle'
  return (
    <li ref={setNodeRef} className={`rx ${grouped ? 'grouped ' + pos.pos : ''}${isDragging ? ' dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}>
      {pos.pos === 'start' && <span className="group-tag">{pos.size > 2 ? t('routines.circuit') : t('routines.superset')} · {t('routines.sharedRest')}</span>}
      <div className="rx-head">
        <button className="handle" aria-label={t('routines.drag')} {...attributes} {...listeners}>⠿</button>
        <strong className="rx-name">{exercise?.name ?? '…'}</strong>
        <button className="icon" aria-label={t('common.delete')} onClick={onRemove}>✕</button>
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
          {linkedToNext ? `🔗 ${t('routines.unlinkNext')}` : `🔗 ${t('routines.linkNext')}`}
        </button>
      )}
    </li>
  )
}

export default function RoutineEditor() {
  const { t } = useTranslation()
  const id = useParams().id!
  const nav = useNavigate()
  const defaultRest = useSettings((s) => s.settings.defaultRestSec)
  const [routine, setRoutine] = useState<Routine | null | undefined>()
  const [picking, setPicking] = useState(false)

  useEffect(() => { void db.routines.get(id).then((r) => setRoutine(r ?? null)) }, [id])

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

  const save = (next: Routine) => { setRoutine(next); void db.routines.put(next) }
  const setExercises = (exs: RoutineExercise[]) => save({ ...routine, exercises: exs })
  const list = routine.exercises

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setExercises(moveExercise(list, list.findIndex((e) => e.id === active.id), list.findIndex((e) => e.id === over.id)))
  }

  return (
    <section>
      <BackLink to="/workout" label={t('tabs.workout')} />
      <input className="title-input" aria-label={t('routines.name')} value={routine.name} placeholder={t('routines.name')}
        onChange={(e) => save({ ...routine, name: e.target.value })}
        onBlur={() => !routine.name.trim() && save({ ...routine, name: t('routines.untitled') })} />
      {list.length === 0 && <EmptyState icon={<ExercisesIcon />}>{t('routines.emptyRoutine')}</EmptyState>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={list.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          <ul className="rx-list">
            {list.map((item, i) => (
              <Row key={item.id} item={item} exercise={names.get(item.exerciseId)} pos={positions[i]}
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
      <div className="actions">
        <button onClick={async () => {
          const copy = duplicateRoutine(routine, `${routine.name} ${t('routines.copySuffix')}`)
          await db.routines.add(copy)
          nav(`/routines/${copy.id}`)
        }}>{t('routines.duplicate')}</button>
        <button onClick={() => { save({ ...routine, archived: !routine.archived }); if (!routine.archived) nav('/workout') }}>
          {routine.archived ? t('routines.restore') : t('routines.archive')}
        </button>
      </div>
      {list.length > 0 && <div className="actions"><ShareButtons name={routine.name} pack={() => packRoutineById(routine.id)} /></div>}
      {picking && <ExercisePicker onClose={() => setPicking(false)} onAdd={(exs) => { save(addExercises(routine, exs)); setPicking(false) }} />}
    </section>
  )
}
