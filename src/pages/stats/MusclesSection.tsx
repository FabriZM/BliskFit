import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import PinButton from '../../components/stats/PinButton'
import AsymmetryList from '../../components/stats/AsymmetryList'
import SeriesCard from '../../components/stats/SeriesCard'
import { cardId } from '../../lib/pinCards'
import { muscleLabel } from '../../lib/muscles'
import { formatNum, kgToDisplay } from '../../lib/units'
import { pushPull, rollUp, sumMuscles, underTrained, weekSeries } from '../../lib/stats'
import { useSettings } from '../../stores/settings'
import type { StatsCtx } from './ctx'
import { ChevronDownIcon, ChevronRightIcon } from '../../components/Icons'

/** Weekly sets (or volume) per muscle group with drill-down, push/pull balance, left/right asymmetry, under-trained list. */
export default function MusclesSection({ ctx }: { ctx: StatsCtx }) {
  const { t } = useTranslation()
  const setsTarget = useSettings((s) => s.settings.setsTarget)
  const update = useSettings((s) => s.update)
  const [metric, setMetric] = useState<'sets' | 'volume'>('sets')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const { data, units } = ctx

  const weeks = weekSeries(ctx.derived.buckets, ctx.weekStartDay, ctx.today, ctx.from)
  const direct = sumMuscles(weeks)
  const totals = rollUp(direct, data.muscles)
  const n = Math.max(1, weeks.length)
  const per = (id: string) => (metric === 'sets' ? (totals.get(id)?.sets ?? 0) : kgToDisplay(totals.get(id)?.volume ?? 0, units)) / n
  const roots = data.muscles.filter((m) => !m.parentId).sort((a, b) => a.name.localeCompare(b.name))
  const kids = (id: string) => data.muscles.filter((m) => m.parentId === id && totals.has(m.id)).sort((a, b) => (totals.get(b.id)?.sets ?? 0) - (totals.get(a.id)?.sets ?? 0))
  const max = Math.max(metric === 'sets' ? setsTarget * 1.3 : 1, ...data.muscles.map((m) => per(m.id)))
  const fmt = (v: number) => (metric === 'sets' ? formatNum(Math.round(v * 10) / 10) : `${formatNum(Math.round(v))} ${units}`)
  const pp = pushPull(direct, data.muscles)
  const ppTotal = pp.push + pp.pull
  const under = underTrained(totals, data.muscles, n, setsTarget)
  const byId = new Map(data.muscles.map((m) => [m.id, m]))

  const row = (id: string, child = false) => {
    const m = byId.get(id)!
    const value = per(id)
    const sub = kids(id)
    return (
      <li key={id} id={child ? undefined : cardId({ kind: 'muscles', muscleId: id, range: ctx.range })} className={child ? 'mrow child' : 'mrow'}>
        <div className="mrow-head">
          {!child && sub.length > 0
            ? <button className="link-btn" aria-expanded={open.has(id)} onClick={() => setOpen((o) => { const x = new Set(o); if (x.has(id)) x.delete(id); else x.add(id); return x })}>{open.has(id) ? <ChevronDownIcon /> : <ChevronRightIcon />} {muscleLabel(m, t)}</button>
            : <span>{muscleLabel(m, t)}</span>}
          <span><strong>{fmt(value)}</strong>{metric === 'sets' && <small className="muted"> {t('stats.perWeekShort')}</small>}</span>
          {!child && metric === 'sets' && <PinButton pin={{ kind: 'muscles', muscleId: id, range: ctx.range }} label={muscleLabel(m, t)} />}
        </div>
        <div className="mbar" role="img" aria-label={`${muscleLabel(m, t)}: ${fmt(value)}`}>
          <i style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
          {metric === 'sets' && <b style={{ left: `${(setsTarget / max) * 100}%` }} />}
        </div>
        {!child && open.has(id) && <ul className="plain">{sub.map((c) => row(c.id, true))}</ul>}
      </li>
    )
  }

  return (
    <>
      <div className="card" id="card-muscle-list">
        <h3>{t('stats.weeklyByMuscle')}</h3>
        <div className="segmented small-seg" role="group" aria-label={t('stats.measure')}>
          {(['sets', 'volume'] as const).map((k) => <button key={k} className={metric === k ? 'on' : ''} aria-pressed={metric === k} onClick={() => setMetric(k)}>{t(`stats.by_${k}`)}</button>)}
        </div>
        <ul className="plain mlist">{roots.map((m) => row(m.id))}</ul>
        <p className="muted small">{t('stats.musclesHelp', { count: setsTarget })}</p>
      </div>

      <div className="card" id="card-balance">
        <h3>{t('stats.balance')}</h3>
        <h4>{t('stats.pushPull')}</h4>
        {ppTotal === 0 ? <p className="muted small">{t('stats.noData')}</p> : (
          <>
            <div className="ppbar" role="img" aria-label={t('stats.pushPullAria', { push: Math.round(pp.push), pull: Math.round(pp.pull) })}>
              <i className="push" style={{ width: `${(pp.push / ppTotal) * 100}%` }} /><i className="pull" style={{ width: `${(pp.pull / ppTotal) * 100}%` }} />
            </div>
            <p className="small"><span className="dot push" /> {t('stats.push')} <strong>{formatNum(Math.round(pp.push))}</strong> · <span className="dot pull" /> {t('stats.pull')} <strong>{formatNum(Math.round(pp.pull))}</strong>
              {pp.push > 0 && pp.pull > 0 && <span className="muted"> · 1 : {formatNum(Math.round((pp.pull / pp.push) * 100) / 100)}</span>}</p>
            <p className="muted small">{t('stats.pushPullHelp')}</p>
          </>
        )}
        <AsymmetryList measurements={data.measurements} />
      </div>

      <div className="card" id="card-undertrained">
        <h3>{t('stats.underTrained')}</h3>
        <label className="row">
          {t('stats.target')}
          <select value={setsTarget} onChange={(e) => void update({ setsTarget: Number(e.target.value) })}>
            {[6, 8, 10, 12, 14, 16, 20].map((v) => <option key={v} value={v}>{t('stats.setsPerWeek', { count: v })}</option>)}
          </select>
        </label>
        {under.length === 0 ? <p className="muted small">{t('stats.noneUnder', { target: setsTarget })}</p> : (
          <ul className="plain">{under.map((u) => <li key={u.muscleId}>{muscleLabel(byId.get(u.muscleId)!, t)} <span className="muted">{t('stats.setsPerWeek', { count: Math.round(u.perWeek * 10) / 10 })}</span></li>)}</ul>
        )}
      </div>
      <SeriesCard ctx={ctx} pin={{ kind: 'muscles', range: ctx.range }} title={t('stats.setsPerWeekChart')} />
    </>
  )
}
