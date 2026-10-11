import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { dateKey } from '../lib/goals'
import { platform } from '../lib/platform'
import { useNotificationState } from '../lib/platform/hooks'
import { REMINDER_HORIZON, REMINDER_ID_BASE, reminderSchedule } from '../lib/reminders'
import { useNow } from '../lib/useNow'
import { useSettings } from '../stores/settings'

/**
 * Keeps the next two weeks of training-day reminders scheduled. Re-plans when the settings change, when the day
 * rolls over, when notification permission changes, and when today's workout gets finished (which suppresses
 * today's reminder). Always mounted; in the Android app these fire even when the app is closed.
 */
export default function TrainingReminders() {
  const { t } = useTranslation()
  const loaded = useSettings((s) => s.loaded)
  const { reminderDays, reminderTime } = useSettings((s) => s.settings)
  const { permission } = useNotificationState()
  const today = dateKey(new Date(useNow(60_000)))
  const trainedToday = useLiveQuery(
    async () => (await db.sessions.where('status').equals('finished').toArray()).some((s) => dateKey(new Date(s.startedAt)) === dateKey(new Date())),
    [today],
  )

  useEffect(() => {
    if (!loaded || trainedToday === undefined) return
    let stale = false
    void (async () => {
      for (let i = 0; i < REMINDER_HORIZON && !stale; i++) await platform.notifications.cancel(REMINDER_ID_BASE + i)
      for (const r of reminderSchedule(new Date(), reminderDays, reminderTime, trainedToday)) {
        if (stale) return
        await platform.notifications.schedule({ id: r.id, at: r.at, title: t('reminders.trainTitle'), body: t('reminders.trainBody') })
      }
    })()
    return () => { stale = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reminderDays is compared by value
  }, [loaded, trainedToday, today, reminderDays.join(','), reminderTime, permission, t])

  return null
}
