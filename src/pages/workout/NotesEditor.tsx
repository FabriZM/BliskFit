import { useEffect, useState } from 'react'
import { db } from '../../db/db'

/** Saves while typing (debounced) and on blur, so a note is never lost if the app is closed mid-edit. */
export default function NotesEditor({ sessionId, initial, placeholder }: { sessionId: string; initial: string; placeholder: string }) {
  const [text, setText] = useState(initial)
  const save = (v: string) => void db.sessions.update(sessionId, { notes: v.trim() || undefined })
  useEffect(() => {
    if (text === initial) return
    const timer = setTimeout(() => save(text), 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the text drives saving
  }, [text])
  return <textarea rows={3} value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} onBlur={() => save(text)} />
}
