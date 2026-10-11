import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Point } from '../../lib/stats'

const W = 320, H = 150
const M = { l: 40, r: 10, t: 10, b: 22 }
const PW = W - M.l - M.r, PH = H - M.t - M.b

/** 3-4 round tick values spanning [min, max]. */
export function niceTicks(min: number, max: number): number[] {
  if (!(max > min)) { const pad = Math.max(1, Math.abs(min) * 0.1); min -= pad; max += pad }
  const raw = (max - min) / 3
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const out: number[] = []
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.999; v += step) out.push(Math.round(v / step) * step)
  return out
}

/**
 * Value over time. Marks: a 2px line with dots (hidden when there are many points), hairline gridlines, an optional
 * lighter trend line. Tap/hover or arrow keys pick a point for the readout below; a table view lists every value,
 * so nothing depends on seeing the chart.
 */
export default function LineChart({ label, points, trend, format, lowerBetter = false }: {
  label: string
  points: Point[]
  trend?: Point[]
  format: (v: number) => string
  lowerBetter?: boolean
}) {
  const { t, i18n } = useTranslation()
  const [sel, setSel] = useState<number | null>(null)
  const date = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', year: points.length && new Date(points[0].at).getFullYear() !== new Date(points[points.length - 1].at).getFullYear() ? '2-digit' : undefined })
  if (!points.length) return <p className="muted small">{t('stats.noData')}</p>

  const values = [...points, ...(trend ?? [])].map((p) => p.value)
  const ticks = niceTicks(Math.min(...values), Math.max(...values))
  const lo = ticks[0], hi = ticks[ticks.length - 1]
  const t0 = points[0].at, t1 = points[points.length - 1].at
  const x = (at: number) => (t1 === t0 ? M.l + PW / 2 : M.l + ((at - t0) / (t1 - t0)) * PW)
  const y = (v: number) => M.t + PH - ((v - lo) / (hi - lo || 1)) * PH
  const path = (list: Point[]) => list.map((p, i) => `${i ? 'L' : 'M'}${x(p.at).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')

  const n = points.length
  const shown = sel ?? n - 1
  const cur = points[shown]
  const prev = shown > 0 ? points[shown - 1] : undefined
  const pick = (clientX: number, el: SVGSVGElement) => {
    const rect = el.getBoundingClientRect()
    const px = ((clientX - rect.left) / rect.width) * W
    let best = 0
    points.forEach((p, i) => { if (Math.abs(x(p.at) - px) < Math.abs(x(points[best].at) - px)) best = i })
    setSel(best)
  }
  const better = prev && cur.value !== prev.value && (lowerBetter ? cur.value < prev.value : cur.value > prev.value)

  return (
    <div className="line-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={label} tabIndex={0} className="chart-svg"
        onPointerMove={(e) => e.pointerType === 'mouse' && pick(e.clientX, e.currentTarget)}
        onPointerDown={(e) => pick(e.clientX, e.currentTarget)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setSel(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); setSel(Math.max(0, shown - 1)) }
          if (e.key === 'ArrowRight') { e.preventDefault(); setSel(Math.min(n - 1, shown + 1)) }
          if (e.key === 'Escape') setSel(null)
        }}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} className="chart-grid" />
            <text x={M.l - 6} y={y(v) + 3} textAnchor="end" className="chart-tick">{format(v).replace(/ (kg|lb|cm)$/, '')}</text>
          </g>
        ))}
        <text x={M.l} y={H - 6} className="chart-tick">{date.format(t0)}</text>
        {n > 1 && <text x={W - M.r} y={H - 6} textAnchor="end" className="chart-tick">{date.format(t1)}</text>}
        {trend && trend.length > 1 && <path d={path(trend)} className="chart-trend" fill="none" />}
        {n > 1 && <path d={path(points)} className={trend ? 'chart-raw' : 'chart-line'} fill="none" />}
        {(n <= 40 || trend) && points.map((p, i) => <circle key={p.at + ':' + i} cx={x(p.at)} cy={y(p.value)} r={n > 40 ? 1.5 : 2.5} className={trend ? 'chart-dot-raw' : 'chart-dot'} />)}
        {sel !== null && <line x1={x(cur.at)} x2={x(cur.at)} y1={M.t} y2={M.t + PH} className="chart-cursor" />}
        <circle cx={x(cur.at)} cy={y(cur.value)} r={4} className="chart-dot-sel" />
      </svg>
      <p className="chart-readout" aria-live="polite">
        <strong>{format(cur.value)}</strong> · <span className="muted">{date.format(cur.at)}</span>
        {prev && cur.value !== prev.value && <span className={better ? 'delta good' : 'delta'}> · {cur.value > prev.value ? '▲' : '▼'} {format(Math.abs(cur.value - prev.value))}</span>}
      </p>
      <details className="chart-table">
        <summary>{t('chart.table')}</summary>
        <table>
          <thead><tr><th>{t('stats.date')}</th><th>{t('stats.value')}</th>{trend && <th>{t('stats.trend')}</th>}</tr></thead>
          <tbody>
            {[...points].reverse().map((p, i) => (
              <tr key={p.at + ':' + i}><td>{date.format(p.at)}</td><td>{format(p.value)}</td>{trend && <td>{format(trend[n - 1 - i]?.value ?? p.value)}</td>}</tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
