import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId } from '../../db/db'
import { deleteProgram, getActiveProgramId, setActiveProgramId } from '../../db/programs'
import type { Program } from '../../db/types'
import { fromDateInput, orderedWeekdays, toDateInput, weekdayNames } from '../../lib/dates'
import { copyWeekToAll, resizeSchedule, weekStart } from '../../lib/programs'
import { useDraftGuard } from '../../lib/useDraftGuard'
import { useSettings } from '../../stores/settings'
import NumInput from '../../components/NumInput'
import { shareAsLink } from '../../components/ShareButtons'
import { packProgramById } from '../../db/share'
import { BackLink } from '../../components/PageHeader'
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, CloseIcon, ShareIcon, TrashIcon } from '../../components/Icons'

/** `isNew`: a draft that is only stored when you press Save; going back asks before discarding it. */
export default function ProgramEditor({ isNew = false }: { isNew?: boolean }) {
  const { t, i18n } = useTranslation()
  const nav = useNavigate()
  const id = useParams().id!
  const weekStartDay = useSettings((s) => s.settings.weekStartDay)
  const blank = (): Program => ({
    id: newId(), name: '', mode: 'weekday', weeks: 1, startDate: weekStart(new Date(), weekStartDay).getTime(), schedule: { 0: {} },
  })
  const [program, setProgram] = useState<Program | null | undefined>(() => (isNew ? blank() : undefined))
  const [initial] = useState(() => (isNew && program ? JSON.stringify(program) : ''))
  const [note, setNote] = useState<string>()
  const routines = (useLiveQuery(() => db.routines.toArray(), []) ?? []).filter((r) => !r.archived).sort((a, b) => a.name.localeCompare(b.name))
  const active = useLiveQuery(() => getActiveProgramId(), [])
  const gyms = useLiveQuery(() => db.gyms.toArray(), []) ?? []

  useEffect(() => { if (!isNew) void db.programs.get(id).then((p) => setProgram(p ?? null)) }, [id, isNew])
  const dirty = isNew && !!program && JSON.stringify(program) !== initial
  const guard = useDraftGuard(dirty, t('programs.discardNew'))
  if (program === undefined) return <p className="muted">…</p>
  if (program === null) return <section><p>{t('programs.notFound')}</p><Link to="/routines/programs">{t('programs.title')}</Link></section>

  const save = (next: Program) => { setProgram(next); if (!isNew) void db.programs.put(next) }
  const commit = async () => {
    guard.release()
    await db.programs.add({ ...program, name: program.name.trim() || t('programs.untitled') })
    nav('/routines/programs', { replace: true })
  }
  const remove = async () => {
    if (!confirm(t('programs.confirmDelete'))) return
    await deleteProgram(id)
    nav('/routines/programs', { replace: true })
  }
  const days = weekdayNames(i18n.language)
  const rotation = program.rotation ?? []
  const rName = (rid: string) => routines.find((r) => r.id === rid)?.name ?? '?'
  const move = (i: number, d: -1 | 1) => {
    const next = [...rotation]; const j = i + d
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    save({ ...program, rotation: next })
  }

  return (
    <section>
      <div className="edit-bar">
        <BackLink to="/routines/programs" label={t('programs.title')} />
        {isNew
          ? <button className="primary" onClick={() => void commit()}>{t('common.save')}</button>
          : (
            <span className="edit-bar-actions">
              <button className="icon" aria-label={t('share.link')} title={t('share.link')} onClick={async () => setNote(await shareAsLink(t, program.name, () => packProgramById(id)))}><ShareIcon size={22} /></button>
              <button className="icon danger-ico" aria-label={t('common.delete')} title={t('common.delete')} onClick={() => void remove()}><TrashIcon size={22} /></button>
            </span>
          )}
      </div>
      {note && <p className="muted small" role="status">{note}</p>}
      <input className="title-input" aria-label={t('programs.name')} value={program.name} placeholder={t('programs.name')} onChange={(e) => save({ ...program, name: e.target.value })}
        onBlur={() => !isNew && !program.name.trim() && save({ ...program, name: t('programs.untitled') })} />
      {!isNew && <div className="row">
        <span>{active === id ? <><CheckIcon /> {t('programs.active')}</> : t('programs.notActive')}</span>
        {active === id
          ? <button onClick={() => void setActiveProgramId(undefined)}>{t('programs.deactivate')}</button>
          : <button className="primary" onClick={() => void setActiveProgramId(id)}>{t('programs.setActive')}</button>}
      </div>}

      {gyms.length > 0 && (
        <label className="row">
          {t('programs.defaultGym')}
          <select value={program.gymId && gyms.some((g) => g.id === program.gymId) ? program.gymId : ''}
            onChange={(e) => save({ ...program, gymId: e.target.value || undefined })}>
            <option value="">{t('programs.noDefaultGym')}</option>
            {gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
      )}

      <div className="segmented" role="group" aria-label={t('programs.mode')}>
        <button aria-pressed={program.mode === 'weekday'} className={program.mode === 'weekday' ? 'on' : ''}
          onClick={() => save({ ...program, mode: 'weekday', schedule: resizeSchedule(program.schedule, program.weeks), startDate: program.startDate ?? Date.now() })}>
          {t('programs.modeWeekday')}</button>
        <button aria-pressed={program.mode === 'rotation'} className={program.mode === 'rotation' ? 'on' : ''}
          onClick={() => save({ ...program, mode: 'rotation', rotation: program.rotation ?? [] })}>
          {t('programs.modeRotation')}</button>
      </div>

      {program.mode === 'weekday' ? (
        <>
          <div className="row">
            <label>{t('programs.weeks')} <NumInput label={t('programs.weeks')} value={program.weeks} min={1} max={12}
              onCommit={(v) => v && save({ ...program, weeks: v, schedule: resizeSchedule(program.schedule, v) })} /></label>
            <label>{t('programs.startDate')} <input type="date" value={toDateInput(program.startDate ?? Date.now())}
              onChange={(e) => e.target.value && save({ ...program, startDate: fromDateInput(e.target.value) })} /></label>
          </div>
          <p className="muted small">{t('programs.startHelp')}</p>
          {Array.from({ length: program.weeks }, (_, w) => (
            <details key={w} open={w === 0}>
              <summary>{t('programs.week', { n: w + 1 })}</summary>
              {orderedWeekdays(weekStartDay).map((wd) => (
                <label className="row day" key={wd}>
                  {days[wd]}
                  <select value={program.schedule?.[w]?.[wd] ?? ''} onChange={(e) => {
                    const week = { ...(program.schedule?.[w] ?? {}) }
                    if (e.target.value) week[wd] = e.target.value; else delete week[wd]
                    save({ ...program, schedule: { ...resizeSchedule(program.schedule, program.weeks), [w]: week } })
                  }}>
                    <option value="">{t('programs.restDay')}</option>
                    {routines.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </label>
              ))}
              {w === 0 && program.weeks > 1 && (
                <button onClick={() => save({ ...program, schedule: copyWeekToAll(program.schedule, program.weeks) })}>{t('programs.copyWeek1')}</button>
              )}
            </details>
          ))}
        </>
      ) : (
        <>
          <p className="muted small">{t('programs.rotationHelp')}</p>
          <ol className="rot">
            {rotation.map((rid, i) => (
              <li key={rid} className="row">
                <span><strong>{String.fromCharCode(65 + (i % 26))}</strong> · {rName(rid)}</span>
                <span>
                  <button aria-label="up" disabled={i === 0} onClick={() => move(i, -1)}><ChevronUpIcon /></button>
                  <button aria-label="down" disabled={i === rotation.length - 1} onClick={() => move(i, 1)}><ChevronDownIcon /></button>
                  <button aria-label={t('common.delete')} onClick={() => save({ ...program, rotation: rotation.filter((x) => x !== rid) })}><CloseIcon /></button>
                </span>
              </li>
            ))}
          </ol>
          <select value="" aria-label={t('programs.addRoutine')} onChange={(e) => e.target.value && save({ ...program, rotation: [...rotation, e.target.value] })}>
            <option value="">+ {t('programs.addRoutine')}</option>
            {routines.filter((r) => !rotation.includes(r.id)).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </>
      )}
    </section>
  )
}
