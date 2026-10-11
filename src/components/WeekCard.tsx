import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useGoalHistory } from '../db/goals'
import { dateKey, goalForWeek, streakInfo, trainingDayKeys, weekProgress } from '../lib/goals'
import { weekdayNames } from '../lib/dates'
import { weekStart } from '../lib/programs'
import { useNow } from '../lib/useNow'
import { useSettings } from '../stores/settings'

/**
 * This week's training days against the goal, plus the weekly streak. Days with a workout are tappable: one
 * workout opens its detail, several open that day in the History calendar. Profile only (not on the Workout tab).
 */
export default function WeekCard() {
  const { t, i18n } = useTranslation()
  const nav = useNavigate()
  const { weeklyGoal, weekStartDay, streakFreezes } = useSettings((s) => s.settings)
  const history = useGoalHistory()
  const now = useNow(60_000)
  const sessions = useLiveQuery(() => db.sessions.where('status').equals('finished').toArray(), [])
  if (!sessions) return null

  const today = new Date(now)
  const keys = trainingDayKeys(sessions)
  const goalFor = (ws: Date) => goalForWeek(history, dateKey(ws), weeklyGoal)
  const goal = goalFor(weekStart(today, weekStartDay))
  const week = weekProgress(keys, today, weekStartDay, goal)
  const { streak, frozen } = streakInfo(keys, today, weekStartDay, goalFor, streakFreezes)
  const names = weekdayNames(i18n.language, 'short')

  const open = (key: string) => {
    const onDay = sessions.filter((s) => dateKey(new Date(s.startedAt)) === key)
    if (onDay.length === 1) nav(`/workout/history/${onDay[0].id}`)
    else if (onDay.length > 1) nav(`/workout/history?day=${key}`)
  }

  const streakLine = (
    <p className="streak">
      {streak > 0
        ? <>🔥 <strong>{t('profile.streakWeeks', { count: streak })}</strong></>
        : <span className="muted">{t('profile.noStreak', { count: goal })}</span>}
      {streak > 0 && !week.met && <span className="muted small"> · {t('profile.streakKeep', { count: goal - week.count })}</span>}
      {frozen.length > 0 && <span className="muted small"> · 🧊 {t('profile.freezesUsed', { count: frozen.length })}</span>}
    </p>
  )

  return (
    <div className="card week-card">
      <div className="row head">
        <h2>{t('profile.thisWeek')}</h2>
        <strong className={week.met ? 'met' : ''}>{t('profile.daysOfGoal', { count: week.count, goal })}</strong>
      </div>
      <div className="week-days">
        {week.days.map((d) => {
          const key = dateKey(d.date)
          const cls = `wd${d.trained ? ' on' : ''}${d.isToday ? ' today' : ''}${d.future ? ' future' : ''}`
          const label = `${names[d.date.getDay()]} ${d.date.getDate()}`
          return d.trained ? (
            <button key={key} className={cls} aria-label={`${label} · ${t('profile.openWorkout')}`} onClick={() => open(key)}>
              <span>✓</span><small>{names[d.date.getDay()].slice(0, 3)}</small>
            </button>
          ) : (
            <div key={key} className={cls} aria-label={label}>
              <span /><small>{names[d.date.getDay()].slice(0, 3)}</small>
            </div>
          )
        })}
      </div>
      {streakLine}
    </div>
  )
}
