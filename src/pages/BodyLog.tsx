import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import {
  PhotoLimitError, addBodyWeight, addMeasurement, addPhoto, deleteBodyWeight, deleteMeasurement, deletePhoto,
  updateBodyWeight, updateMeasurement, updatePhoto,
} from '../db/body'
import type { BodyWeight, Measurement, ProgressPhoto } from '../db/types'
import DecimalInput from '../components/DecimalInput'
import Photo from '../components/Photo'
import { measurementLabel } from '../components/stats/measurementLabel'
import { MAX_PHOTOS_PER_DAY, SIDED, STANDARD_MEASUREMENTS, measurementType, photoBytes, photoTags, photosOnDay, type Side } from '../lib/body'
import { fromDateInput, toDateInput } from '../lib/dates'
import { compressImage } from '../lib/image'
import { displayToKg, formatNum, kgToDisplay } from '../lib/units'
import { useBlobUrl } from '../lib/useBlobUrl'
import { useSettings } from '../stores/settings'
import { BackLink } from '../components/PageHeader'

const CUSTOM = '\u0000custom'
const PHOTO_SIDE = 1280
const PAGE = 30

type Entry =
  | { kind: 'weight'; id: string; date: number; row: BodyWeight }
  | { kind: 'measurement'; id: string; date: number; row: Measurement }
  | { kind: 'photo'; id: string; date: number; row: ProgressPhoto }

const today = () => toDateInput(Date.now())

function DateField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return <input type="date" className="date-input" aria-label={label} value={value} max={today()} onChange={(e) => e.target.value && onChange(e.target.value)} />
}

function WeightForm() {
  const { t } = useTranslation()
  const units = useSettings((s) => s.settings.units)
  const [value, setValue] = useState<number>()
  const [day, setDay] = useState(today())
  return (
    <form className="card body-form" onSubmit={(e) => { e.preventDefault(); if (value) { void addBodyWeight(day, displayToKg(value, units)); setValue(undefined) } }}>
      <h2>{t('body.weight')}</h2>
      <div className="form-line">
        <DecimalInput value={value} onCommit={setValue} label={`${t('body.weight')} (${units})`} placeholder={units} />
        <DateField value={day} onChange={setDay} label={t('body.date')} />
        <button className="primary" disabled={!value}>{t('common.add')}</button>
      </div>
    </form>
  )
}

function MeasurementForm({ customBases }: { customBases: string[] }) {
  const { t } = useTranslation()
  const [base, setBase] = useState<string>(STANDARD_MEASUREMENTS[0])
  const [side, setSide] = useState<Side>('l')
  const [custom, setCustom] = useState('')
  const [customSided, setCustomSided] = useState(false)
  const [value, setValue] = useState<number>()
  const [day, setDay] = useState(today())
  const isCustom = base === CUSTOM
  const name = isCustom ? custom.trim() : base
  const sided = isCustom ? customSided : SIDED.has(base)
  const ready = !!name && !!value
  return (
    <form className="card body-form" onSubmit={(e) => {
      e.preventDefault()
      if (!ready) return
      void addMeasurement(day, measurementType(name, sided ? side : undefined), value!)
      setValue(undefined)
    }}>
      <h2>{t('body.measurement')}</h2>
      <div className="form-line">
        <select value={base} onChange={(e) => setBase(e.target.value)} aria-label={t('body.measurement')}>
          {STANDARD_MEASUREMENTS.map((m) => <option key={m} value={m}>{t(`body.m_${m}`)}</option>)}
          {customBases.map((m) => <option key={m} value={m}>{m}</option>)}
          <option value={CUSTOM}>{t('body.custom')}</option>
        </select>
        {sided && (
          <div className="segmented small-seg side-seg" role="group" aria-label={t('body.side')}>
            {(['l', 'r'] as const).map((s) => <button type="button" key={s} className={side === s ? 'on' : ''} aria-pressed={side === s} onClick={() => setSide(s)}>{t(s === 'l' ? 'body.left' : 'body.right')}</button>)}
          </div>
        )}
      </div>
      {isCustom && (
        <div className="form-line">
          <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={t('body.customName')} aria-label={t('body.customName')} maxLength={40} />
          <label className="inline"><input type="checkbox" checked={customSided} onChange={(e) => setCustomSided(e.target.checked)} />{t('body.leftRight')}</label>
        </div>
      )}
      <div className="form-line">
        <DecimalInput value={value} onCommit={setValue} label={`${t('body.measurement')} (cm)`} placeholder="cm" />
        <DateField value={day} onChange={setDay} label={t('body.date')} />
        <button className="primary" disabled={!ready}>{t('common.add')}</button>
      </div>
    </form>
  )
}

