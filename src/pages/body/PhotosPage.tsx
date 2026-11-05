import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { PhotoLimitError, addPhoto, deletePhoto, renameTag, updatePhoto } from '../../db/body'
import type { ProgressPhoto } from '../../db/types'
import { BackLink } from '../../components/PageHeader'
import PhotosPanel from '../../components/stats/PhotosPanel'
import GhostCamera from '../../components/GhostCamera'
import PhotoCropper from '../../components/PhotoCropper'
import TagFolders, { FOLDER_ALL, FOLDER_NONE } from '../../components/TagFolders'
import { MAX_PHOTOS_PER_DAY, photoBytes, photoTags, photosOnDay, photosWithTag } from '../../lib/body'
import { fromDateInput } from '../../lib/dates'
import { useBlobUrl } from '../../lib/useBlobUrl'
import { DateField, EntryRow, History, TagPicker, today } from './shared'

function PhotoForm({ photos }: { photos: ProgressPhoto[] }) {
  const { t } = useTranslation()
  const [blob, setBlob] = useState<Blob>()
  const [toCrop, setToCrop] = useState<Blob>()
  const [shooting, setShooting] = useState(false)
  const [tag, setTag] = useState('')
  const [note, setNote] = useState('')
  const [day, setDay] = useState(today())
  const [error, setError] = useState<'full' | 'failed' | null>(null)
  const preview = useBlobUrl(blob)
  const tags = photoTags(photos)
  const full = photosOnDay(photos, fromDateInput(day) + 12 * 3600_000).length >= MAX_PHOTOS_PER_DAY

  // The last photo with the chosen tag, to line the new one up with.
  const match = tag ? photos.find((p) => p.tag?.toLowerCase() === tag.toLowerCase())?.tag : undefined
  const ghost = match ? photosWithTag(photos, match).at(-1)?.photo : undefined
  const choose = (file?: File) => { if (file) { setError(null); setToCrop(file) } }
  const canCamera = !!navigator.mediaDevices?.getUserMedia

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
        {canCamera
          ? <button type="button" className="btn file-btn" onClick={() => setShooting(true)}>{t('body.camera')}</button>
          : <label className="btn file-btn">{t('body.camera')}<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { choose(e.target.files?.[0]); e.target.value = '' }} /></label>}
        <label className="btn file-btn alt">{t('body.gallery')}<input type="file" accept="image/*" hidden onChange={(e) => { choose(e.target.files?.[0]); e.target.value = '' }} /></label>
        <DateField value={day} onChange={(v) => { setDay(v); setError(null) }} label={t('body.date')} />
      </div>
      {preview && <img src={preview} alt="" className="photo-preview" />}
      <TagPicker value={tag} onChange={setTag} tags={tags} />
      {blob && <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('body.notePlaceholder')} aria-label={t('body.note')} maxLength={200} />}
      {(full || error === 'full') && <p className="warn" role="alert">{t('body.dayFull', { count: MAX_PHOTOS_PER_DAY })}</p>}
      {error === 'failed' && <p className="warn" role="alert">{t('body.photoFailed')}</p>}
      <button className="primary wide" disabled={!blob || full}>{t('body.savePhoto')}</button>
      {shooting && <GhostCamera ghost={ghost} onCancel={() => setShooting(false)} onCapture={(f) => { setShooting(false); setToCrop(f) }} onUnavailable={() => { setShooting(false); setError('failed') }} />}
      {toCrop && <PhotoCropper image={toCrop} onCancel={() => setToCrop(undefined)} onDone={(b) => { setBlob(b); setToCrop(undefined) }} />}
    </form>
  )
}

function PhotoRow({ photo, tags }: { photo: ProgressPhoto; tags: string[] }) {
  const { t } = useTranslation()
  const [tag, setTag] = useState(photo.tag ?? '')
  const [note, setNote] = useState(photo.note ?? '')
  const [cropping, setCropping] = useState(false)
  return (
    <EntryRow date={photo.date} thumb={photo.photo}
      label={[photo.tag ?? t('body.untagged'), photo.note].filter(Boolean).join(' · ')}
      onSave={async (day) => {
        try { await updatePhoto(photo.id, { day, tag, note }); return true } catch (e) { if (e instanceof PhotoLimitError) return false; throw e }
      }}
      onDelete={() => void deletePhoto(photo.id)}
      saveError={t('body.dayFull', { count: MAX_PHOTOS_PER_DAY })}
      extra={<>
        <button type="button" onClick={() => setCropping(true)}>{t('body.recrop')}</button>
        {cropping && <PhotoCropper image={photo.photo} onCancel={() => setCropping(false)} onDone={(b) => { setCropping(false); void updatePhoto(photo.id, { photo: b }) }} />}
        <TagPicker value={tag} onChange={setTag} tags={tags} />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('body.notePlaceholder')} aria-label={t('body.note')} maxLength={200} />
      </>} />
  )
}

/** Progress photos: timeline and compare, add a photo, and every past photo with its tag and note. */
export default function PhotosPage() {
  const { t } = useTranslation()
  const photos = useLiveQuery(() => db.progressPhotos.toArray(), [])
  const [chosen, setFolder] = useState(FOLDER_ALL)
  if (!photos) return null
  // A folder that no longer exists (its photos were deleted or retagged) falls back to all photos.
  const folder = chosen === FOLDER_ALL || (chosen === FOLDER_NONE ? photos.some((p) => !p.tag) : photos.some((p) => p.tag === chosen)) ? chosen : FOLDER_ALL
  const mb = photoBytes(photos) / (1024 * 1024)
  const tags = photoTags(photos)

  return (
    <section>
      <BackLink to="/profile/body" label={t('body.title')} />
      <h1>{t('body.photos')}</h1>
      <PhotosPanel photos={photos} />
      <PhotoForm photos={photos} />
      {photos.length > 0 && <p className="muted small">{t('body.storage', { count: photos.length, mb: mb < 0.1 && photos.length ? '<0.1' : mb.toFixed(1) })}</p>}
      {photos.length > 0 && <TagFolders photos={photos} value={folder} onChange={setFolder} />}
      {folder !== FOLDER_ALL && folder !== FOLDER_NONE && (
        <button type="button" onClick={async () => {
          const name = prompt(t('body.renamePrompt'), folder)?.trim()
          if (name && name !== folder) { await renameTag(folder, name); setFolder(name) }
        }}>{t('body.renameTag')}</button>
      )}
      <History items={folder === FOLDER_ALL ? photos : photos.filter((p) => (p.tag ?? FOLDER_NONE) === folder)} render={(p) => <PhotoRow key={p.id} photo={p} tags={tags} />} />
    </section>
  )
}
