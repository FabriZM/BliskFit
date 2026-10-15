import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId } from '../../db/db'
import { getActiveProgramId } from '../../db/programs'
import RoutineItem from './RoutineItem'
import EmptyState from '../../components/EmptyState'
import { WorkoutIcon } from '../../components/TabIcons'
import { ChevronRightIcon } from '../../components/Icons'

/** Routines (start / open / create) and the entry to programs: the heart of the Workout tab. `running`: a workout is on, so no starting another. */
export default function RoutinesSection({ running = false }: { running?: boolean }) {
  const { t } = useTranslation()
  const nav = useNavigate()
  const [showArchived, setShowArchived] = useState(false)
  const routines = useLiveQuery(() => db.routines.toArray(), [])
  const program = useLiveQuery(async () => { const id = await getActiveProgramId(); return id ? db.programs.get(id) : undefined }, [])

  const create = async () => {
    const id = newId()
    await db.routines.add({ id, name: t('routines.untitled'), exercises: [], archived: false })
    nav(`/routines/${id}`)
  }
  const visible = (routines ?? []).filter((r) => r.archived === showArchived).sort((a, b) => a.name.localeCompare(b.name))
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
      {visible.length > 0 && <ul className="list grouped">
        {visible.map((r) => <RoutineItem key={r.id} routine={r} canStart={!running} />)}
      </ul>}
      {(archivedCount > 0 || showArchived) && (
        <button onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? t('routines.hideArchived') : t('routines.showArchived', { count: archivedCount })}
        </button>
      )}
      <h2>{t('programs.title')}</h2>
      <Link className="card link-card" to="/routines/programs">
        <span>{program ? `${t('programs.active')}: ${program.name}` : t('today.noProgram')}</span>
        <ChevronRightIcon />
      </Link>
      {!program && <p className="muted small"><Link to="/routines/templates?show=programs">{t('templates.programsHint')}</Link></p>}
      <h2>{t('templates.sectionTitle')}</h2>
      <Link className="card link-card" to="/routines/templates">
        <span>{t('templates.sectionLink')}</span>
        <ChevronRightIcon />
      </Link>
    </>
  )
}
