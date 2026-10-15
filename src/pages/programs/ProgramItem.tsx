import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { db } from '../../db/db'
import { deleteProgram, setActiveProgramId } from '../../db/programs'
import { packProgramById } from '../../db/share'
import { daysPerWeek, duplicateProgram, programRoutineIds } from '../../lib/programs'
import { platform } from '../../lib/platform'
import { shareLinkFor } from '../../components/ShareButtons'
import { CheckIcon, CopyIcon, MoreIcon, ShareIcon, TrashIcon } from '../../components/Icons'
import type { ID, Program } from '../../db/types'

/** A program as a card: name and options on one line, summary and routines under it, Set active / Deactivate below. */
export default function ProgramItem({ program: p, active, routineNames }: { program: Program; active: boolean; routineNames: Map<ID, string> }) {
  const { t } = useTranslation()
  const [menu, setMenu] = useState(false)
  const [note, setNote] = useState<string>()

  const summary = p.mode === 'rotation'
    ? t('programs.rotationSummary', { count: p.rotation?.length ?? 0 })
    : `${t('programs.weeksSummary', { count: p.weeks })} · ${t('programs.daysPerWeek', { count: daysPerWeek(p) })}`
  const routines = programRoutineIds(p).flatMap((id) => routineNames.get(id) ?? []).join(', ')

  const duplicate = async () => {
    setMenu(false)
    await db.programs.add(duplicateProgram(p, `${p.name} ${t('routines.copySuffix')}`))
  }
  const share = async () => {
    try {
      const pkg = await packProgramById(p.id)
      if (!pkg) return
      const res = await platform.shareLink(t('share.linkTitle', { name: p.name }), await shareLinkFor(pkg))
      setNote(res === 'copied' ? t('share.copied') : undefined)
    } catch { setNote(t('share.failed')) }
  }
  const remove = async () => {
    setMenu(false)
    if (confirm(t('programs.confirmDelete'))) await deleteProgram(p.id)
  }

  return (
    <li className="rt-item pg-item">
      <div className="rt-body">
        <div className="rt-head">
          <Link to={`/routines/programs/${p.id}`}>
            <strong>{p.name}{active ? <> · <CheckIcon /> {t('programs.active')}</> : null}</strong>
            <span className="muted">{summary}{routines ? ` · ${routines}` : ''}</span>
          </Link>
          <button className="icon" aria-expanded={menu} aria-label={t('programs.menu')} onClick={() => setMenu(!menu)}><MoreIcon /></button>
        </div>
        {active
          ? <button className="rt-start" onClick={() => void setActiveProgramId(undefined)}>{t('programs.deactivate')}</button>
          : <button className="primary rt-start" onClick={() => void setActiveProgramId(p.id)}>{t('programs.setActive')}</button>}
        {menu && (
          <div className="menu rt-menu rt-actions" role="menu">
            <button role="menuitem" aria-label={t('routines.duplicate')} title={t('routines.duplicate')} onClick={() => void duplicate()}><CopyIcon size={22} /></button>
            <button role="menuitem" aria-label={t('share.link')} title={t('share.link')} onClick={() => void share()}><ShareIcon size={22} /></button>
            <button role="menuitem" className="danger" aria-label={t('routines.delete')} title={t('routines.delete')} onClick={() => void remove()}><TrashIcon size={22} /></button>
          </div>
        )}
        {menu && note && <p className="muted small" role="status">{note}</p>}
      </div>
    </li>
  )
}
