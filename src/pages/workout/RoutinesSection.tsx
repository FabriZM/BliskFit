import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId } from '../../db/db'
import { getActiveProgramId } from '../../db/programs'
import { routineLastUsed } from '../../db/routines'
import { sortByLastUsed } from '../../lib/routines'
import RoutineItem from './RoutineItem'
import EmptyState from '../../components/EmptyState'
import { WorkoutIcon } from '../../components/TabIcons'
import { ChevronRightIcon } from '../../components/Icons'

const SHOWN = 4

/** Routines (start / open / create) and the entry to programs: the heart of the Workout tab. `running`: a workout is on, so no starting another. */
export default function RoutinesSection({ running = false }: { running?: boolean }) {
  const { t } = useTranslation()
  const nav = useNavigate()
  const [showArchived, setShowArchived] = useState(false)
  const routines = useLiveQuery(() => db.routines.toArray(), [])
  const program = useLiveQuery(async () => { const id = await getActiveProgramId(); return id ? db.programs.get(id) : undefined }, [])

  const lastUsed = useLiveQuery(routineLastUsed, [])

  const create = async () => {
    const id = newId()
    await db.routines.add({ id, name: t('routines.untitled'), exercises: [], archived: false })
    nav(`/routines/${id}`)
  }
  const matching = sortByLastUsed((routines ?? []).filter((r) => r.archived === showArchived), lastUsed ?? new Map())
  const visible = showArchived ? matching : matching.slice(0, SHOWN)
  const archivedCount = (routines ?? []).filter((r) => r.archived).length

  return (
    <>
      <div className="row head">
        <h2>{t('workout.routines')}</h2>
        <span className="head-actions">
          <button onClick={() => nav('/import')}>{t('share.import')}</button>
          <button onClick={() => void create()}>+ {t('routines.new')}</button>
        </span>
      </div>
      {routines && visible.length === 0 && (showArchived
        ? <p className="muted">{t('routines.noArchived')}</p>
        : <EmptyState icon={<WorkoutIcon />} action={<><button className="primary" onClick={() => nav('/routines/templates?show=routines')}>{t('templates.browseRoutines')}</button><button onClick={() => void create()}>+ {t('routines.new')}</button></>}>{t('templates.routinesHint')}</EmptyState>)}
      {visible.length > 0 && <ul className="list rt-list">
        {visible.map((r) => <RoutineItem key={r.id} routine={r} canStart={!running} />)}
      </ul>}
      {!showArchived && matching.length > SHOWN && (
        <button className="archived-toggle" onClick={() => nav('/routines/all')}>{t('routines.showAll', { count: matching.length })}</button>
      )}
      {(archivedCount > 0 || showArchived) && (
        <button className="archived-toggle" onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? t('routines.hideArchived') : t('routines.showArchived', { count: archivedCount })}
        </button>
      )}
      <h2>{t('programs.title')}</h2>
      <Link className="card link-card" to="/routines/programs">
        <span>{program ? `${t('programs.active')}: ${program.name}` : t('today.noProgram')}</span>
        <ChevronRightIcon />
      </Link>
      <h2>{t('templates.sectionTitle')}</h2>
      <Link className="card link-card" to="/routines/templates">
        <span>{t('templates.sectionLink')}</span>
        <ChevronRightIcon />
      </Link>
    </>
  )
}
