import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { PinSpec } from '../../db/types'
import { cardId, formatDelta, formatValue, pinSeries } from '../../lib/pinCards'
import { changeOver } from '../../lib/stats'
import type { StatsCtx } from '../../pages/stats/ctx'
import LineChart from './LineChart'
import PinButton from './PinButton'

/** A titled chart card for a pinnable series, with the change (or weekly average) over the range. */
export default function SeriesCard({ pin, title, ctx, children }: { pin: PinSpec; title: string; ctx: StatsCtx; children?: ReactNode }) {
  const { t } = useTranslation()
  const series = pinSeries(pin, ctx.input, ctx.weekStartDay, ctx.today)
  const weekly = series?.unit === 'sessions' || series?.unit === 'sets'
  const change = series && !weekly ? changeOver(series.points) : undefined
  const avg = series && weekly && series.points.length ? series.points.reduce((a, p) => a + p.value, 0) / series.points.length : undefined
  const fmt = (v: number) => formatValue(v, series!.unit, ctx.units)
  return (
    <div className="card stat-card" id={cardId(pin)}>
      <div className="row head">
        <h3>{title}</h3>
        <PinButton pin={pin} label={title} />
      </div>
      {series && (
        <>
          <LineChart label={title} points={series.points} trend={series.trend} format={fmt} lowerBetter={series.lowerBetter} />
          {change && series.points.length > 1 && (
            <p className="small muted">{t('stats.change')}: <strong>{formatDelta(change.delta, series.unit, ctx.units)}</strong> ({fmt(change.first)} → {fmt(change.last)})</p>
          )}
          {avg !== undefined && <p className="small muted">{t('stats.avgPerWeek')}: <strong>{formatValue(avg, series.unit, ctx.units)}</strong></p>}
        </>
      )}
      {children}
    </div>
  )
}
