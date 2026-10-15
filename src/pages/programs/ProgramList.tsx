import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId } from '../../db/db'
import { getActiveProgramId } from '../../db/programs'
import { filterPrograms, sortPrograms, weekStart, type ProgramMode, type ProgramStatus } from '../../lib/programs'
import { useSettings } from '../../stores/settings'
import ProgramItem from './ProgramItem'
import { BackLink } from '../../components/PageHeader'
import EmptyState from '../../components/EmptyState'
import { CalendarIcon, SearchIcon } from '../../components/TabIcons'

/** Every program, the active one first, with search and filters. */
export default function ProgramList() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const weekStartDay = useSettings((s) => s.settings.weekStartDay)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<ProgramMode>('all')
  const [status, setStatus] = useState<ProgramStatus>('all')
  const data = useLiveQuery(async () => ({
    programs: await db.programs.toArray(), active: await getActiveProgramId(), routines: await db.routines.toArray(),
  }), [])

  const routineNames = useMemo(() => new Map((data?.routines ?? []).map((r) => [r.id, r.name])), [data])
  const results = useMemo(
    () => (data ? sortPrograms(filterPrograms(data.programs, { query, mode, status }, data.active, routineNames), data.active) : []),
    [data, query, mode, status, routineNames],
  )

  const create = async () => {
    const id = newId()
    await db.programs.add({
      id, name: t('programs.untitled'), mode: 'weekday', weeks: 1,
      startDate: weekStart(new Date(), weekStartDay).getTime(), schedule: { 0: {} },
    })
    nav(`/routines/programs/${id}`)
  }
  const filtered = !!query || mode !== 'all' || status !== 'all'
  const clear = () => { setQuery(''); setMode('all'); setStatus('all') }

  return (
    <section>
      <BackLink to="/workout" label={t('tabs.workout')} />
      <div className="row head">
        <h1>{t('programs.title')}</h1>
        <button className="primary" onClick={() => void create()}>+ {t('programs.new')}</button>
      </div>
      {data && data.programs.length === 0 ? (
        <EmptyState icon={<CalendarIcon />} action={<button className="primary" onClick={() => nav('/routines/templates?show=programs')}>{t('templates.browsePrograms')}</button>}>{t('programs.none')}</EmptyState>
      ) : (
        <>
          <div className="search-row">
            <input type="search" placeholder={t('programs.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="filters">
            <select value={mode} onChange={(e) => setMode(e.target.value as ProgramMode)} aria-label={t('programs.mode')}>
              <option value="all">{t('programs.typeAll')}</option>
              <option value="weekday">{t('programs.modeWeekday')}</option>
              <option value="rotation">{t('programs.modeRotation')}</option>
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value as ProgramStatus)} aria-label={t('programs.status')}>
              <option value="all">{t('programs.statusAll')}</option>
              <option value="active">{t('programs.statusActive')}</option>
              <option value="inactive">{t('programs.statusInactive')}</option>
            </select>
          </div>
          {data && (
            <>
              <p className="muted small list-count">{t('programs.count', { count: results.length })}</p>
              {results.length === 0
                ? <EmptyState icon={<SearchIcon />} action={filtered && <button onClick={clear}>{t('exercises.clearFilters')}</button>}>{t('programs.noResults')}</EmptyState>
                : <ul className="list rt-list">{results.map((p) => <ProgramItem key={p.id} program={p} active={data.active === p.id} routineNames={routineNames} />)}</ul>}
            </>
          )}
        </>
      )}
    </section>
  )
}