function TagPicker({ value, onChange, tags }: { value: string; onChange: (v: string) => void; tags: string[] }) {
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

function PhotoForm({ photos }: { photos: ProgressPhoto[] }) {
  const { t } = useTranslation()
  const [blob, setBlob] = useState<Blob>()
  const [busy, setBusy] = useState(false)
  const [tag, setTag] = useState('')
  const [note, setNote] = useState('')
  const [day, setDay] = useState(today())
  const [error, setError] = useState<'full' | 'failed' | null>(null)
  const preview = useBlobUrl(blob)
  const tags = photoTags(photos)
  const dayPhotos = photosOnDay(photos, fromDateInput(day) + 12 * 3600_000)
  const full = dayPhotos.length >= MAX_PHOTOS_PER_DAY

  const choose = async (file?: File) => {
    if (!file) return
    setBusy(true); setError(null)
    try { setBlob(await compressImage(file, PHOTO_SIDE, 0.8)) } catch { setError('failed') } finally { setBusy(false) }
  }

  return (
    <form className="card body-form" onSubmit={async (e) => {
      e.preventDefault()
      if (!blob) return
      try {
        await addPhoto({ day, photo: blob, tag, note })
        setBlob(undefined); setNote(''); setError(null)
      } catch (err) { setError(err instanceof PhotoLimitError ? 'full' : 'failed') }
    }}>
      <h2>{t('body.photo')}</h2>
      <div className="form-line">
        <label className="btn file-btn">{t('body.camera')}<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = '' }} /></label>
        <label className="btn file-btn alt">{t('body.gallery')}<input type="file" accept="image/*" hidden onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = '' }} /></label>
        <DateField value={day} onChange={(v) => { setDay(v); setError(null) }} label={t('body.date')} />
      </div>
      {busy && <p className="muted small">{t('body.processing')}</p>}
      {preview && <img src={preview} alt="" className="photo-preview" />}
      {(blob || full) && <TagPicker value={tag} onChange={setTag} tags={tags} />}
      {blob && <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('body.notePlaceholder')} aria-label={t('body.note')} maxLength={200} />}
      {(full || error === 'full') && <p className="warn" role="alert">{t('body.dayFull', { count: MAX_PHOTOS_PER_DAY })}</p>}
      {error === 'failed' && <p className="warn" role="alert">{t('body.photoFailed')}</p>}
      <button className="primary wide" disabled={!blob || busy || full}>{t('body.savePhoto')}</button>
    </form>
  )
}

