import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { getActiveProgramId, setActiveProgramId } from '../../db/programs'
import type { Program } from '../../db/types'
import { fromDateInput, orderedWeekdays, toDateInput, weekdayNames } from '../../lib/dates'
import { copyWeekToAll, resizeSchedule } from '../../lib/programs'
import { useSettings } from '../../stores/settings'
import NumInput from '../../components/NumInput'

export default function ProgramEditor() {
  const { t, i18n } = useTranslation()
  const nav = useNavigate()
  const id = useParams().id!
  const weekStartDay = useSettings((s) => s.settings.weekStartDay)
  const [program, setProgram] = useState<Program | null | undefined>()
  const routines = (useLiveQuery(() => db.routines.toArray(), []) ?? []).filter((r) => !r.archived).sort((a, b) => a.name.localeCompare(b.name))
  const active = useLiveQuery(() => getActiveProgramId(), [])

  useEffect(() => { void db.programs.get(id).then((p) => setProgram(p ?? null)) }, [id])
  if (program === undefined) return <p className="muted">…</p>
  if (program === null) return <section><p>{t('programs.notFound')}</p><Link to="/routines/programs">{t('programs.title')}</Link></section>

  const save = (next: Program) => { setProgram(next); void db.programs.put(next) }
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
      <p><Link to="/routines/programs">← {t('programs.title')}</Link></p>
      <input className="title-input" aria-label={t('programs.name')} value={program.name} onChange={(e) => save({ ...program, name: e.target.value })}
        onBlur={() => !program.name.trim() && save({ ...program, name: t('programs.untitled') })} />
      <div className="row">
        <span>{active === id ? `✓ ${t('programs.active')}` : t('programs.notActive')}</span>
        {active === id
          ? <button onClick={() => void setActiveProgramId(undefined)}>{t('programs.deactivate')}</button>
          : <button className="primary" onClick={() => void setActiveProgramId(id)}>{t('programs.setActive')}</button>}
      </div>

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
                  <button aria-label="up" disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
                  <button aria-label="down" disabled={i === rotation.length - 1} onClick={() => move(i, 1)}>▼</button>
                  <button aria-label={t('common.delete')} onClick={() => save({ ...program, rotation: rotation.filter((x) => x !== rid) })}>✕</button>
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

      <div className="actions">
        <button className="danger" onClick={async () => {
          if (!confirm(t('programs.confirmDelete'))) return
          if (active === id) await setActiveProgramId(undefined)
          await db.programs.delete(id)
          nav('/routines/programs', { replace: true })
        }}>{t('common.delete')}</button>
      </div>
    </section>
  )
}
