import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { getActiveSession } from '../db/workout'
import { NOTIFICATION_IDS, platform } from '../lib/platform'
import { forgottenDueAt, lastDoneAt } from '../lib/workout'

/**
 * Owns the OS-level notifications for the running workout: "rest is over" and "still working out?" (2h).
 * Always mounted, so a notification is rescheduled or cancelled correctly wherever the user is in the app,
 * and (in the Android app) it fires with the screen locked.
 */
export default function TimerNotifications() {
  const { t } = useTranslation()
  const data = useLiveQuery(async () => {
    const session = await getActiveSession()
    return { session, sets: session ? await db.setLogs.where('sessionId').equals(session.id).toArray() : [] }
  }, [])
  const session = data?.session
  const loaded = data !== undefined

  // Rest timer
  const restEndsAt = session?.rest?.endsAt
  useEffect(() => {
    if (!loaded) return
    if (restEndsAt === undefined) { void platform.notifications.cancel(NOTIFICATION_IDS.rest); return }
    void platform.notifications.schedule({
      id: NOTIFICATION_IDS.rest, at: restEndsAt, title: t('workout.restOverShort'), body: t('workout.restNotification'),
    })
  }, [loaded, restEndsAt, t])

  // Forgotten session: due 2 active hours after the last activity; pauses push it back (or cancel it while paused).
  const lastSet = data ? lastDoneAt(data.sets) : undefined
  const id = session?.id, status = session?.status, pauses = session?.pausedIntervals.length, ack = session?.forgotAckAt
  useEffect(() => {
    if (!loaded) return
    const due = data && session ? forgottenDueAt(session, data.sets, Date.now()) : undefined
    if (due === undefined) { void platform.notifications.cancel(NOTIFICATION_IDS.forgotten); return }
    void platform.notifications.schedule({
      id: NOTIFICATION_IDS.forgotten, at: due, title: t('forgotten.title'), body: t('forgotten.notification'),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately keyed on the inputs of the due time
  }, [loaded, id, status, pauses, ack, lastSet, t])

  return null
}
