import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Exercise, SetLog } from '../../db/types'
import { discardSession } from '../../db/workout'
import { deleteSet, setGym, shiftSession, updateSet } from '../../db/workout'
import PRBadge from '../../components/PRBadge'
import { formatSet } from '../../lib/format'
import { computeAllPRs } from '../../lib/prs'
import { formatClock, formatNum, kgToDisplay } from '../../lib/units'
import { elapsedMs, sessionStats } from '../../lib/workout'
import { useSettings } from '../../stores/settings'
import { SetFields } from './SetRow'
import SummaryImage from './SummaryImage'
import { autoBackupToDrive } from '../../db/driveBackup'
import { BackLink } from '../../components/PageHeader'
import { PencilIcon, TrashIcon } from '../../components/Icons'

/** Saves while typing (debounced) and on blur, so a note is never lost if the app is closed mid-edit. */
function NotesEditor({ sessionId, initial, placeholder }: { sessionId: string; initial: string; placeholder: string }) {
  const [text, setText] = useState(initial)
  const save = (v: string) => void db.sessions.update(sessionId, { notes: v.trim() || undefined })
  useEffect(() => {
    if (text === initial) return
    const timer = setTimeout(() => save(text), 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the text drives saving
  }, [text])
  return <textarea rows={3} value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} onBlur={() => save(text)} />
}

