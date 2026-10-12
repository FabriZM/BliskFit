import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { addBodyWeight } from '../db/body'
import { setPins, useDerived, usePins, useStatsData, type StatsData } from '../db/stats'
import type { PinSpec } from '../db/types'
import { compareDefaults, photosWithTag } from '../lib/body'
import { muscleLabel } from '../lib/muscles'
import { formatDelta, formatValue, pinSeries, statsLink } from '../lib/pinCards'
import { SUGGESTED_PINS, movePin, validPins } from '../lib/pins'
import { changeOver } from '../lib/stats'
import { weightUnitFor } from '../lib/plates'
import { displayToKg } from '../lib/units'
import { useNow } from '../lib/useNow'
import { useSettings } from '../stores/settings'
import { toDateInput } from '../lib/dates'
import DecimalInput from './DecimalInput'
import Photo from './Photo'
import Sparkline from './stats/Sparkline'
import { measurementLabel } from './stats/measurementLabel'
import { pinTargets } from '../db/stats'

function AddWeight() {
  const { t } = useTranslation()
  const units = useSettings((s) => s.settings.units)
  const [value, setValue] = useState<number>()
  const [open, setOpen] = useState(false)
  if (!open) return <button className="link-btn small" onClick={() => setOpen(true)}>+ {t('stats.addToday')}</button>
  return (
    <form className="add-today" onSubmit={(e) => { e.preventDefault(); if (value) { void addBodyWeight(toDateInput(Date.now()), displayToKg(value, units)); setValue(undefined); setOpen(false) } }}>
      <DecimalInput value={value} onCommit={setValue} label={`${t('body.weight')} (${units})`} placeholder={units} />
      <button className="primary" disabled={!value}>{t('common.add')}</button>
      <button type="button" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
    </form>
  )
}

