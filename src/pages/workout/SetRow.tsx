import { useTranslation } from 'react-i18next'
import DecimalInput from '../../components/DecimalInput'
import type { SetLog, SetType, TrackingType, Units } from '../../db/types'
import { formatNum, displayToKg, kgToDisplay } from '../../lib/units'
import { isFilled } from '../../lib/workout'

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

export default function SetRow({ set, tracking, units, label, hint, expanded, canRepeat, canUseLast, onToggle, onChange, onDone, onUndo, onRepeat, onUseLast, onDelete }: {
  set: SetLog
  tracking: TrackingType
  units: Units
  label: string
  /** Last time's matching set, shown as greyed placeholders (never applied silently). */
  hint?: SetLog
  expanded: boolean
  canRepeat: boolean
  canUseLast: boolean
  onToggle: () => void
  onChange: (patch: Partial<SetLog>) => void
  onDone: () => void
  onUndo: () => void
  onRepeat: () => void
  onUseLast: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const done = set.doneAt !== undefined
  const fields = FIELDS[tracking]
  const unitLabel = (f: Field) =>
    f.kind === 'weight' ? (tracking === 'assisted_bodyweight' ? `−${units}` : tracking === 'bodyweight_added' ? `+${units}` : units)
      : f.kind === 'reps' ? t('workout.repsUnit') : f.kind === 'sec' ? t('workout.secUnit') : f.kind === 'min' ? t('workout.minUnit') : t('workout.kmUnit')
  const ready = isFilled(set, tracking)

  return (
    <li className={`set${done ? ' done' : ''}`}>
      <div className="set-main">
        <button className={`set-label ${set.setType}`} aria-expanded={expanded} aria-label={t('workout.details')} onClick={onToggle}>{label}</button>
        {fields.map((f) => {
          const h = hint ? toDisplay(f, hint[f.key], units) : undefined
          return (
            <label key={f.key} className="field">
              <DecimalInput label={unitLabel(f)} integer={f.kind === 'reps' || f.kind === 'sec'}
                value={toDisplay(f, set[f.key], units)} placeholder={h === undefined ? '' : formatNum(h)}
                onCommit={(v) => onChange({ [f.key]: fromDisplay(f, v, units) })} />
              <span>{unitLabel(f)}</span>
            </label>
          )
        })}
        <button className="icon" disabled={!canRepeat || done} aria-label={t('workout.repeat')} title={t('workout.repeat')} onClick={onRepeat}>⟲</button>
        <button className={`check${done ? ' on' : ''}`} disabled={!done && !ready} aria-label={done ? t('workout.undo') : t('workout.done')}
          onClick={done ? onUndo : onDone}>✓</button>
      </div>
      {expanded && (
        <div className="set-more">
          <label>{t('workout.setType')}
            <select value={set.setType} onChange={(e) => onChange({ setType: e.target.value as SetType })}>
              {SET_TYPES.map((x) => <option key={x} value={x}>{t(`workout.type.${x}`)}</option>)}
            </select>
          </label>
          <label>{t('workout.rpe')}
            <select value={set.rpe ?? ''} onChange={(e) => onChange({ rpe: e.target.value ? Number(e.target.value) : undefined })}>
              <option value="">—</option>
              {RPE.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          <label>{t('workout.rir')}
            <select value={set.rir ?? ''} onChange={(e) => onChange({ rir: e.target.value ? Number(e.target.value) : undefined })}>
              <option value="">—</option>
              {[0, 1, 2, 3, 4, 5].map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          <label className="inline"><input type="checkbox" checked={!!set.failure} onChange={(e) => onChange({ failure: e.target.checked || undefined })} /> {t('workout.failure')}</label>
          <div className="set-actions">
            <button disabled={!canUseLast || done} onClick={onUseLast}>{t('workout.useLastSet')}</button>
            <button className="danger" onClick={onDelete}>{t('workout.deleteSet')}</button>
          </div>
        </div>
      )}
    </li>
  )
}
