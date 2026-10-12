import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DecimalInput from '../../components/DecimalInput'
import type { SetLog, SetType, TrackingType, Units } from '../../db/types'
import PRBadge from '../../components/PRBadge'
import type { PRKind } from '../../lib/prs'
import { describeSide, formatPlate, loadFor, PLATES, retypeKg, setUnit, usesWeight } from '../../lib/plates'
import { formatNum, displayToKg, kgToDisplay } from '../../lib/units'
import { isFilled } from '../../lib/workout'
import { CheckIcon, DumbbellIcon, TrashIcon } from '../../components/Icons'
import { formatSet } from '../../lib/format'

type FieldKey = 'weight' | 'extraWeight' | 'reps' | 'durationSec' | 'distanceM'
type Kind = 'weight' | 'reps' | 'sec' | 'min' | 'km'
interface Field { key: FieldKey; kind: Kind }

const FIELDS: Record<TrackingType, Field[]> = {
  weight_reps: [{ key: 'weight', kind: 'weight' }, { key: 'reps', kind: 'reps' }],
  bodyweight_reps: [{ key: 'reps', kind: 'reps' }],
  bodyweight_added: [{ key: 'extraWeight', kind: 'weight' }, { key: 'reps', kind: 'reps' }],
  assisted_bodyweight: [{ key: 'extraWeight', kind: 'weight' }, { key: 'reps', kind: 'reps' }],
  duration: [{ key: 'durationSec', kind: 'sec' }],
  cardio: [{ key: 'durationSec', kind: 'min' }, { key: 'distanceM', kind: 'km' }],
}

const toDisplay = (f: Field, v: number | undefined, units: Units) =>
  v === undefined ? undefined : f.kind === 'weight' ? kgToDisplay(v, units) : f.kind === 'min' ? Math.round((v / 60) * 10) / 10 : f.kind === 'km' ? Math.round((v / 1000) * 100) / 100 : v
const fromDisplay = (f: Field, v: number | undefined, units: Units) =>
  v === undefined ? undefined : f.kind === 'weight' ? displayToKg(v, units) : f.kind === 'min' ? Math.round(v * 60) : f.kind === 'km' ? Math.round(v * 1000) : v

const RPE = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]
const SET_TYPES: SetType[] = ['working', 'warmup', 'drop']

/**
 * The number inputs for one set, by tracking type. Shared by the live workout and the history editor. Weights are
 * typed and shown in the set's own unit (see `setUnit`; `units` is the fallback) and saved with it.
 */
export function SetFields({ set, tracking, units: fallback, hint, onChange }: {
  set: SetLog; tracking: TrackingType; units: Units; hint?: SetLog; onChange: (patch: Partial<SetLog>) => void
}) {
  const { t } = useTranslation()
  const units = setUnit(set, fallback, hint)
  const unitLabel = (f: Field) =>
    f.kind === 'weight' ? (tracking === 'assisted_bodyweight' ? `−${units}` : tracking === 'bodyweight_added' ? `+${units}` : units)
      : f.kind === 'reps' ? t('workout.repsUnit') : f.kind === 'sec' ? t('workout.secUnit') : f.kind === 'min' ? t('workout.minUnit') : t('workout.kmUnit')
  return (
    <>
      {FIELDS[tracking].map((f) => {
        const h = hint ? toDisplay(f, hint[f.key], units) : undefined
        return (
          <label key={f.key} className="field">
            <DecimalInput label={unitLabel(f)} integer={f.kind === 'reps' || f.kind === 'sec'}
              value={toDisplay(f, set[f.key], units)} placeholder={h === undefined ? '' : formatNum(h)}
              onCommit={(v) => onChange({ [f.key]: fromDisplay(f, v, units), ...(f.kind === 'weight' && { unit: units }) })} />
            <span>{unitLabel(f)}</span>
          </label>
        )
      })}
    </>
  )
}

