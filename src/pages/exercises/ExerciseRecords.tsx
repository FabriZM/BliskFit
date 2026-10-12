import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Exercise, SetLog } from '../../db/types'
import { formatSet } from '../../lib/format'
import { computePRs, exerciseRecords, type PRKind } from '../../lib/prs'
import { weightUnitFor } from '../../lib/plates'
import { formatNum, kgToDisplay } from '../../lib/units'
import { useSettings } from '../../stores/settings'

const MAX_EVENTS = 15
const MAX_REP_ROWS = 5

/** Current records for an exercise plus the history of when each PR was set. Always derived from the logged sets. */
export default function ExerciseRecords({ exercise }: { exercise: Exercise }) {
  const { t, i18n } = useTranslation()
  const appUnits = useSettings((s) => s.settings.units)
  // Records compare sets typed in different units, so they read in the exercise's unit; single sets show as typed.
  const units = weightUnitFor(exercise, appUnits)
  const sets = useLiveQuery(() => db.setLogs.where('exerciseId').equals(exercise.id).filter((s) => s.doneAt !== undefined).toArray(), [exercise.id])
  const tracking = exercise.trackingType
  const derived = useMemo(() => {
    const all = sets ?? []
    const prs = computePRs(all, tracking)
    const events = all
      .filter((s) => prs.has(s.id))
      .sort((a, b) => b.doneAt! - a.doneAt!)
      .slice(0, MAX_EVENTS)
      .map((s) => ({ set: s, kinds: prs.get(s.id)! }))
    return { records: exerciseRecords(all, tracking), events }
  }, [sets, tracking])

  if (!sets) return null
  const { records, events } = derived
  const date = (s: SetLog) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(s.doneAt)
  const w = (kg: number) => `${tracking === 'bodyweight_added' ? '+' : ''}${formatNum(kgToDisplay(kg, units))} ${units}`

  const rows: { label: string; value: string; set: SetLog }[] = []
  if (records.heaviest) rows.push({ label: t('pr.kind.weight'), value: w(records.heaviest.value), set: records.heaviest.set })
  if (records.e1rm && tracking === 'weight_reps') rows.push({ label: t('pr.kind.e1rm'), value: w(records.e1rm.value), set: records.e1rm.set })
  if (records.volume && records.volume.value > 0) rows.push({ label: t('pr.kind.volume'), value: w(records.volume.value), set: records.volume.set })
  if (records.maxReps) rows.push({ label: t('records.mostReps'), value: String(records.maxReps.value), set: records.maxReps.set })
  if (records.longest) rows.push({ label: t('pr.kind.duration'), value: `${records.longest.value}s`, set: records.longest.set })

  return (
    <>
      <h2>{t('records.title')}</h2>
      {rows.length === 0 && <p className="muted">{t('records.none')}</p>}
      {rows.length > 0 && (
        <ul className="list records">
          {rows.map((r) => (
            <li key={r.label}><div className="row"><span>{r.label}</span><span><strong>{r.value}</strong> <span className="muted small">{date(r.set)}</span></span></div></li>
          ))}
        </ul>
      )}
      {records.repsAtLoad.length > 1 && (
        <>
          <h3>{t('records.repsAtWeight')}</h3>
          <ul className="list records">
            {records.repsAtLoad.slice(0, MAX_REP_ROWS).map((r) => (
              <li key={r.load}><div className="row"><span>{w(r.load)}</span><span><strong>{r.reps}</strong> <span className="muted small">{t('workout.repsUnit')}</span></span></div></li>
            ))}
          </ul>
        </>
      )}
      {events.length > 0 && (
        <>
          <h3>{t('records.history')}</h3>
          <ul className="list records">
            {events.map(({ set, kinds }) => (
              <li key={set.id}>
                <div className="row">
                  <span><span className="pr-badge inline">PR</span> {formatSet(set, tracking, appUnits)}</span>
                  <span className="muted small">{kinds.map((k: PRKind) => t(`pr.kind.${k}`)).join(' · ')} · {date(set)}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
