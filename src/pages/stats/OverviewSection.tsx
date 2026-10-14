import { useTranslation } from 'react-i18next'
import PRBadge from '../../components/PRBadge'
import SeriesCard from '../../components/stats/SeriesCard'
import { formatSet } from '../../lib/format'
import { dateKey } from '../../lib/goals'
import { weekStart } from '../../lib/programs'
import { muscleLabel } from '../../lib/muscles'
import { formatNum, kgToDisplay } from '../../lib/units'
import { rollUp, sumMuscles, underTrained, weekSeries } from '../../lib/stats'
import { useSettings } from '../../stores/settings'
import type { StatsCtx } from './ctx'
import { TrendDownIcon, TrendUpIcon } from '../../components/Icons'
import { useExerciseName } from '../../lib/exerciseName'

const UNDER_WEEKS = 4

function Delta({ cur, prev, good = true }: { cur: number; prev: number; good?: boolean }) {
  const { t } = useTranslation()
  const d = Math.round((cur - prev) * 10) / 10
  if (!d) return <small className="muted">{t('stats.sameAsLast')}</small>
  return <small className={d > 0 === good ? 'delta good' : 'delta'}>{d > 0 ? <TrendUpIcon /> : <TrendDownIcon />} {formatNum(Math.abs(d))}</small>
}

/** Weekly summary against last week, under-trained muscles, recent PRs. */
export default function OverviewSection({ ctx }: { ctx: StatsCtx }) {
  const { t, i18n } = useTranslation()
  const exName = useExerciseName()
  const { setsTarget } = useSettings((s) => s.settings)
  const { derived, data, today, weekStartDay, units } = ctx

  const thisKey = dateKey(weekStart(today, weekStartDay))
  const prevStart = weekStart(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7), weekStartDay)
  const empty = { sessions: 0, sets: 0, volume: 0, prs: 0 }
  const cur = derived.buckets.get(thisKey) ?? empty
  const prev = derived.buckets.get(dateKey(prevStart)) ?? empty

  const recentWeeks = weekSeries(derived.buckets, weekStartDay, today, new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7 * (UNDER_WEEKS - 1)))
  const totals = rollUp(sumMuscles(recentWeeks), data.muscles)
  const under = underTrained(totals, data.muscles, recentWeeks.length, setsTarget)
  const muscleById = new Map(data.muscles.map((m) => [m.id, m]))

  const fmtDate = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' })
  const recent = data.sets
    .filter((s) => derived.prs.has(s.id))
    .sort((a, b) => b.doneAt! - a.doneAt!)
    .slice(0, 8)

  const volume = (v: number) => formatNum(Math.round(kgToDisplay(v, units)))
  const tiles = [
    { key: 'sessions', cur: cur.sessions, prev: prev.sessions, text: String(cur.sessions) },
    { key: 'sets', cur: cur.sets, prev: prev.sets, text: String(cur.sets) },
    { key: 'volume', cur: kgToDisplay(cur.volume, units), prev: kgToDisplay(prev.volume, units), text: `${volume(cur.volume)} ${units}` },
    { key: 'prs', cur: cur.prs, prev: prev.prs, text: String(cur.prs) },
  ]

  return (
    <>
      <div className="card" id="card-summary">
        <h3>{t('stats.thisWeek')}</h3>
        <div className="summary-tiles">
          {tiles.map((x) => (
            <div key={x.key}>
              <small className="muted">{t(`stats.tile_${x.key}`)}</small>
              <strong>{x.text}</strong>
              <Delta cur={x.cur} prev={x.prev} />
            </div>
          ))}
        </div>
        <p className="muted small">{t('stats.vsLastWeek')}</p>
        <h4>{t('stats.underTrained')}</h4>
        {under.length === 0
          ? <p className="muted small">{t('stats.noneUnder', { target: setsTarget })}</p>
          : (
            <ul className="plain">
              {under.map((u) => (
                <li key={u.muscleId}>{muscleLabel(muscleById.get(u.muscleId)!, t)} <span className="muted">{t('stats.setsPerWeek', { count: Math.round(u.perWeek * 10) / 10 })}</span></li>
              ))}
            </ul>
          )}
        <p className="muted small">{t('stats.underHelp', { weeks: UNDER_WEEKS, target: setsTarget })}</p>
      </div>

      <SeriesCard pin={{ kind: 'weekly', range: ctx.range }} title={t('stats.sessionsPerWeek')} ctx={ctx} />

      <div className="card" id="card-prs">
        <h3>{t('stats.recentPRs')}</h3>
        {recent.length === 0 && <p className="muted small">{t('stats.noPRs')}</p>}
        <ul className="plain">
          {recent.map((s) => {
            const ex = ctx.exById.get(s.exerciseId)
            return (
              <li key={s.id} className="row">
                <span>{exName(ex, '?')} <PRBadge kinds={derived.prs.get(s.id)!} inline /></span>
                <span className="muted">{ex ? formatSet(s, ex.trackingType, units) : ''} · {fmtDate.format(s.doneAt!)}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}
