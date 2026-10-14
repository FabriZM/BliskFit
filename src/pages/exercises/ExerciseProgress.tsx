import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Exercise, ExerciseMetric, StatsRange } from '../../db/types'
import LineChart from '../../components/stats/LineChart'
import PinButton from '../../components/stats/PinButton'
import { formatDelta, formatValue, metricUnit } from '../../lib/pinCards'
import { weightUnitFor } from '../../lib/plates'
import { changeOver, exerciseSeries, lowerIsBetter, metricPoints, metricsFor, RANGES, rangeStart } from '../../lib/stats'
import { useSettings } from '../../stores/settings'
import ExerciseRecords from './ExerciseRecords'
import { useExerciseName } from '../../lib/exerciseName'

/** The exercise's chart (one metric at a time, same series as Stats → Exercises) and its records. */
export default function ExerciseProgress({ exercise }: { exercise: Exercise }) {
  const { t } = useTranslation()
  const exName = useExerciseName()
  const appUnits = useSettings((s) => s.settings.units)
  const units = weightUnitFor(exercise, appUnits)
  const metrics = metricsFor(exercise.trackingType)
  const [metric, setMetric] = useState<ExerciseMetric>(metrics[0])
  const [range, setRange] = useState<StatsRange>('all')

  const data = useLiveQuery(async () => {
    const sets = await db.setLogs.where('exerciseId').equals(exercise.id).toArray()
    const sessions = await db.sessions.bulkGet([...new Set(sets.map((s) => s.sessionId))])
    return { sets, sessions: sessions.filter((s) => s !== undefined) }
  }, [exercise.id])
  const series = useMemo(() => (data ? exerciseSeries(data.sets, data.sessions, exercise.id, exercise.trackingType) : []), [data, exercise.id, exercise.trackingType])

  if (!data) return null
  const points = metricPoints(series, metric, rangeStart(range, new Date()))
  const unit = metricUnit(metric)
  const fmt = (v: number) => formatValue(v, unit, units)
  const change = points.length > 1 ? changeOver(points) : undefined
  const title = t(`stats.metric_${metric}`)

  return (
    <>
      {series.length === 0 ? <p className="card muted">{t('exercises.noProgress')}</p> : (
        <div className="card stat-card">
          {metrics.length > 1 && (
            <div className="segmented small-seg metric-seg" role="group" aria-label={t('exercises.metric')}>
              {metrics.map((m) => (
                <button key={m} className={m === metric ? 'on' : ''} aria-pressed={m === metric} onClick={() => setMetric(m)}>{t(`stats.metric_${m}`)}</button>
              ))}
            </div>
          )}
          <div className="row head">
            <h3>{title}</h3>
            <PinButton pin={{ kind: 'exercise', exerciseId: exercise.id, metric, range }} label={`${exName(exercise)}: ${title}`} />
          </div>
          <LineChart label={title} points={points} format={fmt} lowerBetter={lowerIsBetter(metric)} />
          {change && <p className="small muted">{t('stats.change')}: <strong>{formatDelta(change.delta, unit, units)}</strong> ({fmt(change.first)} → {fmt(change.last)})</p>}
          <div className="segmented small-seg range-seg" role="group" aria-label={t('chart.range')}>
            {RANGES.map((r) => (
              <button key={r} className={r === range ? 'on' : ''} aria-pressed={r === range} onClick={() => setRange(r)}>{t(`stats.range_${r}`)}</button>
            ))}
          </div>
        </div>
      )}
      <ExerciseRecords exercise={exercise} />
    </>
  )
}
