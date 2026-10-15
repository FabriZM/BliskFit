import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { routineLastUsed } from '../../db/routines'
import { getActiveSession } from '../../db/workout'
import { filterRoutines, sortByLastUsed, type RoutineStatus } from '../../lib/routines'
import { muscleLabel, orderMuscles, withDescendants } from '../../lib/muscles'
import RoutineItem from '../workout/RoutineItem'
import { BackLink } from '../../components/PageHeader'
import EmptyState from '../../components/EmptyState'
import { SearchIcon, WorkoutIcon } from '../../components/TabIcons'

/** Every routine, most recently used first, with search and filters (the Workout tab only shows the latest few). */
export default function RoutineList() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('')
  const [status, setStatus] = useState<RoutineStatus>('active')
  const data = useLiveQuery(async () => {
    const routines = await db.routines.toArray()
    const ids = [...new Set(routines.flatMap((r) => r.exercises.map((e) => e.exerciseId)))]
    const exercises = new Map((await db.exercises.bulkGet(ids)).flatMap((e) => (e ? [[e.id, e.primaryMuscleIds] as const] : [])))
    return {
      routines, exercises, lastUsed: await routineLastUsed(), muscles: await db.muscleGroups.toArray(),
      running: !!(await getActiveSession()),
    }
  }, [])

  const results = useMemo(() => {
    if (!data) return []
    const trained = new Map(data.routines.map((r) => [r.id, new Set(r.exercises.flatMap((e) => data.exercises.get(e.exerciseId) ?? []))]))
    const muscleIds = muscle ? withDescendants(data.muscles, muscle) : new Set<string>()
    return sortByLastUsed(filterRoutines(data.routines, { query, status, muscleIds }, trained), data.lastUsed)
  }, [data, query, muscle, status])

  const filtered = !!query || !!muscle || status !== 'active'
  const clear = () => { setQuery(''); setMuscle(''); setStatus('active') }

  return (
    <section>
      <BackLink to="/workout" label={t('tabs.workout')} />
      <h1>{t('routines.allTitle')}</h1>
      <div className="search-row">
        <input type="search" placeholder={t('routines.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="filters">
        <select value={muscle} onChange={(e) => setMuscle(e.target.value)} aria-label={t('exercises.muscle')}>
          <option value="">{t('exercises.allMuscles')}</option>
          {orderMuscles(data?.muscles ?? []).map((m) => (
            <option key={m.id} value={m.id}>{(m.parentId ? '\u00a0\u00a0' : '') + muscleLabel(m, t)}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as RoutineStatus)} aria-label={t('routines.status')}>
          <option value="active">{t('routines.statusActive')}</option>
          <option value="archived">{t('routines.statusArchived')}</option>
          <option value="all">{t('routines.statusAll')}</option>
        </select>
      </div>
      {!data ? <p className="muted">…</p> : (
        <>
          <p className="muted small list-count">{t('routines.count', { count: results.length })}</p>
          {results.length === 0
            ? <EmptyState icon={filtered ? <SearchIcon /> : <WorkoutIcon />} action={filtered && <button onClick={clear}>{t('exercises.clearFilters')}</button>}>
              {filtered ? t('routines.noResults') : t('routines.none')}
            </EmptyState>
            : <ul className="list rt-list">{results.map((r) => <RoutineItem key={r.id} routine={r} canStart={!data.running} />)}</ul>}
        </>
      )}
    </section>
  )
}
