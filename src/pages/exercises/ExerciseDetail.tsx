import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId } from '../../db/db'
import { toggleFavorite, useFavorites } from '../../db/favorites'
import { compressImage } from '../../lib/image'
import { muscleLabel } from '../../lib/muscles'
import { describeExercise } from '../../lib/describe'
import { demoImageUrls } from '../../lib/seed'
import { useBlobUrl } from '../../lib/useBlobUrl'
import EquipmentSettings from '../../components/EquipmentSettings'
import { usesWeight } from '../../lib/plates'
import ExerciseRecords from './ExerciseRecords'
import { BackLink } from '../../components/PageHeader'
import { PlayIcon, StarIcon } from '../../components/Icons'

function NotePhoto({ blob }: { blob: Blob }) {
  const url = useBlobUrl(blob)
  return url ? <img className="photo" src={url} alt="" /> : null
}

export default function ExerciseDetail() {
  const { t, i18n } = useTranslation()
  const nav = useNavigate()
  const id = decodeURIComponent(useParams().id ?? '')
  const ex = useLiveQuery(() => db.exercises.get(id), [id])
  // Opened from a running workout: back goes to the workout, not the exercise list.
  const fromWorkout = (useLocation().state as { back?: string } | null)?.back === '/workout'
  const muscles = useLiveQuery(() => db.muscleGroups.toArray(), []) ?? []
  const gyms = useLiveQuery(() => db.gyms.toArray(), []) ?? []
  const notes = useLiveQuery(() => db.exerciseGymNotes.where('exerciseId').equals(id).toArray(), [id]) ?? []
  const photoUrl = useBlobUrl(ex?.photo)
  const favorites = useFavorites()

  const [text, setText] = useState('')
  const [gymId, setGymId] = useState('')
  const [notePhoto, setNotePhoto] = useState<Blob>()

  if (ex === undefined) return <p className="muted">…</p>
  if (!ex) return <section><p>{t('exercises.notFound')}</p><Link to="/exercises">{t('tabs.exercises')}</Link></section>

  const name = (mid: string) => { const m = muscles.find((x) => x.id === mid); return m ? muscleLabel(m, t) : mid }
  const demo = ex.source === 'seeded' && ex.demoUrl ? demoImageUrls(id.replace(/^x:/, ''), 2) : []
  const about = describeExercise(ex, name, t, i18n.language)
  const gymName = (gid?: string) => gyms.find((g) => g.id === gid)?.name

  const addNote = async () => {
    if (!text.trim() && !notePhoto) return
    await db.exerciseGymNotes.add({ id: newId(), exerciseId: id, gymId: gymId || undefined, text: text.trim(), photo: notePhoto })
    setText(''); setNotePhoto(undefined); setGymId('')
  }

  const remove = async () => {
    if (await db.setLogs.where('exerciseId').equals(id).count()) return alert(t('exercises.inUse'))
    if (!confirm(t('exercises.confirmDelete'))) return
    await db.transaction('rw', db.exercises, db.exerciseGymNotes, db.exerciseNotes, db.favorites, async () => {
      await db.favorites.delete(id)
      await db.exerciseGymNotes.where('exerciseId').equals(id).delete()
      await db.exerciseNotes.where('exerciseId').equals(id).delete()
      await db.exercises.delete(id)
    })
    nav('/exercises', { replace: true })
  }

  return (
    <section>
      <BackLink to={fromWorkout ? '/workout' : '/exercises'} label={fromWorkout ? t('tabs.workout') : t('tabs.exercises')} />
      <div className="row head">
        <h1>{ex.name}</h1>
        <button className={`star${favorites.has(id) ? ' on' : ''}`} aria-pressed={favorites.has(id)}
          aria-label={favorites.has(id) ? t('exercises.unfavorite') : t('exercises.favorite')} onClick={() => void toggleFavorite(id)}>
          <StarIcon filled={favorites.has(id)} />
        </button>
      </div>
      <p className="muted">
        {t(`tracking.${ex.trackingType}`)} · {t(`equipment.${ex.equipment ?? 'none'}`, { defaultValue: ex.equipment ?? '' })}
        {ex.level && <> · {t(`exercises.level.${ex.level}`)}</>}
      </p>
      {about && <p className="about">{about}</p>}
      {photoUrl && <img className="hero" src={photoUrl} alt={ex.name} />}
      {demo.length > 0 && <div className="demo">{demo.map((u) => <img key={u} className="hero" src={u} alt="" loading="lazy" />)}</div>}
      <p><strong>{t('exercises.primary')}:</strong> {ex.primaryMuscleIds.map(name).join(', ') || '—'}</p>
      {ex.secondaryMuscleIds.length > 0 && <p><strong>{t('exercises.secondary')}:</strong> {ex.secondaryMuscleIds.map(name).join(', ')}</p>}
      {ex.videoUrl && <p><a href={ex.videoUrl} target="_blank" rel="noreferrer noopener"><PlayIcon /> {t('exercises.video')}</a></p>}

      {ex.instructions && ex.instructions.length > 0 && (
        <>
          <h2>{t('exercises.howTo')}</h2>
          <ol className="steps">{ex.instructions.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </>
      )}

      <ExerciseRecords exercise={ex} />

      {usesWeight(ex.trackingType) && (
        <>
          <h2>{t('equipmentSettings.title')}</h2>
          <EquipmentSettings exercise={ex} />
        </>
      )}

      <h2>{t('exercises.setupNotes')}</h2>
      <ul className="list">
        {notes.map((n) => (
          <li key={n.id}><div>
            {gymName(n.gymId) && <span className="muted">{gymName(n.gymId)}</span>}
            <p>{n.text}</p>
            {n.photo && <NotePhoto blob={n.photo} />}
            <button onClick={() => void db.exerciseGymNotes.delete(n.id)}>{t('common.delete')}</button>
          </div></li>
        ))}
      </ul>
      <div className="form">
        <textarea rows={2} value={text} placeholder={t('exercises.notePlaceholder')} onChange={(e) => setText(e.target.value)} />
        {gyms.length > 0 && (
          <select value={gymId} onChange={(e) => setGymId(e.target.value)} aria-label={t('gyms.gym')}>
            <option value="">{t('gyms.anyGym')}</option>
            {gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
        <input type="file" accept="image/*" aria-label={t('exercises.photo')}
          onChange={async (e) => { const f = e.target.files?.[0]; if (f) setNotePhoto(await compressImage(f)) }} />
        <button className="primary" onClick={() => void addNote()}>{t('exercises.addNote')}</button>
      </div>

      {ex.source === 'custom' && (
        <div className="actions">
          <Link className="btn" to={`/exercises/${encodeURIComponent(id)}/edit`}>{t('common.edit')}</Link>
          <button className="danger" onClick={() => void remove()}>{t('common.delete')}</button>
        </div>
      )}
    </section>
  )
}
