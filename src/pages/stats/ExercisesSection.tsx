import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SeriesCard from '../../components/stats/SeriesCard'
import { weightUnitFor } from '../../lib/plates'
import { exerciseSeries, isPlateau, metricsFor } from '../../lib/stats'
import { useSettings } from '../../stores/settings'
import ExerciseRecords from '../exercises/ExerciseRecords'
import type { StatsCtx } from './ctx'
import { AlertIcon, StarIcon } from '../../components/Icons'

const SHOWN = 8

/** Pick an exercise you have done, then see a chart per metric that fits its tracking type. */
export default function ExercisesSection({ ctx }: { ctx: StatsCtx }) {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const plateauSessions = useSettings((s) => s.settings.plateauSessions)
  const [query, setQuery] = useState('')
  const { data } = ctx

  // Exercises with history, most recently trained first (favorites first when searching).
  const done = useMemo(() => {
    const last = new Map<string, number>()
    for (const s of data.sets) last.set(s.exerciseId, Math.max(last.get(s.exerciseId) ?? 0, s.doneAt ?? 0))
    return [...last].map(([id, at]) => ({ ex: ctx.exById.get(id), at })).filter((r) => r.ex).map((r) => ({ ex: r.ex!, at: r.at }))
  }, [data.sets, ctx.exById])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return done
      .filter((r) => !q || r.ex.name.toLowerCase().includes(q))
      .sort((a, b) => Number(data.favorites.has(b.ex.id)) - Number(data.favorites.has(a.ex.id)) || b.at - a.at)
  }, [done, query, data.favorites])

  const selectedId = params.get('ex') ?? [...done].sort((a, b) => b.at - a.at)[0]?.ex.id
  const selected = selectedId ? ctx.exById.get(selectedId) : undefined
  const select = (id: string) => setParams((p) => { const n = new URLSearchParams(p); n.set('ex', id); n.delete('card'); return n }, { replace: true })

  if (!done.length) return <div className="card muted">{t('stats.noExerciseHistory')}</div>

  const points = selected ? exerciseSeries(data.sets, data.sessions, selected.id, selected.trackingType) : []
  const metrics = selected ? metricsFor(selected.trackingType) : []
  // Charts of an exercise whose equipment is in other units than the app's read in that unit.
  const exCtx = { ...ctx, units: weightUnitFor(selected, ctx.units) }
  const plateau = selected && (selected.trackingType === 'weight_reps' || selected.trackingType === 'bodyweight_added') && isPlateau(points, 'e1rm', plateauSessions)

  return (
    <>
      <input type="search" placeholder={t('stats.searchExercise')} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t('stats.searchExercise')} />
      <div className="chips picker-chips">
        {matches.slice(0, SHOWN).map(({ ex }) => (
          <button key={ex.id} className={`chip${ex.id === selectedId ? ' on' : ''}`} aria-pressed={ex.id === selectedId} onClick={() => select(ex.id)}>
            {data.favorites.has(ex.id) && <><StarIcon filled className="fav-mark" label={t('exercises.favorites')} /> </>}{ex.name}
          </button>
        ))}
        {selected && !matches.slice(0, SHOWN).some((r) => r.ex.id === selected.id) && <button className="chip on" aria-pressed>{selected.name}</button>}
        {matches.length > SHOWN && <span className="muted small">{t('stats.moreMatches', { count: matches.length - SHOWN })}</span>}
        {matches.length === 0 && <span className="muted small">{t('stats.noMatches')}</span>}
      </div>

      {selected && (
        <>
          <h2 className="stats-ex-name">{selected.name}</h2>
          {plateau && <p className="plateau" role="status"><AlertIcon /> {t('stats.plateau', { count: Math.max(3, plateauSessions) })}</p>}
          {metrics.map((metric) => (
            <SeriesCard key={metric} ctx={exCtx} title={t(`stats.metric_${metric}`)}
              pin={{ kind: 'exercise', exerciseId: selected.id, metric, range: ctx.range }} />
          ))}
          <div className="card" id="card-records">
            <ExerciseRecords exercise={selected} />
          </div>
        </>
      )}
    </>
  )
}