/** Value for <input type="datetime-local"> (local time, minute precision). */
const toLocalInput = (ms: number) => {
  const d = new Date(ms), p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

const PREFIX = { warmup: 'W ', drop: 'D ', working: '' } as const

/**
 * A finished workout: stats, PRs, notes and sets, with editing and deleting. Shown right after finishing
 * (`justFinished`) and when opened from History. PRs are recomputed from all history on every render, so
 * editing or deleting a set updates every badge, here and elsewhere.
 */
export default function SessionDetail({ justFinished = false }: { justFinished?: boolean }) {
  const { t, i18n } = useTranslation()
  const nav = useNavigate()
  const id = useParams().id!
  const units = useSettings((s) => s.settings.units)
  const showPR = useSettings((s) => s.settings.prBadges)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [sharing, setSharing] = useState(false)

  // A finished workout is the moment worth saving: back it up to Drive right away (if connected).
  useEffect(() => { if (justFinished) void autoBackupToDrive(true) }, [justFinished, id])

  const data = useLiveQuery(async () => {
    const session = await db.sessions.get(id)
    if (!session) return { session: undefined }
    const sets = (await db.setLogs.where('sessionId').equals(id).toArray()).filter((s) => s.doneAt !== undefined)
    const exIds = [...new Set(sets.map((s) => s.exerciseId))]
    const exercises = new Map((await db.exercises.bulkGet(exIds)).filter((e): e is Exercise => !!e).map((e) => [e.id, e]))
    const history = (await Promise.all(exIds.map((e) => db.setLogs.where('exerciseId').equals(e).filter((s) => s.doneAt !== undefined).toArray()))).flat()
    const routine = session.routineId ? await db.routines.get(session.routineId) : undefined
    const gyms = await db.gyms.toArray()
    return { session, sets, exercises, history, routineName: routine?.name, gyms }
  }, [id])

  if (!data) return <p className="muted">…</p>
  const { session } = data
  if (!session) return <section><p>{t('workout.notFound')}</p><Link to="/workout/history">{t('history.title')}</Link></section>
  const { sets, exercises, history, routineName, gyms } = data as Required<typeof data>
  const gymName = gyms.find((g) => g.id === session.gymId)?.name

  const trackingOf = (eid: string) => exercises.get(eid)?.trackingType ?? 'weight_reps'
  const prs = computeAllPRs(history, trackingOf)
  const stats = sessionStats(sets, trackingOf)
  const prCount = sets.filter((s) => (prs.get(s.id)?.length ?? 0) > 0).length
  const items = session.exercises.filter((it) => sets.some((s) => s.itemId === it.id))
  const byItem = (itemId: string): SetLog[] => sets.filter((s) => s.itemId === itemId).sort((a, b) => a.order - b.order)
  const dayFmt = new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })
  const timeFmt = new Intl.DateTimeFormat(i18n.language, { hour: 'numeric', minute: '2-digit' })

  return (
    <section>
      <BackLink to={justFinished ? '/workout' : '/workout/history'} label={justFinished ? t('tabs.workout') : t('history.title')} />
      <h1>{justFinished ? t('summary.title') : dayFmt.format(session.startedAt)}</h1>
      <p className="muted">
        {routineName ?? t('workout.empty')}{gymName ? ` · ${gymName}` : ''} · {timeFmt.format(session.startedAt)}{session.endedAt ? `–${timeFmt.format(session.endedAt)}` : ''}
      </p>

      <div className="stats">
        <div><strong>{formatClock(elapsedMs(session, Date.now()))}</strong><span>{t('summary.duration')}</span></div>
        <div><strong>{stats.sets}</strong><span>{t('summary.sets')}</span></div>
        <div><strong>{formatNum(kgToDisplay(stats.volume, units))} {units}</strong><span>{t('summary.volume')}</span></div>
        {showPR
          ? <div className={prCount ? 'pr-tile' : ''}><strong>{prCount}</strong><span>{t('summary.prs')}</span></div>
          : <div><strong>{stats.exercises}</strong><span>{t('summary.exercises')}</span></div>}
      </div>

      {editing && (
        <div className="edit-meta form">
          <label>{t('detail.dateTime')}
            <input type="datetime-local" value={toLocalInput(session.startedAt)}
              onChange={(e) => { const ms = new Date(e.target.value).getTime(); if (Number.isFinite(ms)) void shiftSession(id, ms) }} />
          </label>
          {gyms.length > 0 && (
            <label>{t('gyms.gym')}
              <select value={session.gymId && gyms.some((g) => g.id === session.gymId) ? session.gymId : ''} onChange={(e) => void setGym(id, e.target.value || undefined)}>
                <option value="">{t('workout.noGym')}</option>
                {gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
          )}
        </div>
      )}

      {(editing || session.notes) && (
        <div className="notes-block">
          <h2>{t('detail.notes')}</h2>
          {editing
            ? <NotesEditor sessionId={id} initial={session.notes ?? ''} placeholder={t('detail.notesPlaceholder')} />
            : <p>{session.notes}</p>}
        </div>
      )}

      {items.length === 0 && <p className="muted">{t('detail.noSets')}</p>}
      <ul className="list detail-list">
        {items.map((it) => {
          const ex = exercises.get(it.exerciseId)
          const list = byItem(it.id)
          let working = 0
          return (
            <li key={it.id}>
              <div>
                <strong><Link to={`/exercises/${encodeURIComponent(it.exerciseId)}`}>{ex?.name ?? '…'}</Link></strong>
                {editing ? (
                  <ul className="sets">
                    {list.map((s) => {
                      const label = s.setType === 'warmup' ? 'W' : s.setType === 'drop' ? 'D' : String(++working)
                      return (
                        <li className="set" key={s.id}>
                          <div className="set-body"><div className="set-main">
                            <span className="label-wrap"><span className={`set-label static ${s.setType}`}>{label}</span>
                              {prs.get(s.id) && <PRBadge kinds={prs.get(s.id)!} />}</span>
                            <SetFields set={s} tracking={trackingOf(s.exerciseId)} units={units} onChange={(patch) => void updateSet(s.id, patch)} />
                            <button className="icon" aria-label={t('workout.deleteSet')} onClick={() => void deleteSet(s.id)}><TrashIcon /></button>
                          </div></div>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <div className="setchips">
                    {list.map((s) => (
                      <span className="setchip" key={s.id}>
                        {PREFIX[s.setType]}{formatSet(s, trackingOf(s.exerciseId), units)}
                        {prs.get(s.id) && <PRBadge inline kinds={prs.get(s.id)!} />}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <div className="actions">
        <button className={editing ? 'primary' : ''} onClick={() => setEditing(!editing)}>{editing ? t('detail.doneEditing') : <><PencilIcon /> {t('detail.edit')}</>}</button>
        {items.length > 0 && !editing && <button onClick={() => setSharing(true)}>{t('summary.shareImage')}</button>}
        <button className="danger" onClick={() => setConfirmDelete(true)}>{t('detail.deleteWorkout')}</button>
      </div>
      {sharing && (
        <SummaryImage onClose={() => setSharing(false)} input={{
          title: routineName ?? t('workout.empty'),
          date: `${dayFmt.format(session.startedAt)} · ${timeFmt.format(session.startedAt)}`,
          stats: [
            { value: formatClock(elapsedMs(session, Date.now())), label: t('summary.duration') },
            { value: String(stats.sets), label: t('summary.sets') },
            { value: `${formatNum(kgToDisplay(stats.volume, units))} ${units}`, label: t('summary.volume') },
            showPR ? { value: String(prCount), label: t('summary.prs') } : { value: String(stats.exercises), label: t('summary.exercises') },
          ],
          items, sets, units, trackingOf,
          names: new Map([...exercises].map(([k, e]) => [k, e.name])),
          prs: showPR ? prs : new Map(),
        }} />
      )}
      {justFinished && <Link className="btn wide-link" to="/workout">{t('common.done')}</Link>}

      {confirmDelete && (
        <div className="modal" role="alertdialog" aria-modal="true">
          <div className="modal-card">
            <h2>{t('detail.deleteWorkout')}</h2>
            <p className="muted">{t('detail.confirmDelete')}</p>
            <button className="danger" onClick={async () => { await discardSession(id); nav('/workout/history', { replace: true }) }}>{t('common.delete')}</button>
            <button onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</button>
          </div>
        </div>
      )}
    </section>
  )
}
