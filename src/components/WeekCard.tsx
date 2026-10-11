import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { currentStreak, trainingDayKeys, weekProgress } from '../lib/goals'
import { weekdayNames } from '../lib/dates'
import { useNow } from '../lib/useNow'
import { useSettings } from '../stores/settings'

/** This week's training days against the goal, plus the weekly streak. */
export default function WeekCard() {
  const { t, i18n } = useTranslation()
  const { weeklyGoal, weekStartDay } = useSettings((s) => s.settings)
  const now = useNow(60_000)
  const sessions = useLiveQuery(() => db.sessions.where('status').equals('finished').toArray(), [])
  if (!sessions) return null

  const today = new Date(now)
  const keys = trainingDayKeys(sessions)
  const week = weekProgress(keys, today, weekStartDay, weeklyGoal)
  const streak = currentStreak(keys, today, weekStartDay, weeklyGoal)
  const names = weekdayNames(i18n.language, 'short')

  return (
    <div className="card week-card">
      <div className="row head">
        <h2>{t('profile.thisWeek')}</h2>
        <strong className={week.met ? 'met' : ''}>{t('profile.daysOfGoal', { count: week.count, goal: weeklyGoal })}</strong>
      </div>
      <div className="week-days">
        {week.days.map((d) => (
          <div key={d.date.getTime()} className={`wd${d.trained ? ' on' : ''}${d.isToday ? ' today' : ''}${d.future ? ' future' : ''}`}>
            <span>{d.trained ? '✓' : ''}</span>
            <small>{names[d.date.getDay()].slice(0, 3)}</small>
          </div>
        ))}
      </div>
      <p className="streak">
        {streak > 0 ? <>🔥 <strong>{t('profile.streakWeeks', { count: streak })}</strong></> : <span className="muted">{t('profile.noStreak', { count: weeklyGoal })}</span>}
        {streak > 0 && !week.met && <span className="muted small"> · {t('profile.streakKeep', { count: weeklyGoal - week.count })}</span>}
      </p>
    </div>
  )
}
