import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import DecimalInput from '../../components/DecimalInput'
import { db } from '../../db/db'
import type { Exercise, Units } from '../../db/types'
import { barWeight, formatPlate, loadFor, PLATES, totalWeight } from '../../lib/plates'
import { displayToKg } from '../../lib/units'

/**
 * Plates for one set: tap plates to load the bar and see the total, or type a total to see the plates. Works in
 * the exercise's own unit. The bar weight is saved on the exercise; nothing is logged until "Use".
 */
export default function PlateSheet({ exercise, unit, weight, onUse, onClose }: {
  exercise: Exercise
  unit: Units
  /** The set's weight (or last time's), in `unit`, to start from. */
  weight?: number
  onUse: (total: number) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const plates = PLATES[unit]
  const [bar, setBar] = useState(() => barWeight(exercise, unit))
  const [perSide, setPerSide] = useState(() => (weight ? loadFor(weight, barWeight(exercise, unit), plates).perSide : []))
  const [target, setTarget] = useState<number>()
  const total = totalWeight(bar, perSide)
  const missed = target !== undefined && Math.round(target * 100) !== Math.round(total * 100)

  const sorted = (xs: number[]) => [...xs].sort((a, b) => b - a)
  const changeBar = (v: number | undefined) => {
    const b = v ?? 0
    setBar(b)
    void db.exercises.update(exercise.id, { barKg: displayToKg(b, unit) })
    if (target !== undefined) setPerSide(loadFor(target, b, plates).perSide)
  }
  const typeTotal = (v: number | undefined) => {
    setTarget(v)
    if (v !== undefined) setPerSide(loadFor(v, bar, plates).perSide)
  }
  const add = (p: number) => { setTarget(undefined); setPerSide(sorted([...perSide, p])) }
  const remove = (i: number) => { setTarget(undefined); setPerSide(perSide.filter((_, j) => j !== i)) }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={t('plates.title')} onClick={onClose}>
      <div className="modal-card plate-sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{t('plates.title')}</h2>
        <p className="muted small">{exercise.name}</p>

        <div className="plate-visual" aria-hidden>
          <span className="plate-bar" />
          {perSide.map((p, i) => <span key={i} className="plate" style={{ height: `${30 + 70 * Math.sqrt(p / plates[0])}%` }} />)}
          <span className="plate-sleeve" />
        </div>

        <p className="small">{t('plates.perSide')}:</p>
        <div className="chips">
          {perSide.length === 0 && <span className="muted small">{t('plates.empty')}</span>}
          {perSide.map((p, i) => (
            <button key={i} className="chip on" aria-label={t('plates.remove', { plate: `${formatPlate(p)} ${unit}` })} onClick={() => remove(i)}>{formatPlate(p)} ✕</button>
          ))}
        </div>

        <p className="small">{t('plates.add')}:</p>
        <div className="chips">
          {plates.map((p) => (
            <button key={p} className="chip" aria-label={t('plates.addPlate', { plate: `${formatPlate(p)} ${unit}` })} onClick={() => add(p)}>+{formatPlate(p)}</button>
          ))}
        </div>

        <div className="plate-fields">
          <label className="field">
            <DecimalInput label={t('plates.bar')} value={bar} onCommit={changeBar} />
            <span>{t('plates.bar')} ({unit})</span>
          </label>
          <span className="plate-op" aria-hidden>+ 2 ×</span>
          <span className="plate-side">{formatPlate(perSide.reduce((a, p) => a + p, 0))}</span>
          <span className="plate-op" aria-hidden>=</span>
          <label className="field">
            <DecimalInput label={t('plates.total')} value={target ?? total} onCommit={typeTotal} />
            <span>{t('plates.total')} ({unit})</span>
          </label>
        </div>
        {missed && <p className="small warn">{t('plates.notExact', { target: formatPlate(target!), total: `${formatPlate(total)} ${unit}` })}</p>}

        <button className="primary" onClick={() => { onUse(total); onClose() }}>{t('plates.use', { weight: `${formatPlate(total)} ${unit}` })}</button>
        <button onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </div>
  )
}
