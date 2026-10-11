import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useGoalHistory } from '../db/goals'
import { dateKey, goalForWeek, trainingDayKeys, weeklyBars } from '../lib/goals'
import { useNow } from '../lib/useNow'
import { useSettings } from '../stores/settings'

const RANGES = [{ key: '8w', weeks: 8 }, { key: '6m', weeks: 26 }, { key: '1y', weeks: 52 }] as const

// Chart geometry (viewBox units; the SVG scales to the card width).
const W = 320, H = 170
const M = { l: 24, r: 46, t: 10, b: 24 }
const PW = W - M.l - M.r, PH = H - M.t - M.b
const BASE = M.t + PH

/**
 * Workouts (distinct training days) per week with the goal that applied in each week.
 * Marks: thin bars (<= 24px) with a rounded tip on a square baseline, hairline gridlines, a 2px goal step line.
 * Goal met = accent, missed = neutral grey (the pair separates well for colour-blind and normal vision), the
 * current week is a lighter wash while in progress. Identity never relies on colour alone: the goal line is
 * labelled, a key names the states, a readout spells out each week, and a table view lists every value.
 */
export default function GoalChart() {
  const { t, i18n } = useTranslation()
  const { weeklyGoal, weekStartDay } = useSettings((s) => s.settings)
  const history = useGoalHistory()
  const now = useNow(60_000)
  const sessions = useLiveQuery(() => db.sessions.where('status').equals('finished').toArray(), [])
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('8w')
  const [sel, setSel] = useState<number | null>(null)
  if (!sessions) return null

  const weeks = RANGES.find((r) => r.key === range)!.weeks
  const goalFor = (ws: Date) => goalForWeek(history, dateKey(ws), weeklyGoal)
  const bars = weeklyBars(trainingDayKeys(sessions), new Date(now), weekStartDay, weeks, goalFor)
  const n = bars.length
  const slot = PW / n
  const barW = Math.min(24, Math.max(2, slot - 2)) // >= 2px surface gap between bars
  const yMax = Math.max(1, ...bars.map((b) => b.count), ...bars.map((b) => b.goal))
  const y = (v: number) => BASE - (v / yMax) * PH
  const xSlot = (i: number) => M.l + i * slot
  const shown = sel ?? n - 1
  const bar = bars[shown]

  const month = new Intl.DateTimeFormat(i18n.language, { month: 'short' })
  const dayMonth = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' })

  // Goal as a step line, so a changed goal shows from the week it took effect.
  const goalPath = bars.map((b, i) => `${i === 0 ? 'M' : 'L'}${xSlot(i)},${y(b.goal)} L${xSlot(i + 1)},${y(b.goal)}`).join(' ')

  const barPath = (i: number, count: number) => {
    const h = (count / yMax) * PH
    if (h <= 0) return ''
    const x = xSlot(i) + (slot - barW) / 2
    const r = Math.min(4, barW / 2, h)
    return `M${x},${BASE} V${BASE - h + r} Q${x},${BASE - h} ${x + r},${BASE - h} H${x + barW - r} Q${x + barW},${BASE - h} ${x + barW},${BASE - h + r} V${BASE} Z`
  }

  const fill = (b: (typeof bars)[number]) => (b.met ? 'var(--accent)' : 'var(--chart-missed)')
  const opacity = (b: (typeof bars)[number]) => (b.current && !b.met ? 0.45 : 1)

  const pick = (clientX: number, el: SVGSVGElement) => {
    const rect = el.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * W
    setSel(Math.max(0, Math.min(n - 1, Math.floor((x - M.l) / slot))))
  }

  // x labels: every week for 8 weeks, otherwise the first week of a month (quarterly for a year)
  const xLabels = bars.flatMap((b, i) => {
    if (n <= 8) return (n - 1 - i) % 2 === 0 ? [{ i, text: dayMonth.format(b.start) }] : []
    const prev = bars[i - 1]
    const newMonth = !prev || prev.start.getMonth() !== b.start.getMonth()
    return newMonth && (n <= 26 || b.start.getMonth() % 3 === 0) ? [{ i, text: month.format(b.start) }] : []
  })

  const status = bar.current && !bar.met ? t('chart.inProgress') : bar.met ? t('chart.goalMet') : t('chart.goalMissed')

  return (
    <div className="card goal-chart">
      <h2>{t('chart.title')}</h2>
      <div className="chart-filters">
        <div className="segmented small-seg" role="group" aria-label={t('chart.range')}>
          {RANGES.map((r) => (
            <button key={r.key} className={range === r.key ? 'on' : ''} aria-pressed={range === r.key}
              onClick={() => { setRange(r.key); setSel(null) }}>{t(`chart.range_${r.key}`)}</button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={t('chart.title')} tabIndex={0} className="chart-svg"
        onPointerMove={(e) => e.pointerType === 'mouse' && pick(e.clientX, e.currentTarget)}
        onPointerDown={(e) => pick(e.clientX, e.currentTarget)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setSel(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); setSel(Math.max(0, shown - 1)) }
          if (e.key === 'ArrowRight') { e.preventDefault(); setSel(Math.min(n - 1, shown + 1)) }
          if (e.key === 'Escape') setSel(null)
        }}>
        {/* gridlines + y ticks: hairline, solid, recessive */}
        {Array.from({ length: yMax + 1 }, (_, v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} className="chart-grid" />
            <text x={M.l - 6} y={y(v) + 3} textAnchor="end" className="chart-tick">{v}</text>
          </g>
        ))}
        {sel !== null && <rect x={xSlot(shown)} y={M.t} width={slot} height={PH} className="chart-sel" />}
        {bars.map((b, i) => <path key={b.key} d={barPath(i, b.count)} fill={fill(b)} opacity={opacity(b)} />)}
        <path d={goalPath} className="chart-goal" fill="none" />
        <text x={W - M.r + 6} y={y(bars[n - 1].goal) + 3} className="chart-goal-label">{t('chart.goal', { count: bars[n - 1].goal })}</text>
        {xLabels.map((l) => (
          <text key={l.i} x={xSlot(l.i) + slot / 2} y={H - 8} textAnchor={n <= 8 ? 'middle' : 'start'} className="chart-tick">{l.text}</text>
        ))}
      </svg>

      <p className="chart-readout" aria-live="polite">
        <strong>{dayMonth.format(bar.start)}</strong> · {t('profile.daysOfGoal', { count: bar.count, goal: bar.goal })} · <span className="muted">{status}</span>
      </p>

      <div className="chart-key muted small">
        <span><i className="sw met" />{t('chart.goalMet')}</span>
        <span><i className="sw missed" />{t('chart.goalMissed')}</span>
        <span><i className="sw wip" />{t('chart.inProgress')}</span>
      </div>

      <details className="chart-table">
        <summary>{t('chart.table')}</summary>
        <table>
          <thead><tr><th>{t('chart.week')}</th><th>{t('chart.days')}</th><th>{t('chart.goalCol')}</th></tr></thead>
          <tbody>
            {[...bars].reverse().map((b) => (
              <tr key={b.key}><td>{dayMonth.format(b.start)}</td><td>{b.count}</td><td>{b.goal}{b.met ? ' ✓' : ''}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
