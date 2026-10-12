import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatSet } from '../../lib/format'
import { exercisesAtSeveralGyms, gymComparison } from '../../lib/stats'
import { weightUnitFor } from '../../lib/plates'
import { formatNum, kgToDisplay } from '../../lib/units'
import type { StatsCtx } from './ctx'

/** Same exercise at each gym: best set, estimated 1RM and volume per session. Only built when two or more gyms have sessions. */
export default function GymsSection({ ctx }: { ctx: StatsCtx }) {
  const { t } = useTranslation()
  const { data } = ctx
  const ids = exercisesAtSeveralGyms(data.sets, data.sessions)
  const options = [...ids].map((id) => ctx.exById.get(id)).filter((e): e is NonNullable<typeof e> => !!e).sort((a, b) => a.name.localeCompare(b.name))
  const [sel, setSel] = useState<string>()
  const ex = ctx.exById.get(sel ?? '') && ids.has(sel!) ? ctx.exById.get(sel!)! : options[0]
  if (!ex) return <div className="card muted">{t('stats.gymsNone')}</div>

  const units = weightUnitFor(ex, ctx.units)
  const gymName = new Map(data.gyms.map((g) => [g.id, g.name]))
  const rows = gymComparison(data.sets, data.sessions, ex.id, ex.trackingType)
  const w = (kg: number) => `${formatNum(kgToDisplay(kg, units))} ${units}`
  const weighted = ex.trackingType === 'weight_reps' || ex.trackingType === 'bodyweight_added'

  return (
    <div className="card" id="card-gyms">
      <h3>{t('stats.gymCompare')}</h3>
      <label className="row">{t('stats.exercise')}
        <select value={ex.id} onChange={(e) => setSel(e.target.value)}>{options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
      </label>
      <table className="gym-table">
        <thead><tr><th>{t('gyms.gym')}</th><th>{t('stats.bestSet')}</th>{weighted && <th>{t('stats.metric_e1rm')}</th>}{weighted && <th>{t('stats.avgVolume')}</th>}<th>{t('stats.tile_sessions')}</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.gymId}>
              <td>{gymName.get(r.gymId) ?? '?'}</td>
              <td>{r.bestSet ? formatSet(r.bestSet, ex.trackingType, ctx.units) : '–'}</td>
              {weighted && <td>{r.bestE1rm !== undefined ? w(r.bestE1rm) : '–'}</td>}
              {weighted && <td>{w(r.avgVolume)}</td>}
              <td>{r.sessions}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">{t('stats.gymHelp')}</p>
    </div>
  )
}
