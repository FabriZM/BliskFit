import { describe, expect, it } from 'vitest'
import { weekProgress } from './goals'
import { buildWidgetSnapshot, widgetDayLabels } from './widgetSnapshot'

const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

describe('widget snapshot', () => {
  it('starts the labels on the week start day', () => {
    expect(widgetDayLabels(SHORT, 1)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S'])
    expect(widgetDayLabels(SHORT, 0)[0]).toBe('S')
  })
  it('carries the week, streak and ready-made texts', () => {
    const today = new Date(2026, 10, 5) // Thursday
    const week = weekProgress(new Set(['2026-11-02', '2026-11-04']), today, 1, 3)
    const s = buildWidgetSnapshot({
      now: 1, week, streak: 4, labels: widgetDayLabels(SHORT, 1),
      text: { weekTitle: 'This week', musclesTitle: 'Muscles', musclesEmpty: '-', goalLine: (c, g) => `${c}/${g}`, streakLine: (n) => `${n} wk` },
    })
    expect(s.week.days.map((d) => d.trained)).toEqual([true, false, true, false, false, false, false])
    expect(s.week.days[3]).toMatchObject({ today: true, future: false })
    expect(s.week.days[4].future).toBe(true)
    expect(s.text).toMatchObject({ goalLine: '2/3', streakLine: '4 wk' })
  })
})
