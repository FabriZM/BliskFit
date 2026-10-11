import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Exercise } from '../../db/types'
import { filterExercises } from '../../lib/exerciseFilter'
import { muscleLabel, orderMuscles, withDescendants } from '../../lib/muscles'

const PAGE = 50

export default function ExercisePicker({ onAdd, onClose }: { onAdd: (exs: Exercise[]) => void; onClose: () => void }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [shown, setShown] = useState(PAGE)
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const muscles = useLiveQuery(() => db.muscleGroups.toArray(), []) ?? []

  const results = useMemo(() => {
    if (!exercises) return []
    const ids = muscle ? withDescendants(muscles, muscle) : new Set<string>()
    return filterExercises(exercises, { query, muscleIds: ids, equipment: '' })
  }, [exercises, muscles, query, muscle])

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t('routines.addExercises')}>
      <div className="overlay-head">
        <button onClick={onClose}>{t('common.cancel')}</button>
        <strong>{t('routines.addExercises')}</strong>
        <button className="primary" disabled={!picked.length}
          onClick={() => { const set = new Set(picked); onAdd(picked.map((id) => exercises!.find((e) => e.id === id)!).filter((e) => set.has(e.id))) }}>
          {t('routines.addN', { count: picked.length })}
        </button>
      </div>
      <div className="overlay-body">
        <input type="search" placeholder={t('exercises.search')} value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE) }} />
        <div className="filters">
          <select value={muscle} onChange={(e) => { setMuscle(e.target.value); setShown(PAGE) }} aria-label={t('exercises.muscle')}>
            <option value="">{t('exercises.allMuscles')}</option>
            {orderMuscles(muscles).map((m) => <option key={m.id} value={m.id}>{(m.parentId ? '  ' : '') + muscleLabel(m, t)}</option>)}
          </select>
        </div>
        <ul className="list">
          {results.slice(0, shown).map((e) => (
            <li key={e.id}>
              <label className="pick">
                <input type="checkbox" checked={picked.includes(e.id)} onChange={() => toggle(e.id)} />
                <span>{e.name}</span>
              </label>
            </li>
          ))}
        </ul>
        {shown < results.length && <button onClick={() => setShown(shown + PAGE)}>{t('exercises.more')}</button>}
      </div>
    </div>
  )
}
