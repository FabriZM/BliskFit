import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { db } from '../db/db'
import type { Gym } from '../db/types'
import { dateKey } from '../lib/goals'
import { effectiveVisitDays, gymPeriods, periodDays, toggleVisitDay } from '../lib/gymVisits'
import { orderedWeekdays, weekdayNames } from '../lib/dates'
import { dayDiff } from '../lib/programs'
import { useNow } from '../lib/useNow'
import { useSettings } from '../stores/settings'

/**
 * Full-screen editor for which days count as visits in a period: add a day you forgot to log, or remove one the
 * gym didn't count. Days with a recorded workout count automatically; tapping toggles them, and the three states
 * differ by more than colour (filled / filled with a "+" / dashed and struck through).
 */
export default function VisitDaysEditor({ gym, workoutDays, onClose }: { gym: Gym; workoutDays: Set<string>; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const weekStartDay = useSettings((s) => s.settings.weekStartDay)
  const today = new Date(useNow(60_000))
  const effective = effectiveVisitDays(workoutDays, gym.visitAdjustments)
  const periods = gymPeriods(gym.allowance!, effective, today)
  const [picked, setPicked] = useState<number | null>(null)
  const idx = Math.min(picked ?? periods.length - 1, periods.length - 1)
  const period = periods[idx]
  const days = periodDays(period)
  const lead = (days[0].getDay() - weekStartDay + 7) % 7
  const names = weekdayNames(i18n.language, 'short')
  const range = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' })

  const toggle = (key: string) =>
    void db.gyms.update(gym.id, { visitAdjustments: toggleVisitDay(gym.visitAdjustments, key, workoutDays.has(key)) })

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t('gymplan.editTitle', { name: gym.name })}>
      <div className="overlay-head">
        <span />
        <strong>{t('gymplan.editTitle', { name: gym.name })}</strong>
        <button className="primary" onClick={onClose}>{t('common.done')}</button>
      </div>
      <div className="overlay-body">
        <div className="cal-head">
          <button className="icon" aria-label={t('gymplan.prevPeriod')} disabled={idx === 0} onClick={() => setPicked(idx - 1)}>‹</button>
          <strong>{range.format(period.start)} – {range.format(days[days.length - 1])}</strong>
          <button className="icon" aria-label={t('gymplan.nextPeriod')} disabled={idx === periods.length - 1} onClick={() => setPicked(idx + 1)}>›</button>
        </div>
        <p className="visit-count"><strong>{t('gymplan.usedOf', { used: period.used, total: period.total })}</strong></p>

        <div className="cal-grid visit-grid">
          {orderedWeekdays(weekStartDay).map((d) => <span key={d} className="cal-dow">{names[d].slice(0, 2)}</span>)}
          {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
          {days.map((day) => {
            const key = dateKey(day)
            const workout = workoutDays.has(key)
            const counted = effective.has(key)
            const state = counted ? (workout ? 'workout' : 'added') : workout ? 'removed' : 'none'
            const future = dayDiff(today, day) > 0
            return (
              <button key={key} className={`cal-day visit-${state}${key === dateKey(today) ? ' today' : ''}`} disabled={future}
                aria-pressed={counted} aria-label={`${key} · ${t(`gymplan.state_${state}`)}`} onClick={() => toggle(key)}>
                {day.getDate()}
              </button>
            )
          })}
        </div>

        <div className="chart-key muted small">
          <span><i className="vk workout" />{t('gymplan.legendWorkout')}</span>
          <span><i className="vk added">+</i>{t('gymplan.legendAdded')}</span>
          <span><i className="vk removed" />{t('gymplan.legendRemoved')}</span>
        </div>
        <p className="muted small">{t('gymplan.editHelp')}</p>
      </div>
    </div>
  )
}
