import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { useFavorites } from '../../db/favorites'
import type { Exercise } from '../../db/types'
import { filterExercises } from '../../lib/exerciseFilter'
import { muscleLabel, orderMuscles, withDescendants } from '../../lib/muscles'
import { StarIcon } from '../../components/Icons'

const PAGE = 50

/** `replacing`: picking a swap for this exercise; the list starts on its muscle group (main targets only) and leaves it out. */
export default function ExercisePicker({ onAdd, onClose, single = false, title, replacing }: {
  onAdd: (exs: Exercise[]) => void; onClose: () => void; single?: boolean; title?: string; replacing?: Exercise
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [shown, setShown] = useState(PAGE)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const favorites = useFavorites()
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const muscles = useLiveQuery(() => db.muscleGroups.toArray(), []) ?? []

  // Until the user picks a muscle: the top-level group of the replaced exercise's main muscle (e.g. lats -> back).
  const group = useMemo(() => {
    const id = replacing?.primaryMuscleIds[0]
    return id ? (muscles.find((m) => m.id === id)?.parentId ?? id) : ''
  }, [replacing, muscles])
  const shownMuscle = muscle ?? group

  const results = useMemo(() => {
    if (!exercises) return []
    const ids = shownMuscle ? withDescendants(muscles, shownMuscle) : new Set<string>()
    const equipmentLabel = (eq: string) => t(`equipment.${eq}`, { defaultValue: eq })
    const list = filterExercises(exercises, { query, equipmentLabel, muscleIds: ids, equipment: '', favorites, favoritesOnly, primaryOnly: !!replacing })
    if (!replacing) return list
    // Real alternatives first: the same kind of exercise (lifting vs timed/stretching vs cardio), then the same exact
    // main muscle (lats before the rest of the back). The sort is stable, so favorites and names keep their order.
    const kind = (e: Exercise) => (e.trackingType === 'duration' || e.trackingType === 'cardio' ? e.trackingType : 'lift')
    const target = replacing.primaryMuscleIds[0]
    const rank = (e: Exercise) => (kind(e) === kind(replacing) ? 0 : 2) + (e.primaryMuscleIds.includes(target) ? 0 : 1)
    return list.filter((e) => e.id !== replacing.id).sort((a, b) => rank(a) - rank(b))
  }, [exercises, muscles, query, shownMuscle, favorites, favoritesOnly, replacing, t])

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : single ? [id] : [...p, id]))

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title ?? t('routines.addExercises')}>
      <div className="overlay-head">
        <button onClick={onClose}>{t('common.cancel')}</button>
        <strong>{title ?? t('routines.addExercises')}</strong>
        <button className="primary" disabled={!picked.length}
          onClick={() => { const set = new Set(picked); onAdd(picked.map((id) => exercises!.find((e) => e.id === id)!).filter((e) => set.has(e.id))) }}>
          {single ? t('common.select') : t('routines.addN', { count: picked.length })}
        </button>
      </div>
      <div className="overlay-body">
        <input type="search" placeholder={t('exercises.search')} value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE) }} />
        <div className="filters">
          <select value={shownMuscle} onChange={(e) => { setMuscle(e.target.value); setShown(PAGE) }} aria-label={t('exercises.muscle')}>
            <option value="">{t('exercises.allMuscles')}</option>
            {orderMuscles(muscles).map((m) => <option key={m.id} value={m.id}>{(m.parentId ? '  ' : '') + muscleLabel(m, t)}</option>)}
          </select>
          <button className={`chip${favoritesOnly ? ' on' : ''}`} aria-pressed={favoritesOnly} onClick={() => { setFavoritesOnly(!favoritesOnly); setShown(PAGE) }}>
            <StarIcon filled /> {t('exercises.favorites')}
          </button>
        </div>
        <ul className="list">
          {results.slice(0, shown).map((e) => (
            <li key={e.id}>
              <label className="pick">
                <input type="checkbox" checked={picked.includes(e.id)} onChange={() => toggle(e.id)} />
                <span>{favorites.has(e.id) && <><StarIcon filled className="fav-mark" label={t('exercises.favorites')} /> </>}{e.name}</span>
              </label>
            </li>
          ))}
        </ul>
        {shown < results.length && <button onClick={() => setShown(shown + PAGE)}>{t('exercises.more')}</button>}
      </div>
    </div>
  )
}
