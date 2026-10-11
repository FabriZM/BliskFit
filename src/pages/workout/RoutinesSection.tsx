import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId } from '../../db/db'
import { getActiveProgramId } from '../../db/programs'
import { startSession } from '../../db/workout'

/** Routines (start / open / create) and the entry to programs: the heart of the Workout tab. */
export default function RoutinesSection() {
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
        <button onClick={() => void create()}>+ {t('routines.new')}</button>
      </div>
      {routines && visible.length === 0 && <p className="muted">{showArchived ? t('routines.noArchived') : t('routines.none')}</p>}
      <ul className="list">
        {visible.map((r) => (
          <li key={r.id}>
            <div className="routine-row">
              <Link to={`/routines/${r.id}`}>
                <strong>{r.name}</strong>
                <span className="muted">{t('routines.exerciseCount', { count: r.exercises.length })}</span>
              </Link>
              {r.archived
                ? <button onClick={() => void db.routines.update(r.id, { archived: false })}>{t('routines.restore')}</button>
                : <button className="primary" onClick={() => void startSession(r.id)}>{t('workout.start')}</button>}
            </div>
          </li>
        ))}
      </ul>
      {(archivedCount > 0 || showArchived) && (
        <button onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? t('routines.hideArchived') : t('routines.showArchived', { count: archivedCount })}
        </button>
      )}
      <h2>{t('programs.title')}</h2>
      <Link className="card link-card" to="/routines/programs">
        <span>{program ? `${t('programs.active')}: ${program.name}` : t('today.noProgram')}</span>
        <span aria-hidden>→</span>
      </Link>
    </>
  )
}
