import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId } from '../../db/db'
import type { ID } from '../../db/types'
import { useBlobUrl } from '../../lib/useBlobUrl'
import { CloseIcon, PinIcon, WrenchIcon } from '../../components/Icons'

function Photo({ blob }: { blob: Blob }) {
  const url = useBlobUrl(blob)
  return url ? <img className="photo small-photo" src={url} alt="" /> : null
}

/** Notes are short cues ("seat at 4, pin at 6"): one line keeps the card compact. */
const NOTE_MAX = 60
// The counter shows up only for the last stretch before the limit.
const NOTE_COUNTER_FROM = NOTE_MAX - 15

/** Text box for a note: Enter or tapping away keeps what was typed, Escape drops it. Empty counts as dropped. */
function NoteInput({ initial = '', label, onDone }: { initial?: string; label: string; onDone: (text: string | null) => void }) {
  const { t } = useTranslation()
  const [text, setText] = useState(initial)
  // Enter and the blur that follows both finish; only the first one counts.
  const done = useRef(false)
  const finish = (keep: boolean) => {
    if (done.current) return
    done.current = true
    const kept = text.trim().slice(0, NOTE_MAX)
    onDone(keep && kept ? kept : null)
  }
  return (
    <span className="note-input-wrap">
      <textarea className="note-input" rows={2} autoFocus enterKeyHint="done" value={text} aria-label={label} maxLength={NOTE_MAX}
        placeholder={t('workout.notePlaceholder')} onChange={(e) => setText(e.target.value.slice(0, NOTE_MAX))}
        onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
        onBlur={() => finish(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(true) }
          else if (e.key === 'Escape') finish(false)
        }} />
      {text.length >= NOTE_COUNTER_FROM && (
        <small className={`note-count${text.length >= NOTE_MAX ? ' full' : ''}`} aria-live="polite">{text.length}/{NOTE_MAX}</small>
      )}
    </span>
  )
}

/** The exercise's note (one per exercise; older data may hold several, all shown, pinned ones "for next time" first) and machine setup notes, shown right in the exercise card. */
export default function ExerciseNotes({ exerciseId, gymId, adding, onDoneAdding }: {
  exerciseId: ID; gymId?: ID; adding: boolean; onDoneAdding: () => void
}) {
  const { t } = useTranslation()
  // The note being edited in place (tap its text).
  const [editing, setEditing] = useState<ID | null>(null)
  // Unpinning keeps the note; only the X deletes it.
  const notes = (useLiveQuery(() => db.exerciseNotes.where('exerciseId').equals(exerciseId).toArray(), [exerciseId]) ?? [])
    .sort((a, b) => Number(b.pinned) - Number(a.pinned))
  const gyms = useLiveQuery(() => db.gyms.toArray(), []) ?? []
  const setup = (useLiveQuery(() => db.exerciseGymNotes.where('exerciseId').equals(exerciseId).toArray(), [exerciseId]) ?? [])
    // With a gym set, show that gym's notes plus untagged ones; with none, show everything.
    .filter((n) => !gymId || !n.gymId || n.gymId === gymId)

  // One note per exercise: asking to add one when it already has a note opens that note instead.
  const editingId = editing ?? (adding && notes.length ? notes[0].id : null)
  const stopEditing = () => { setEditing(null); if (adding) onDoneAdding() }

  return (
    <>
      {notes.map((n) => (
        <div className={`note${n.pinned ? ' pinned' : ''}`} key={n.id}>
          <button className="icon" aria-pressed={n.pinned} aria-label={n.pinned ? t('workout.unpin') : t('workout.pinNote')}
            onClick={() => void db.exerciseNotes.update(n.id, { pinned: !n.pinned })}><PinIcon filled={n.pinned} /></button>
          {editingId === n.id
            ? <NoteInput initial={n.text} label={t('workout.editNote')} onDone={(text) => {
                if (text && text !== n.text) void db.exerciseNotes.update(n.id, { text })
                stopEditing()
              }} />
            : <button className="note-text" title={t('workout.editNote')} onClick={() => setEditing(n.id)}>{n.text}</button>}
          <button className="icon" aria-label={t('common.delete')} onClick={() => void db.exerciseNotes.delete(n.id)}><CloseIcon /></button>
        </div>
      ))}
      {setup.map((n) => (
        <div className="note setup" key={n.id}>
          <span><WrenchIcon /> {gyms.find((g) => g.id === n.gymId)?.name ? `${gyms.find((g) => g.id === n.gymId)!.name}: ` : ''}{n.text}</span>
          {n.photo && <Photo blob={n.photo} />}
        </div>
      ))}
      {adding && notes.length === 0 && (
        // Whatever was typed becomes a note, unpinned (pin it afterwards from the note itself).
        <div className="note-form">
          <NoteInput label={t('workout.addNote')} onDone={(text) => {
            if (text) void db.exerciseNotes.add({ id: newId(), exerciseId, text, pinned: false })
            onDoneAdding()
          }} />
        </div>
      )}
    </>
  )
}
