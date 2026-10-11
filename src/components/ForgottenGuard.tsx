import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { acknowledgeForgotten, discardSession, finishSession, getActiveSession } from '../db/workout'
import { useNow } from '../lib/useNow'
import { forgottenEndTime, isForgotten, lastDoneAt } from '../lib/workout'

/** Offers to end a session that has had no logged set for 2 active hours, wherever the user is in the app. */
export default function ForgottenGuard() {
  const { t, i18n } = useTranslation()
  const nav = useNavigate()
  const now = useNow(30_000)
  const data = useLiveQuery(async () => {
    const session = await getActiveSession()
    return session ? { session, sets: await db.setLogs.where('sessionId').equals(session.id).toArray() } : null
  }, [])

  if (!data || !isForgotten(data.session, data.sets, now)) return null
  const end = forgottenEndTime(data.session, data.sets)
  const hasSets = lastDoneAt(data.sets) !== undefined
  const endLabel = new Intl.DateTimeFormat(i18n.language, { hour: 'numeric', minute: '2-digit' }).format(end)
  return (
    <div className="modal" role="alertdialog" aria-modal="true">
      <div className="modal-card">
        <h2>{t('forgotten.title')}</h2>
        <p className="muted">{hasSets ? t('forgotten.body', { time: endLabel }) : t('forgotten.bodyEmpty')}</p>
        {hasSets ? (
          <button className="primary" onClick={async () => { await finishSession(data.session.id, end); nav(`/workout/summary/${data.session.id}`) }}>
            {t('forgotten.finish', { time: endLabel })}
          </button>
        ) : (
          <button className="danger" onClick={async () => { await discardSession(data.session.id); nav('/workout') }}>{t('workout.discard')}</button>
        )}
        <button onClick={() => void acknowledgeForgotten(data.session.id)}>{t('workout.keepGoing')}</button>
      </div>
    </div>
  )
}
