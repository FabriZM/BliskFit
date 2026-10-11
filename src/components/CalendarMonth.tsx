import { useTranslation } from 'react-i18next'
import { dateKey } from '../lib/goals'
import { orderedWeekdays, weekdayNames } from '../lib/dates'

/** Month grid; days with a finished workout are filled. Week order follows the week-start setting. */
export default function CalendarMonth({ month, onMonthChange, trained, selected, onSelect, weekStartDay }: {
  month: Date
  onMonthChange: (m: Date) => void
  trained: Set<string>
  selected: string | null
  onSelect: (key: string | null) => void
  weekStartDay: number
}) {
  const { t, i18n } = useTranslation()
  const y = month.getFullYear(), m = month.getMonth()
  const lead = (new Date(y, m, 1).getDay() - weekStartDay + 7) % 7
  const count = new Date(y, m + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)]
  const names = weekdayNames(i18n.language, 'short')
  const todayKey = dateKey(new Date())
  const title = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(month)
  const go = (delta: number) => onMonthChange(new Date(y, m + delta, 1))

  return (
    <div className="calendar">
      <div className="cal-head">
        <button className="icon" aria-label={t('history.prevMonth')} onClick={() => go(-1)}>‹</button>
        <strong>{title}</strong>
        <button className="icon" aria-label={t('history.nextMonth')} onClick={() => go(1)}>›</button>
      </div>
      <div className="cal-grid">
        {orderedWeekdays(weekStartDay).map((d) => <span key={d} className="cal-dow">{names[d].slice(0, 2)}</span>)}
        {cells.map((day, i) => {
          if (day === null) return <span key={`b${i}`} />
          const key = dateKey(new Date(y, m, day))
          const cls = ['cal-day', trained.has(key) ? 'on' : '', key === todayKey ? 'today' : '', key === selected ? 'sel' : ''].join(' ')
          return (
            <button key={key} className={cls} aria-pressed={key === selected} aria-label={key}
              onClick={() => onSelect(key === selected ? null : key)}>{day}</button>
          )
        })}
      </div>
    </div>
  )
}
