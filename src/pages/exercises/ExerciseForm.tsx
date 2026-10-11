import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId } from '../../db/db'
import type { Exercise, TrackingType } from '../../db/types'
import { compressImage } from '../../lib/image'
import { useBlobUrl } from '../../lib/useBlobUrl'
import MuscleChips from './MuscleChips'

export const TRACKING_TYPES: TrackingType[] = [
  'weight_reps', 'bodyweight_reps', 'bodyweight_added', 'assisted_bodyweight', 'duration', 'cardio',
]
const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'kettlebells', 'bands', 'body only', 'e-z curl bar', 'other']

export default function ExerciseForm() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const params = useParams()
  const editingId = params.id ? decodeURIComponent(params.id) : undefined
  const muscles = useLiveQuery(() => db.muscleGroups.toArray(), []) ?? []

  const [name, setName] = useState('')
  const [trackingType, setTrackingType] = useState<TrackingType>('weight_reps')
  const [equipment, setEquipment] = useState('')
  const [mechanic, setMechanic] = useState<'' | 'compound' | 'isolation'>('')
  const [primary, setPrimary] = useState<string[]>([])
  const [secondary, setSecondary] = useState<string[]>([])
  const [videoUrl, setVideoUrl] = useState('')
  const [restSec, setRestSec] = useState('')
  const [photo, setPhoto] = useState<Blob>()
  const [error, setError] = useState('')
  const preview = useBlobUrl(photo)

  useEffect(() => {
    if (!editingId) return
    void db.exercises.get(editingId).then((e) => {
      if (!e) return
      setName(e.name); setTrackingType(e.trackingType); setEquipment(e.equipment ?? ''); setMechanic(e.mechanic ?? '')
      setPrimary(e.primaryMuscleIds); setSecondary(e.secondaryMuscleIds)
      setVideoUrl(e.videoUrl ?? ''); setRestSec(e.defaultRestSec?.toString() ?? ''); setPhoto(e.photo)
    })
  }, [editingId])

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!name.trim()) return setError(t('exercises.nameRequired'))
    if (!primary.length) return setError(t('exercises.primaryRequired'))
    const existing = editingId ? await db.exercises.get(editingId) : undefined
    const ex: Exercise = {
      ...existing,
      id: existing?.id ?? newId(),
      name: name.trim(),
      trackingType,
      equipment: equipment || undefined,
      mechanic: mechanic || undefined,
      primaryMuscleIds: primary,
      secondaryMuscleIds: secondary.filter((m) => !primary.includes(m)),
      photo,
      videoUrl: videoUrl.trim() || undefined,
      defaultRestSec: restSec ? Number(restSec) : undefined,
      source: existing?.source ?? 'custom',
    }
    await db.exercises.put(ex)
    nav(`/exercises/${encodeURIComponent(ex.id)}`, { replace: true })
  }

  return (
    <section>
      <h1>{editingId ? t('exercises.edit') : t('exercises.new')}</h1>
      <form onSubmit={(e) => void save(e)} className="form">
        <label>{t('exercises.name')}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Calf raise (seated machine X)" />
        </label>
        <label>{t('exercises.trackingType')}
          <select value={trackingType} onChange={(e) => setTrackingType(e.target.value as TrackingType)}>
            {TRACKING_TYPES.map((x) => <option key={x} value={x}>{t(`tracking.${x}`)}</option>)}
          </select>
        </label>
        <label>{t('exercises.equipment')}
          <select value={equipment} onChange={(e) => setEquipment(e.target.value)}>
            <option value="">{t('equipment.none')}</option>
            {EQUIPMENT.map((x) => <option key={x} value={x}>{t(`equipment.${x}`, { defaultValue: x })}</option>)}
          </select>
        </label>
        <label>{t('exercises.mechanic')}
          <select value={mechanic} onChange={(e) => setMechanic(e.target.value as '' | 'compound' | 'isolation')}>
            <option value="">{t('exercises.mechanicNone')}</option>
            <option value="compound">{t('exercises.compound')}</option>
            <option value="isolation">{t('exercises.isolation')}</option>
          </select>
        </label>
        <fieldset><legend>{t('exercises.primary')}</legend>
          <MuscleChips muscles={muscles} value={primary} onChange={setPrimary} />
        </fieldset>
        <fieldset><legend>{t('exercises.secondary')}</legend>
          <MuscleChips muscles={muscles} value={secondary} onChange={setSecondary} taken={primary} />
        </fieldset>
        <label>{t('exercises.photo')}
          <input type="file" accept="image/*" onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) setPhoto(await compressImage(f))
          }} />
        </label>
        {preview && <div><img className="photo" src={preview} alt="" /> <button type="button" onClick={() => setPhoto(undefined)}>{t('exercises.removePhoto')}</button></div>}
        <label>{t('exercises.video')}
          <input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://" />
        </label>
        <label>{t('exercises.defaultRest')}
          <input type="number" inputMode="numeric" min={0} value={restSec} onChange={(e) => setRestSec(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="submit" className="primary">{t('common.save')}</button>
          <button type="button" onClick={() => nav(-1)}>{t('common.cancel')}</button>
        </div>
      </form>
    </section>
  )
}
