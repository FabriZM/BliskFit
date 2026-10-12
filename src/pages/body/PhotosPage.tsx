import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { PhotoLimitError, addPhoto, deletePhoto, updatePhoto } from '../../db/body'
import type { ProgressPhoto } from '../../db/types'
import { BackLink } from '../../components/PageHeader'
import PhotosPanel from '../../components/stats/PhotosPanel'
import { MAX_PHOTOS_PER_DAY, photoBytes, photoTags, photosOnDay } from '../../lib/body'
import { fromDateInput } from '../../lib/dates'
import { compressImage } from '../../lib/image'
import { useBlobUrl } from '../../lib/useBlobUrl'
import { DateField, EntryRow, History, TagPicker, today } from './shared'

const PHOTO_SIDE = 1280

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
  const full = photosOnDay(photos, fromDateInput(day) + 12 * 3600_000).length >= MAX_PHOTOS_PER_DAY

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
      <h2>{t('body.logNew')}</h2>
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

function PhotoRow({ photo, tags }: { photo: ProgressPhoto; tags: string[] }) {
  const { t } = useTranslation()
  const [tag, setTag] = useState(photo.tag ?? '')
  const [note, setNote] = useState(photo.note ?? '')
  return (
    <EntryRow date={photo.date} thumb={photo.photo}
      label={[photo.tag ?? t('body.untagged'), photo.note].filter(Boolean).join(' · ')}
      onSave={async (day) => {
        try { await updatePhoto(photo.id, { day, tag, note }); return true } catch (e) { if (e instanceof PhotoLimitError) return false; throw e }
      }}
      onDelete={() => void deletePhoto(photo.id)}
      saveError={t('body.dayFull', { count: MAX_PHOTOS_PER_DAY })}
      extra={<>
        <TagPicker value={tag} onChange={setTag} tags={tags} />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('body.notePlaceholder')} aria-label={t('body.note')} maxLength={200} />
      </>} />
  )
}

/** Progress photos: timeline and compare, add a photo, and every past photo with its tag and note. */
export default function PhotosPage() {
  const { t } = useTranslation()
  const photos = useLiveQuery(() => db.progressPhotos.toArray(), [])
  if (!photos) return null
  const mb = photoBytes(photos) / (1024 * 1024)
  const tags = photoTags(photos)

  return (
    <section>
      <BackLink to="/profile/body" label={t('body.title')} />
      <h1>{t('body.photos')}</h1>
      <PhotosPanel photos={photos} />
      <PhotoForm photos={photos} />
      {photos.length > 0 && <p className="muted small">{t('body.storage', { count: photos.length, mb: mb < 0.1 && photos.length ? '<0.1' : mb.toFixed(1) })}</p>}
      <History items={photos} render={(p) => <PhotoRow key={p.id} photo={p} tags={tags} />} />
    </section>
  )
}
