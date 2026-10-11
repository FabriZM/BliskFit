/** First id of the training-day reminders; one per upcoming day, ids REMINDER_ID_BASE .. +REMINDER_HORIZON-1. */
export const REMINDER_ID_BASE = 2000
export const REMINDER_HORIZON = 14

export interface PlannedReminder { id: number; at: number }

/**
 * The reminders to schedule: for each of the next `horizon` days that is one of the chosen weekdays, at `time`
 * (HH:MM, local). Times already passed are skipped, and so is today once a workout has been finished today.
 * They are scheduled individually (not as a weekly repeat) so "already trained" can suppress one; the app
 * re-plans whenever it opens, a workout finishes, or the settings change.
 */
export function reminderSchedule(now: Date, days: number[], time: string, trainedToday: boolean, horizon = REMINDER_HORIZON): PlannedReminder[] {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!days.length || !m) return []
  const hour = Math.min(23, Number(m[1])), minute = Math.min(59, Number(m[2]))
  const out: PlannedReminder[] = []
  for (let offset = 0; offset < horizon; offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hour, minute)
    if (!days.includes(day.getDay())) continue
    if (day.getTime() <= now.getTime() + 30_000) continue
    if (offset === 0 && trainedToday) continue
    out.push({ id: REMINDER_ID_BASE + offset, at: day.getTime() })
  }
  return out
}