/** The stats you pinned in the Stats panel, as compact cards: value, change over the range, sparkline. */
export default function PinnedStats() {
  const { t } = useTranslation()
  const { units: appUnits, weekStartDay, pinsDismissed } = useSettings((s) => s.settings)
  const update = useSettings((s) => s.update)
  const stored = useSettings((s) => s.settings.pinnedStats)
  const data = useStatsData()
  const derived = useDerived(data)
  const pins = usePins(data)
  const now = useNow(60_000)
  const [editing, setEditing] = useState(false)

  // A pin whose exercise or measurement was deleted disappears silently, and is dropped from the saved list.
  useEffect(() => {
    if (data && validPins(stored, pinTargets(data)).length !== stored.length) void setPins(validPins(stored, pinTargets(data)))
  }, [data, stored])

  if (!data || !derived) return null
  const today = new Date(now)
  const hasHistory = data.sessions.length > 0 || data.bodyWeights.length > 0 || data.measurements.length > 0
  const suggest = hasHistory && stored.length === 0 && !pinsDismissed
  const shown: PinSpec[] = suggest ? SUGGESTED_PINS : pins
  const muscleById = new Map(data.muscles.map((m) => [m.id, m]))
  const input = {
    sessions: data.sessions, sets: data.sets, exById: derived.exById, muscles: data.muscles, buckets: derived.buckets,
    bodyWeights: data.bodyWeights, measurements: data.measurements,
  }

  const title = (p: PinSpec): string => {
    switch (p.kind) {
      case 'weekly': return t('stats.sessionsPerWeek')
      case 'muscles': return p.muscleId && muscleById.get(p.muscleId) ? `${muscleLabel(muscleById.get(p.muscleId)!, t)} · ${t('stats.setsShort')}` : t('stats.allSets')
      case 'exercise': return `${derived.exById.get(p.exerciseId!)?.name ?? '?'} · ${t(`stats.metric_${p.metric}`)}`
      case 'bodyweight': return t('body.weight')
      case 'measurement': return measurementLabel(p.measurement!, t)
      case 'photo': return `${t('stats.photos')} · ${p.tag ?? t('body.untagged')}`
    }
  }

  const photoCard = (p: PinSpec, data: StatsData) => {
    const list = photosWithTag(data.photos, p.tag)
    const pair = p.photoMode === 'compare' ? compareDefaults(data.photos, p.tag) : undefined
    const shownPhotos = pair ? [pair.first, pair.latest] : list.slice(-1)
    return <div className="pin-photos">{shownPhotos.map((ph) => <Photo key={ph.id} blob={ph.photo} alt="" className="pin-thumb" />)}</div>
  }

  const body = (p: PinSpec) => {
    if (p.kind === 'photo') return photoCard(p, data)
    const s = pinSeries(p, input, weekStartDay, today)
    if (!s || !s.points.length) return <span className="muted small">{t('stats.noData')}</span>
    const last = s.points[s.points.length - 1]
    const weekly = s.unit === 'sessions' || s.unit === 'sets'
    const ch = weekly ? undefined : changeOver(s.points)
    const avg = weekly ? s.points.reduce((a, x) => a + x.value, 0) / s.points.length : undefined
    const units = p.kind === 'exercise' ? weightUnitFor(derived.exById.get(p.exerciseId!), appUnits) : appUnits
    return (
      <>
        <div className="pin-value">
          <strong>{formatValue(last.value, s.unit, units)}</strong>
          <small className="muted">
            {weekly ? ` ${t('stats.thisWeekShort')} · ${t('stats.avgShort')} ${formatValue(avg!, s.unit, units)}` : ch && s.points.length > 1 ? ` ${formatDelta(ch.delta, s.unit, units)}` : ''}
            {' · '}{t(`stats.range_${p.range}`)}
          </small>
        </div>
        <Sparkline points={s.trend ?? s.points} />
      </>
    )
  }

  return (
    <>
      <div className="row head">
        <h2>{t('profile.stats')}</h2>
        <span className="head-links">
          {pins.length > 0 && <button className="link-btn" onClick={() => setEditing(!editing)}>{editing ? t('common.done') : t('common.edit')}</button>}
          <Link to="/profile/stats">{t('stats.seeAll')}</Link>
          <Link to="/profile/body">{t('body.logLink')}</Link>
        </span>
      </div>

      {!hasHistory && <div className="card muted">{t('stats.emptyPins')} <Link to="/profile/stats">{t('stats.seeAll')}</Link></div>}
      {hasHistory && !suggest && pins.length === 0 && <div className="card muted">{t('stats.noPins')} <Link to="/profile/stats">{t('stats.seeAll')}</Link></div>}
      {suggest && (
        <p className="muted small suggest-note">
          {t('stats.suggested')}{' '}
          <button className="link-btn" onClick={() => void setPins(SUGGESTED_PINS)}>{t('stats.keepSuggested')}</button>{' · '}
          <button className="link-btn" onClick={() => void update({ pinsDismissed: true })}>{t('stats.dismiss')}</button>
        </p>
      )}

      <div className="pin-list">
        {shown.map((p, i) => (
          <div className="card pin-card" key={p.kind + i + (p.exerciseId ?? '') + (p.metric ?? '') + (p.measurement ?? '') + (p.muscleId ?? '') + (p.tag ?? '') + (p.photoMode ?? '')}>
            {editing && !suggest ? (
              <div className="pin-edit">
                <strong>{title(p)}</strong>
                <span>
                  <button className="icon" disabled={i === 0} aria-label={t('stats.moveUp')} onClick={() => void setPins(movePin(pins, i, -1))}>↑</button>
                  <button className="icon" disabled={i === pins.length - 1} aria-label={t('stats.moveDown')} onClick={() => void setPins(movePin(pins, i, 1))}>↓</button>
                  <button className="icon" aria-label={`${t('stats.unpin')}: ${title(p)}`} onClick={() => void setPins(pins.filter((x) => x !== p))}>✕</button>
                </span>
              </div>
            ) : (
              <>
                <Link className="pin-link" to={statsLink(p)} aria-label={title(p)}>
                  <span className="pin-title">{title(p)}</span>
                  <span className="pin-body">{body(p)}</span>
                </Link>
                {p.kind === 'bodyweight' && !suggest && <AddWeight />}
              </>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
