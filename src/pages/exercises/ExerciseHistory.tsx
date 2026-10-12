import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Exercise, SetLog } from '../../db/types'
import PRBadge from '../../components/PRBadge'
import { formatSet, formatShortDate } from '../../lib/format'
import { computePRs } from '../../lib/prs'
import { useSettings } from '../../stores/settings'

const PAGE = 20
const PREFIX = { warmup: 'W ', drop: 'D ', working: '' } as const

/** Every finished workout that included this exercise, newest first, with its sets as logged. Opens the workout. */
export default function ExerciseHistory({ exercise }: { exercise: Exercise }) {
  const { t } = useTranslation()
  const units = useSettings((s) => s.settings.units)
  const [shown, setShown] = useState(PAGE)

  const data = useLiveQuery(async () => {
    const sets = await db.setLogs.where('exerciseId').equals(exercise.id).filter((s) => s.doneAt !== undefined).toArray()
    const sessions = (await db.sessions.bulkGet([...new Set(sets.map((s) => s.sessionId))]))
      .filter((s) => s !== undefined && s.status === 'finished')
    const routines = new Map((await db.routines.bulkGet([...new Set(sessions.flatMap((s) => (s!.routineId ? [s!.routineId] : [])))]))
      .flatMap((r) => (r ? [[r.id, r.name] as const] : [])))
    const gyms = new Map((await db.gyms.toArray()).map((g) => [g.id, g.name]))
    return { sets, sessions: sessions.map((s) => s!), routines, gyms }
  }, [exercise.id])

  const entries = useMemo(() => {
    if (!data) return []
    const bySession = new Map<string, SetLog[]>()
    for (const s of data.sets) bySession.set(s.sessionId, [...(bySession.get(s.sessionId) ?? []), s])
    return data.sessions
      .map((session) => ({ session, sets: (bySession.get(session.id) ?? []).sort((a, b) => a.order - b.order || a.doneAt! - b.doneAt!) }))
      .sort((a, b) => b.session.startedAt - a.session.startedAt)
  }, [data])
  const prs = useMemo(() => computePRs(data?.sets ?? [], exercise.trackingType), [data, exercise.trackingType])

  if (!data) return null
  if (!entries.length) return <p className="card muted">{t('exercises.noHistory')}</p>
  const back = { back: `/exercises/${encodeURIComponent(exercise.id)}?tab=history` }

  return (
    <>
      <p className="muted small">{t('exercises.historyCount', { count: entries.length })}</p>
      <ul className="list ex-history">
        {entries.slice(0, shown).map(({ session, sets }) => {
          const routine = session.routineId ? data.routines.get(session.routineId) : undefined
          const gym = session.gymId ? data.gyms.get(session.gymId) : undefined
          return (
            <li key={session.id}>
              <Link to={`/workout/history/${session.id}`} state={back}>
                <strong>{formatShortDate(session.startedAt)} · {routine ?? t('workout.empty')}</strong>
                {gym && <span className="muted small">{gym}</span>}
                <span className="setchips">
                  {sets.map((s) => (
                    <span className={`setchip${s.setType === 'warmup' ? ' warmup' : ''}`} key={s.id}>
                      {PREFIX[s.setType]}{formatSet(s, exercise.trackingType, units)}
                      {prs.get(s.id) && <PRBadge inline kinds={prs.get(s.id)!} />}
                    </span>
                  ))}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      {entries.length > shown && <button onClick={() => setShown((n) => n + PAGE)}>{t('exercises.more')}</button>}
    </>
  )
}