export default function SetRow({ set, tracking, units: fallback, label, hint, pr, next, expanded, previous, barOf, onToggle, onChange, onDone, onUndo, onUseLast, onDelete, onPlates }: {
  set: SetLog
  tracking: TrackingType
  /** The exercise's weight unit (its own, else the app's), for sets with no unit of their own yet. */
  units: Units
  label: string
  /** Last time's matching set, shown as greyed placeholders (never applied silently). */
  hint?: SetLog
  /** Records this set achieved (shown as a PR badge once it's done). */
  pr?: PRKind[]
  /** The next set to do in this exercise (highlighted). */
  next?: boolean
  expanded: boolean
  /** This set's value last session (the "previous" column); tapping it fills the set with it. */
  previous?: SetLog
  /** Bar weight in a unit, when the exercise is loaded with plates (else no plates row in the set settings). */
  barOf?: (unit: Units) => number
  onToggle: () => void
  onChange: (patch: Partial<SetLog>) => void
  onDone: () => void
  onUndo: () => void
  onUseLast: () => void
  /** Omitted for an exercise's last set: every exercise keeps at least one. */
  onDelete?: () => void
  onPlates?: () => void
}) {
  const { t } = useTranslation()
  const done = set.doneAt !== undefined
  const units = setUnit(set, fallback, hint)
  const bar = barOf?.(units)
  // Plates per side for the typed weight, else for the hinted one (greyed, like the field's placeholder).
  const plateKg = set.weight ?? hint?.weight
  const plateLoad = bar !== undefined && plateKg !== undefined ? loadFor(kgToDisplay(plateKg, units), bar, PLATES[units]) : undefined
  const ready = isFilled(set, tracking)

  // Swipe either way, at least half the row's width, to delete the set (no confirmation). Works from anywhere on
  // the row, including fields; a mostly-vertical gesture is left to the page scroll. Stops propagation so the
  // card's own swipe stays out. The last set can't be deleted, so it doesn't swipe.
  const [dx, setDx] = useState(0)
  const drag = useRef<{ x: number; y: number; width: number; active: boolean } | null>(null)
  const down = (e: React.PointerEvent<HTMLElement>) => {
    e.stopPropagation()
    if (onDelete) drag.current = { x: e.clientX, y: e.clientY, width: e.currentTarget.offsetWidth, active: false }
  }
  const move = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d) return
    e.stopPropagation()
    const ddx = e.clientX - d.x, ddy = e.clientY - d.y
    if (!d.active) {
      if (Math.abs(ddy) > 10 && Math.abs(ddy) > Math.abs(ddx)) { drag.current = null; return }
      if (Math.abs(ddx) > 10) {
        d.active = true
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* pointer already gone */ }
      }
    }
    if (d.active) setDx(ddx)
  }
  const up = (e: React.PointerEvent) => {
    e.stopPropagation()
    const d = drag.current
    const swiped = d?.active && Math.abs(dx) >= d.width / 2
    drag.current = null
    setDx(0)
    if (swiped) onDelete?.()
  }
  // A cancelled gesture (the OS took over the touch) must never delete anything.
  const cancel = (e: React.PointerEvent) => { e.stopPropagation(); drag.current = null; setDx(0) }

  return (
    <li className={`set${done ? ' done' : ''}${next && !done ? ' next' : ''}${dx ? ` swiping ${dx > 0 ? 'dir-r' : 'dir-l'}` : ''}`}>
      <div className="swipe-bg" aria-hidden><TrashIcon size={22} /></div>
      <div className="set-body" style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : 'transform .15s' }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}>
      <div className="set-main">
        <span className="label-wrap">
          <button className={`set-label ${set.setType}`} aria-expanded={expanded} aria-label={t('workout.details')} onClick={onToggle}>{label}</button>
          {done && pr && pr.length > 0 && <PRBadge kinds={pr} />}
        </span>
        <span className="field prev-field">
          <button className="prev" disabled={!previous || done} onClick={onUseLast}
            aria-label={previous ? `${t('workout.useLastSet')}: ${formatSet(previous, tracking, fallback)}` : t('workout.noPrevious')}>
            {previous ? formatSet(previous, tracking, fallback) : '—'}
          </button>
          <span aria-hidden>{t('workout.previous')}</span>
        </span>
        <SetFields set={set} tracking={tracking} units={fallback} hint={hint} onChange={onChange} />
        <button className={`check${done ? ' on' : ''}`} disabled={!done && !ready} aria-label={done ? t('workout.undo') : t('workout.done')}
          onClick={done ? onUndo : onDone}><CheckIcon size={24} /></button>
      </div>
      {expanded && (
        <div className="set-more">
          {bar !== undefined && !done && onPlates && (
            <button className={`plates-line${set.weight === undefined ? ' muted' : ''}`} onClick={onPlates}>
              <DumbbellIcon />{' '}
              {!plateLoad ? t('plates.open')
                : plateLoad.perSide.length === 0 ? t('plates.barOnly')
                  : t('plates.line', { plates: describeSide(plateLoad.perSide) })}
              {plateLoad && !plateLoad.exact ? ` (≈ ${formatPlate(plateLoad.total)})` : ''}
            </button>
          )}
          <label>{t('workout.setType')}
            <select value={set.setType} onChange={(e) => onChange({ setType: e.target.value as SetType })}>
              {SET_TYPES.map((x) => <option key={x} value={x}>{t(`workout.type.${x}`)}</option>)}
            </select>
          </label>
          {usesWeight(tracking) && (
            <label>{t('workout.unit')}
              <select value={units} onChange={(e) => {
                // Same number, other unit: the plates said lb, not kg.
                const to = e.target.value as Units
                onChange({ unit: to, weight: retypeKg(set.weight, units, to), extraWeight: retypeKg(set.extraWeight, units, to) })
              }}>
                <option value="kg">kg</option>
                <option value="lb">lb</option>
              </select>
            </label>
          )}
          <label>{t('workout.rpe')}
            <select value={set.rpe ?? ''} onChange={(e) => onChange({ rpe: e.target.value ? Number(e.target.value) : undefined })}>
              <option value="">—</option>
              {RPE.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          <label className="inline"><input type="checkbox" checked={!!set.failure} onChange={(e) => onChange({ failure: e.target.checked || undefined })} /> {t('workout.failure')}</label>
          <div className="set-actions">
            <button className="danger" disabled={!onDelete} onClick={onDelete}>{t('workout.deleteSet')}</button>
          </div>
        </div>
      )}
      </div>
    </li>
  )
}
