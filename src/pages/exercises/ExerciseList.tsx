import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { toggleFavorite, useFavorites } from '../../db/favorites'
import { filterExercises } from '../../lib/exerciseFilter'
import { muscleLabel, muscleSearchText, orderMuscles, withDescendants } from '../../lib/muscles'
import PageHeader from '../../components/PageHeader'
import EmptyState from '../../components/EmptyState'
import { SearchIcon } from '../../components/TabIcons'
import BodyPicker from './BodyPicker'
import { StarIcon } from '../../components/Icons'
import { useExerciseName } from '../../lib/exerciseName'

const PAGE = 60

// Kept in memory so coming back from an exercise page restores the search, filters and scroll position.
const saved = { query: '', muscles: [] as string[], equipment: '', favoritesOnly: false, shown: PAGE, scroll: 0 }

export default function ExerciseList() {
  const { t } = useTranslation()
  const exName = useExerciseName()
  const [query, setQuery] = useState(saved.query)
  const [muscles, setMuscles] = useState(saved.muscles)
  const [picking, setPicking] = useState(false)
  const [equipment, setEquipment] = useState(saved.equipment)
  const [favoritesOnly, setFavoritesOnly] = useState(saved.favoritesOnly)
  const [shown, setShown] = useState(saved.shown)
  const restored = useRef(false)
  const favorites = useFavorites()

  const exercises = useLiveQuery(() => db.exercises.toArray(), [])

  useEffect(() => { Object.assign(saved, { query, muscles, equipment, favoritesOnly, shown }) }, [query, muscles, equipment, favoritesOnly, shown])
  // Restore the scroll once the list has rendered; remember it when leaving.
  useLayoutEffect(() => {
    if (!exercises || restored.current) return
    restored.current = true
    const main = document.querySelector('main')
    if (main) main.scrollTop = saved.scroll
  }, [exercises])
  useEffect(() => {
    const main = document.querySelector('main')
    const onScroll = () => { if (restored.current && main) saved.scroll = main.scrollTop }
    main?.addEventListener('scroll', onScroll, { passive: true })
    return () => main?.removeEventListener('scroll', onScroll)
  }, [])
  const allMuscles = useLiveQuery(() => db.muscleGroups.toArray(), [])

  const equipmentOptions = useMemo(
    () => [...new Set((exercises ?? []).map((e) => e.equipment ?? 'none'))].sort(),
    [exercises],
  )
  const muscleName = useMemo(() => new Map((allMuscles ?? []).map((m) => [m.id, muscleLabel(m, t)])), [allMuscles, t])

  /** Exercises for the current search, equipment and favorites with the muscle filter set to `picked`. */
  const find = (picked: string[]) => {
    if (!exercises || !allMuscles) return []
    const ids = new Set(picked.flatMap((m) => [...withDescendants(allMuscles, m)]))
    const equipmentLabel = (eq: string) => t(`equipment.${eq}`, { defaultValue: eq })
    return filterExercises(exercises, { query, equipmentLabel, displayName: exName, muscleText: muscleSearchText(allMuscles, t), muscleIds: ids, equipment, favorites, favoritesOnly })
  }
  const results = useMemo(() => find(muscles), [exercises, allMuscles, query, muscles, equipment, favorites, favoritesOnly, t, exName]) // eslint-disable-line react-hooks/exhaustive-deps

  const reset = (fn: () => void) => { fn(); setShown(PAGE) }

  return (
    <section>
      <PageHeader brand title={t('tabs.exercises')} actions={<Link className="btn" to="/exercises/new">+ {t('exercises.new')}</Link>} />
      <div className="search-row">
        <input type="search" placeholder={t('exercises.search')} value={query}
          onChange={(e) => reset(() => setQuery(e.target.value))} />
        <button className={`chip${favoritesOnly ? ' on' : ''}`} aria-pressed={favoritesOnly} onClick={() => reset(() => setFavoritesOnly(!favoritesOnly))}>
          <StarIcon filled /> {t('exercises.favorites')}
        </button>
      </div>
      <div className="filters">
        <select value={muscles.length > 1 ? '*' : muscles[0] ?? ''} onChange={(e) => reset(() => setMuscles(e.target.value ? [e.target.value] : []))} aria-label={t('exercises.muscle')}>
          <option value="">{t('exercises.allMuscles')}</option>
          {muscles.length > 1 && <option value="*" disabled>{t('exercises.musclesCount', { count: muscles.length })}</option>}
          {orderMuscles(allMuscles ?? []).map((m) => (
            <option key={m.id} value={m.id}>{(m.parentId ? '\u00a0\u00a0' : '') + muscleName.get(m.id)}</option>
          ))}
        </select>
        <button className={`chip${muscles.length ? ' on' : ''}`} aria-haspopup="dialog" onClick={() => setPicking(true)}>{t('exercises.pickBody')}</button>
        <select value={equipment} onChange={(e) => reset(() => setEquipment(e.target.value))} aria-label={t('exercises.equipment')}>
          <option value="">{t('exercises.allEquipment')}</option>
          {equipmentOptions.map((eq) => <option key={eq} value={eq}>{t(`equipment.${eq}`, { defaultValue: eq })}</option>)}
        </select>
      </div>
      {!exercises ? <p className="muted">…</p> : (
        <>
          <p className="muted small list-count">{t('exercises.count', { count: results.length })}</p>
          {results.length === 0 && (
            <EmptyState icon={<SearchIcon />}
              action={(query || muscles.length > 0 || equipment || favoritesOnly) && <button onClick={() => reset(() => { setQuery(''); setMuscles([]); setEquipment(''); setFavoritesOnly(false) })}>{t('exercises.clearFilters')}</button>}>
              {t('exercises.noResults')}
            </EmptyState>
          )}
          {results.length > 0 && <ul className="list grouped">
            {results.slice(0, shown).map((e) => (
              <li key={e.id} className="ex-row">
                <Link to={`/exercises/${encodeURIComponent(e.id)}`}>
                  <strong>{exName(e)}</strong>
                  <span className="muted">
                    {e.primaryMuscleIds.map((id) => muscleName.get(id)).join(', ')}
                    {e.source === 'custom' ? ` · ${t('exercises.custom')}` : ''}
                  </span>
                </Link>
                <button className={`star${favorites.has(e.id) ? ' on' : ''}`} aria-pressed={favorites.has(e.id)}
                  aria-label={favorites.has(e.id) ? t('exercises.unfavorite') : t('exercises.favorite')} onClick={() => void toggleFavorite(e.id)}>
                  <StarIcon filled={favorites.has(e.id)} />
                </button>
              </li>
            ))}
          </ul>}
          {shown < results.length && <button onClick={() => setShown(shown + PAGE)}>{t('exercises.more')}</button>}
        </>
      )}
      {picking && allMuscles && (
        <BodyPicker muscles={allMuscles} value={muscles} count={(ids) => find(ids).length}
          onApply={(ids) => { reset(() => setMuscles(ids)); setPicking(false) }} onClose={() => setPicking(false)} />
      )}
    </section>
  )
}
