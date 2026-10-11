import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId } from '../../db/db'
import { duplicateRoutine } from '../../lib/routines'
import TodayCard from '../../components/TodayCard'

export default function RoutineList() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const [showArchived, setShowArchived] = useState(false)
  const routines = useLiveQuery(() => db.routines.toArray(), [])

  const create = async () => {
    const id = newId()
    await db.routines.add({ id, name: t('routines.untitled'), exercises: [], archived: false })
    nav(`/routines/${id}`)
  }
  const visible = (routines ?? []).filter((r) => r.archived === showArchived).sort((a, b) => a.name.localeCompare(b.name))
  const archivedCount = (routines ?? []).filter((r) => r.archived).length

  return (
    <section>
      <div className="row head">
        <h1>{t('tabs.routines')}</h1>
        <button className="primary" onClick={() => void create()}>+ {t('routines.new')}</button>
      </div>
      <TodayCard />
      <p><Link to="/routines/programs">{t('programs.title')} →</Link></p>
      {routines && visible.length === 0 && <p className="muted">{showArchived ? t('routines.noArchived') : t('routines.none')}</p>}
      <ul className="list">
        {visible.map((r) => (
          <li key={r.id}>
            <div className="routine-row">
              <Link to={`/routines/${r.id}`}>
                <strong>{r.name}</strong>
                <span className="muted">{t('routines.exerciseCount', { count: r.exercises.length })}</span>
              </Link>
              <button onClick={() => void db.routines.add(duplicateRoutine(r, `${r.name} ${t('routines.copySuffix')}`))}>{t('routines.duplicate')}</button>
              <button onClick={() => void db.routines.update(r.id, { archived: !r.archived })}>{r.archived ? t('routines.restore') : t('routines.archive')}</button>
            </div>
          </li>
        ))}
      </ul>
      {(archivedCount > 0 || showArchived) && (
        <button onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? t('routines.hideArchived') : t('routines.showArchived', { count: archivedCount })}
        </button>
      )}
    </section>
  )
}
