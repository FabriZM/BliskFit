import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { filterExercises } from '../../lib/exerciseFilter'
import { muscleLabel, orderMuscles, withDescendants } from '../../lib/muscles'

const PAGE = 60

export default function ExerciseList() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('')
  const [equipment, setEquipment] = useState('')
  const [shown, setShown] = useState(PAGE)

  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const muscles = useLiveQuery(() => db.muscleGroups.toArray(), [])

  const equipmentOptions = useMemo(
    () => [...new Set((exercises ?? []).map((e) => e.equipment ?? 'none'))].sort(),
    [exercises],
  )
  const muscleName = useMemo(() => new Map((muscles ?? []).map((m) => [m.id, muscleLabel(m, t)])), [muscles, t])

  const results = useMemo(() => {
    if (!exercises || !muscles) return []
    const ids = muscle ? withDescendants(muscles, muscle) : new Set<string>()
    return filterExercises(exercises, { query, muscleIds: ids, equipment })
  }, [exercises, muscles, query, muscle, equipment])

  const reset = (fn: () => void) => { fn(); setShown(PAGE) }

  return (
    <section>
      <div className="row head">
        <h1>{t('tabs.exercises')}</h1>
        <Link className="btn" to="/exercises/new">+ {t('exercises.new')}</Link>
      </div>
      <input type="search" placeholder={t('exercises.search')} value={query}
        onChange={(e) => reset(() => setQuery(e.target.value))} />
      <div className="filters">
        <select value={muscle} onChange={(e) => reset(() => setMuscle(e.target.value))} aria-label={t('exercises.muscle')}>
          <option value="">{t('exercises.allMuscles')}</option>
          {orderMuscles(muscles ?? []).map((m) => (
            <option key={m.id} value={m.id}>{(m.parentId ? '\u00a0\u00a0' : '') + muscleName.get(m.id)}</option>
          ))}
        </select>
        <select value={equipment} onChange={(e) => reset(() => setEquipment(e.target.value))} aria-label={t('exercises.equipment')}>
          <option value="">{t('exercises.allEquipment')}</option>
          {equipmentOptions.map((eq) => <option key={eq} value={eq}>{t(`equipment.${eq}`, { defaultValue: eq })}</option>)}
        </select>
      </div>
      {!exercises ? <p className="muted">…</p> : (
        <>
          <p className="muted">{t('exercises.count', { count: results.length })}</p>
          <ul className="list">
            {results.slice(0, shown).map((e) => (
              <li key={e.id}>
                <Link to={`/exercises/${encodeURIComponent(e.id)}`}>
                  <strong>{e.name}</strong>
                  <span className="muted">
                    {e.primaryMuscleIds.map((id) => muscleName.get(id)).join(', ')}
                    {e.source === 'custom' ? ` · ${t('exercises.custom')}` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {shown < results.length && <button onClick={() => setShown(shown + PAGE)}>{t('exercises.more')}</button>}
        </>
      )}
    </section>
  )
}
