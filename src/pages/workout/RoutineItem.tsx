import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { db } from '../../db/db'
import { deleteRoutine } from '../../db/routines'
import { packRoutineById } from '../../db/share'
import { startSession } from '../../db/workout'
import { duplicateRoutine } from '../../lib/routines'
import type { Routine } from '../../db/types'
import ShareButtons from '../../components/ShareButtons'
import { ArchiveIcon, MoreIcon, TrashIcon } from '../../components/Icons'

const SWIPE_AT = 100

/**
 * One routine in the Workout list. Swipe right to archive (or restore, when archived), swipe left to delete (asks
 * first). The ... button opens the routine's options: duplicate, archive / restore, share, delete.
 */
export default function RoutineItem({ routine: r }: { routine: Routine }) {
  const { t } = useTranslation()
  const nav = useNavigate()
  const [menu, setMenu] = useState(false)
  const [dx, setDx] = useState(0)
  const drag = useRef<{ x: number; y: number; active: boolean } | null>(null)

  const toggleArchive = () => { setMenu(false); void db.routines.update(r.id, { archived: !r.archived }) }
  const remove = async () => {
    setMenu(false)
    if (confirm(t('routines.confirmDelete', { name: r.name }))) await deleteRoutine(r.id)
  }
  const duplicate = async () => {
    const copy = duplicateRoutine(r, `${r.name} ${t('routines.copySuffix')}`)
    await db.routines.add(copy)
    nav(`/routines/${copy.id}`)
  }

  // Only starts on non-interactive areas, and vertical scrolling wins. A cancelled gesture never archives or deletes.
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('input,button,select,textarea,label')) return
    drag.current = { x: e.clientX, y: e.clientY, active: false }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d) return
    const ddx = e.clientX - d.x, ddy = e.clientY - d.y
    if (!d.active) {
      if (Math.abs(ddy) > 10 && Math.abs(ddy) > Math.abs(ddx)) { drag.current = null; return }
      if (Math.abs(ddx) > 10) {
        d.active = true
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* pointer already gone */ }
      }
    }
    if (d.active) setDx(ddx)
  }
  const end = () => {
    const swiped = drag.current?.active ? dx : 0
    drag.current = null
    setDx(0)
    if (swiped > SWIPE_AT) toggleArchive()
    else if (swiped < -SWIPE_AT) void remove()
  }
  const cancel = () => { drag.current = null; setDx(0) }

  return (
    <li className={`rt-item${dx ? ` swiping ${dx > 0 ? 'dir-r' : 'dir-l'}` : ''}`}>
      <div className="rt-bg" aria-hidden>
        {dx > 0 ? <><ArchiveIcon size={22} /> {r.archived ? t('routines.restore') : t('routines.archive')}</>
          : <>{t('routines.delete')} <TrashIcon size={22} /></>}
      </div>
      <div className="rt-body" style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : 'transform .2s' }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={end} onPointerCancel={cancel}>
        <div className="routine-row">
          <Link to={`/routines/${r.id}`}>
            <strong>{r.name}</strong>
            <span className="muted">{t('routines.exerciseCount', { count: r.exercises.length })}</span>
          </Link>
          {!r.archived && <button className="primary" onClick={() => void startSession(r.id)}>{t('workout.start')}</button>}
          <button className="icon" aria-expanded={menu} aria-label={t('routines.menu')} onClick={() => setMenu(!menu)}><MoreIcon /></button>
        </div>
        {menu && (
          <div className="menu rt-menu" role="menu">
            <button role="menuitem" onClick={() => void duplicate()}>{t('routines.duplicate')}</button>
            <button role="menuitem" onClick={toggleArchive}>{r.archived ? t('routines.restore') : t('routines.archive')}</button>
            {r.exercises.length > 0 && <div className="actions"><ShareButtons name={r.name} pack={() => packRoutineById(r.id)} /></div>}
            <button role="menuitem" className="danger" onClick={() => void remove()}>{t('routines.delete')}</button>
          </div>
        )}
      </div>
    </li>
  )
}
