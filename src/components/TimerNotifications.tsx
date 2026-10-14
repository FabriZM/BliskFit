import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { SetLog, Units, WorkoutSession } from '../db/types'
import { adjustRest, clearRest, getActiveSession, loadLastTime, logSet } from '../db/workout'
import { formatSet } from '../lib/format'
import { nextSet, setName, setsByItem, valuesToLog, type SetName } from '../lib/nextUp'
import { weightUnitFor } from '../lib/plates'
import { NOTIFICATION_IDS, platform } from '../lib/platform'
import { forgottenDueAt, lastDoneAt, type SetValues } from '../lib/workout'
import { useSettings } from '../stores/settings'
import { exerciseName } from '../lib/exerciseName'

/** What the rest notification says comes next, and what Done would log (if anything). */
interface Next { exercise: string; name: SetName; shown?: string; payload?: string }

/** Done's payload: the set and the values the notification showed. */
interface DonePayload { sessionId: string; setId: string; values: SetValues }

async function loadNext(session: WorkoutSession, sets: SetLog[], appUnits: Units, lang: string): Promise<Next | null> {
  const set = nextSet(session.exercises, sets)
  const item = set && session.exercises.find((x) => x.id === set.itemId)
  if (!set || !item) return null
  const [exercise, last] = await Promise.all([db.exercises.get(item.exerciseId), loadLastTime(item.exerciseId, session)])
  const tracking = exercise?.trackingType ?? 'weight_reps'
  const itemSets = setsByItem(sets).get(item.id) ?? []
  const values = valuesToLog(set, itemSets, tracking, last, appUnits)
  const payload: DonePayload | undefined = values && { sessionId: session.id, setId: set.id, values }
  return {
    exercise: exercise ? exerciseName(exercise, lang) : '…', name: setName(set, itemSets),
    shown: values && formatSet({ ...set, ...values }, tracking, weightUnitFor(exercise, appUnits)),
    payload: payload && JSON.stringify(payload),
  }
}

/**
 * Owns the OS-level notifications for the running workout: the rest timer and "still working out?" (2h).
 * Always mounted, so a notification is rescheduled or cancelled correctly wherever the user is in the app,
 * and (in the Android app) it fires with the screen locked. In the Android app the rest notification counts down,
 * names the next set and can log it (Done), add 15s or skip the rest without opening the app.
 */
export default function TimerNotifications() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const appUnits = useSettings((s) => s.settings.units)
  const data = useLiveQuery(async () => {
    const session = await getActiveSession()
    const sets = session ? await db.setLogs.where('sessionId').equals(session.id).toArray() : []
    return { session, sets, next: session?.rest ? await loadNext(session, sets, appUnits, i18n.language) : null }
  }, [appUnits, i18n.language])
  const session = data?.session
  const loaded = data !== undefined

  // Rest timer
  const restEndsAt = session?.rest?.endsAt
  const next = data?.next
  const nextText = !next ? t('workout.restNotice.allDone') : t(next.shown ? 'workout.restNotice.next' : 'workout.restNotice.nextEnter', {
    name: next.exercise, values: next.shown,
    set: next.name.kind === 'working' ? t('workout.restNotice.setN', { n: next.name.n }) : t(`workout.type.${next.name.kind}`),
  })
  const payload = next?.payload
  useEffect(() => {
    if (!loaded) return
    const rn = platform.restNotification
    if (restEndsAt === undefined) {
      void (rn ? rn.hide() : platform.notifications.cancel(NOTIFICATION_IDS.rest))
      return
    }
    if (rn) {
      void rn.show({
        endsAt: restEndsAt, title: t('workout.rest'), overTitle: t('workout.restNotice.over'), text: nextText, payload,
        labels: { done: t('workout.restNotice.done'), plus: t('workout.restNotice.plus'), skip: t('workout.skipRest') },
        pendingText: t('workout.restNotice.pending'),
      })
      return
    }
    void platform.notifications.schedule({ id: NOTIFICATION_IDS.rest, at: restEndsAt, title: t('workout.restOverShort'), body: nextText })
  }, [loaded, restEndsAt, nextText, payload, t])

  // Taps on the rest notification (Android), including ones made while the app was closed.
  useEffect(() => platform.restNotification?.onAction(async (a) => {
    if (a.action === 'open') { void navigate('/workout'); return }
    const s = await getActiveSession()
    if (!s) return
    if (a.action === 'plus') await adjustRest(s.id, 15)
    else if (a.action === 'skip') await clearRest(s.id)
    else if (a.action === 'done') {
      let p: DonePayload | undefined
      try { p = JSON.parse(a.payload) as DonePayload } catch { return }
      if (p.sessionId === s.id) await logSet(p.setId, p.values)
    }
  }), [navigate])

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