function EntryRow({ entry, photos }: { entry: Entry; photos: ProgressPhoto[] }) {
  const { t, i18n } = useTranslation()
  const units = useSettings((s) => s.settings.units)
  const [editing, setEditing] = useState(false)
  const [day, setDay] = useState(toDateInput(entry.date))
  const [num, setNum] = useState<number | undefined>(entry.kind === 'weight' ? kgToDisplay(entry.row.weight, units) : entry.kind === 'measurement' ? entry.row.value : undefined)
  const [tag, setTag] = useState(entry.kind === 'photo' ? entry.row.tag ?? '' : '')
  const [note, setNote] = useState(entry.kind === 'photo' ? entry.row.note ?? '' : '')
  const [error, setError] = useState(false)
  const fmt = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })

  const label =
    entry.kind === 'weight' ? `${formatNum(kgToDisplay(entry.row.weight, units))} ${units}`
      : entry.kind === 'measurement' ? `${measurementLabel(entry.row.type, t)}: ${formatNum(entry.row.value)} cm`
        : `${t('body.photo')}${entry.row.tag ? ` · ${entry.row.tag}` : ''}${entry.row.note ? ` · ${entry.row.note}` : ''}`

  const save = async () => {
    try {
      if (entry.kind === 'weight' && num) await updateBodyWeight(entry.id, day, displayToKg(num, units))
      if (entry.kind === 'measurement' && num) await updateMeasurement(entry.id, day, num)
      if (entry.kind === 'photo') await updatePhoto(entry.id, { day, tag, note })
      setEditing(false); setError(false)
    } catch (e) { setError(e instanceof PhotoLimitError) }
  }
  const remove = () => {
    if (!confirm(t('body.confirmDelete'))) return
    if (entry.kind === 'weight') void deleteBodyWeight(entry.id)
    else if (entry.kind === 'measurement') void deleteMeasurement(entry.id)
    else void deletePhoto(entry.id)
  }

  return (
    <li className="entry">
      <div className="entry-main">
        {entry.kind === 'photo' && <Photo blob={entry.row.photo} alt="" className="entry-thumb" />}
        <div className="entry-text"><span>{label}</span><small className="muted">{fmt.format(entry.date)}</small></div>
        <button className="icon" aria-label={t('common.edit')} title={t('common.edit')} onClick={() => setEditing(!editing)}>✎</button>
        <button className="icon" aria-label={t('common.delete')} title={t('common.delete')} onClick={remove}>🗑</button>
      </div>
      {editing && (
        <div className="entry-edit">
          <div className="form-line">
            {entry.kind !== 'photo' && <DecimalInput value={num} onCommit={setNum} label={t('body.value')} />}
            <DateField value={day} onChange={(v) => { setDay(v); setError(false) }} label={t('body.date')} />
          </div>
          {entry.kind === 'photo' && (
            <>
              <TagPicker value={tag} onChange={setTag} tags={photoTags(photos)} />
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('body.notePlaceholder')} aria-label={t('body.note')} maxLength={200} />
            </>
          )}
          {error && <p className="warn" role="alert">{t('body.dayFull', { count: MAX_PHOTOS_PER_DAY })}</p>}
          <div className="form-line"><button className="primary" onClick={() => void save()}>{t('common.save')}</button><button onClick={() => setEditing(false)}>{t('common.cancel')}</button></div>
        </div>
      )}
    </li>
  )
}

/** Entry only: add weight, measurements and progress photos, and fix or delete past entries. The charts are in Stats → Body. */
export default function BodyLog() {
  const { t } = useTranslation()
  const [shown, setShown] = useState(PAGE)
  const rows = useLiveQuery(async () => ({
    weights: await db.bodyWeights.toArray(),
    measurements: await db.measurements.toArray(),
    photos: await db.progressPhotos.toArray(),
  }), [])

  const entries = useMemo<Entry[]>(() => {
    if (!rows) return []
    return [
      ...rows.weights.map((r): Entry => ({ kind: 'weight', id: r.id, date: r.date, row: r })),
      ...rows.measurements.map((r): Entry => ({ kind: 'measurement', id: r.id, date: r.date, row: r })),
      ...rows.photos.map((r): Entry => ({ kind: 'photo', id: r.id, date: r.date, row: r })),
    ].sort((a, b) => b.date - a.date)
  }, [rows])

  if (!rows) return null
  const customBases = [...new Set(rows.measurements.map((m) => m.type.replace(/_(l|r)$/, '')))].filter((b) => !(STANDARD_MEASUREMENTS as readonly string[]).includes(b)).sort()
  const mb = (photoBytes(rows.photos) / (1024 * 1024))

  return (
    <section>
      <BackLink to="/profile" label={t('tabs.profile')} />
      <div className="row head">
        <h1>{t('body.title')}</h1>
        <Link className="btn" to="/profile/stats?s=body">{t('body.seeStats')}</Link>
      </div>
      <WeightForm />
      <MeasurementForm customBases={customBases} />
      <PhotoForm photos={rows.photos} />
      <p className="muted small">{t('body.storage', { count: rows.photos.length, mb: mb < 0.1 && rows.photos.length ? '<0.1' : mb.toFixed(1) })}</p>
      <h2>{t('body.entries')}</h2>
      {entries.length === 0
        ? <p className="muted">{t('body.noEntries')}</p>
        : <ul className="plain entry-list">{entries.slice(0, shown).map((e) => <EntryRow key={e.kind + e.id} entry={e} photos={rows.photos} />)}</ul>}
      {entries.length > shown && <button className="wide" onClick={() => setShown(shown + PAGE)}>{t('body.showMore')}</button>}
    </section>
  )
}
