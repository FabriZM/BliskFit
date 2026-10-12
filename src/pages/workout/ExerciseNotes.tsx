import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId } from '../../db/db'
import type { ID } from '../../db/types'
import { useBlobUrl } from '../../lib/useBlobUrl'
import { CloseIcon, PinIcon, PinOffIcon, WrenchIcon } from '../../components/Icons'

function Photo({ blob }: { blob: Blob }) {
  const url = useBlobUrl(blob)
  return url ? <img className="photo small-photo" src={url} alt="" /> : null
}

/** Pinned notes ("for next time") and machine setup notes, shown right in the exercise card. */
export default function ExerciseNotes({ exerciseId, gymId, adding, onDoneAdding }: {
  exerciseId: ID; gymId?: ID; adding: boolean; onDoneAdding: () => void
}) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [pin, setPin] = useState(true)
  const pinned = useLiveQuery(() => db.exerciseNotes.where('exerciseId').equals(exerciseId).filter((n) => n.pinned).toArray(), [exerciseId]) ?? []
  const gyms = useLiveQuery(() => db.gyms.toArray(), []) ?? []
  const setup = (useLiveQuery(() => db.exerciseGymNotes.where('exerciseId').equals(exerciseId).toArray(), [exerciseId]) ?? [])
    // With a gym set, show that gym's notes plus untagged ones; with none, show everything.
    .filter((n) => !gymId || !n.gymId || n.gymId === gymId)

  const save = async () => {
    if (!text.trim()) return
    await db.exerciseNotes.add({ id: newId(), exerciseId, text: text.trim(), pinned: pin })
    setText('')
    onDoneAdding()
  }

  return (
    <>
      {pinned.map((n) => (
        <div className="note pinned" key={n.id}>
          <span><PinIcon filled /> {n.text}</span>
          <span>
            <button className="icon" aria-label={t('workout.unpin')} onClick={() => void db.exerciseNotes.update(n.id, { pinned: false })}><PinOffIcon /></button>
            <button className="icon" aria-label={t('common.delete')} onClick={() => void db.exerciseNotes.delete(n.id)}><CloseIcon /></button>
          </span>
        </div>
      ))}
      {setup.map((n) => (
        <div className="note setup" key={n.id}>
          <span><WrenchIcon /> {gyms.find((g) => g.id === n.gymId)?.name ? `${gyms.find((g) => g.id === n.gymId)!.name}: ` : ''}{n.text}</span>
          {n.photo && <Photo blob={n.photo} />}
        </div>
      ))}
      {adding && (
        <div className="note-form">
          <textarea rows={2} autoFocus value={text} placeholder={t('workout.notePlaceholder')} onChange={(e) => setText(e.target.value)} />
          <label className="inline"><input type="checkbox" checked={pin} onChange={(e) => setPin(e.target.checked)} /> {t('workout.pinNote')}</label>
          <div className="actions">
            <button className="primary" onClick={() => void save()}>{t('common.save')}</button>
            <button onClick={onDoneAdding}>{t('common.cancel')}</button>
          </div>
        </div>
      )}
    </>
  )
}
