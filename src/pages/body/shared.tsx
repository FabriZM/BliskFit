import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import DecimalInput from '../../components/DecimalInput'
import Photo from '../../components/Photo'
import { PencilIcon, TrashIcon } from '../../components/Icons'
import LineChart from '../../components/stats/LineChart'
import PinButton from '../../components/stats/PinButton'
import type { PinSpec } from '../../db/types'
import { toDateInput } from '../../lib/dates'
import { formatDelta, formatValue, type ValueUnit } from '../../lib/pinCards'
import { changeOver, type Point } from '../../lib/stats'
import { useSettings } from '../../stores/settings'

const PAGE = 30

export const today = () => toDateInput(Date.now())

export function DateField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return <input type="date" className="date-input" aria-label={label} value={value} max={today()} onChange={(e) => e.target.value && onChange(e.target.value)} />
}

export function TagPicker({ value, onChange, tags }: { value: string; onChange: (v: string) => void; tags: string[] }) {
  const { t } = useTranslation()
  return (
    <>
      {tags.length > 0 && (
        <div className="chips">
          {tags.map((tag) => <button type="button" key={tag} className={`chip${value.toLowerCase() === tag.toLowerCase() ? ' on' : ''}`} aria-pressed={value.toLowerCase() === tag.toLowerCase()} onClick={() => onChange(value === tag ? '' : tag)}>{tag}</button>)}
        </div>
      )}
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={t('body.tagPlaceholder')} aria-label={t('body.tag')} maxLength={30} />
    </>
  )
}

export const useDayFormat = () => {
  const { i18n } = useTranslation()
  return new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * One past entry with inline edit and delete. Numeric entries edit their value and date; `extra` adds more edit
 * fields (photo tag and note). `save` returns false to keep the editor open with `saveError` shown.
 */
export function EntryRow({ date, label, thumb, value, onSave, onDelete, extra, saveError }: {
  date: number
  label: ReactNode
  thumb?: Blob
  /** Current numeric value (display units), or undefined for entries without one. */
  value?: number
  onSave: (day: string, value: number | undefined) => Promise<boolean>
  onDelete: () => void
  extra?: ReactNode
  saveError?: string
}) {
  const { t } = useTranslation()
  const fmt = useDayFormat()
  const [editing, setEditing] = useState(false)
  const [day, setDay] = useState(toDateInput(date))
  const [num, setNum] = useState(value)
  const [failed, setFailed] = useState(false)
  const numeric = value !== undefined

  return (
    <li className="entry">
      <div className="entry-main">
        {thumb && <Photo blob={thumb} alt="" className="entry-thumb" />}
        <div className="entry-text"><span>{label}</span><small className="muted">{fmt.format(date)}</small></div>
        <button className="icon" aria-label={t('common.edit')} title={t('common.edit')} onClick={() => setEditing(!editing)}><PencilIcon /></button>
        <button className="icon" aria-label={t('common.delete')} title={t('common.delete')} onClick={() => { if (confirm(t('body.confirmDelete'))) onDelete() }}><TrashIcon /></button>
      </div>
      {editing && (
        <div className="entry-edit">
          <div className="form-line">
            {numeric && <DecimalInput value={num} onCommit={setNum} label={t('body.value')} />}
            <DateField value={day} onChange={(v) => { setDay(v); setFailed(false) }} label={t('body.date')} />
          </div>
          {extra}
          {failed && saveError && <p className="warn" role="alert">{saveError}</p>}
          <div className="form-line">
            <button className="primary" disabled={numeric && !num} onClick={async () => {
              const ok = await onSave(day, num)
              setFailed(!ok)
              if (ok) setEditing(false)
            }}>{t('common.save')}</button>
            <button onClick={() => setEditing(false)}>{t('common.cancel')}</button>
          </div>
        </div>
      )}
    </li>
  )
}

/** Past entries, newest first, 30 at a time. */
export function History<T extends { id: string; date: number }>({ items, render }: { items: T[]; render: (item: T) => ReactNode }) {
  const { t } = useTranslation()
  const [shown, setShown] = useState(PAGE)
  const sorted = [...items].sort((a, b) => b.date - a.date)
  return (
    <>
      <h2>{t('body.history')}</h2>
      {sorted.length === 0
        ? <p className="muted">{t('body.noEntries')}</p>
        : <ul className="plain entry-list">{sorted.slice(0, shown).map(render)}</ul>}
      {sorted.length > shown && <button className="wide" onClick={() => setShown(shown + PAGE)}>{t('body.showMore')}</button>}
    </>
  )
}

/** The item's whole history as a chart, with the overall change and a pin button. */
export function ChartCard({ title, pin, points, trend, unit, lowerBetter }: {
  title: string
  pin: PinSpec
  points: Point[]
  trend?: Point[]
  unit: ValueUnit
  lowerBetter?: boolean
}) {
  const { t } = useTranslation()
  const units = useSettings((s) => s.settings.units)
  const sorted = [...points].sort((a, b) => a.at - b.at)
  const change = changeOver(sorted)
  const fmt = (v: number) => formatValue(v, unit, units)
  return (
    <div className="card stat-card">
      <div className="row head">
        <h3>{t('body.progress')}</h3>
        <PinButton pin={pin} label={title} />
      </div>
      <LineChart label={title} points={sorted} trend={trend} format={fmt} lowerBetter={lowerBetter} />
      {change && sorted.length > 1 && (
        <p className="small muted">{t('stats.change')}: <strong>{formatDelta(change.delta, unit, units)}</strong> ({fmt(change.first)} → {fmt(change.last)})</p>
      )}
    </div>
  )
}
