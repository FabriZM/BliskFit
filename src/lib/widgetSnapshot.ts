import { orderedWeekdays } from './dates'
import type { WeekProgress } from './goals'

/** What the Android home-screen widgets show (see android/.../WidgetStore.java); the app pushes it after changes. */
export interface WidgetSnapshot {
  /** Epoch ms this was built. */
  updatedAt: number
  week: {
    /** Seven days from the week's first day. */
    days: { label: string; trained: boolean; today: boolean; future: boolean }[]
    count: number
    goal: number
    met: boolean
  }
  /** Weeks in a row the goal was met. */
  streak: number
  /** Texts, already in the app's language, so the widgets need no translations of their own. */
  text: { weekTitle: string; musclesTitle: string; goalLine: string; streakLine: string; musclesEmpty: string }
}

/** Single-letter-ish day labels from the locale's short names, in the order the week starts on. */
export const widgetDayLabels = (shortNames: string[], weekStartDay: number): string[] =>
  orderedWeekdays(weekStartDay).map((d) => Array.from(shortNames[d] ?? '')[0]?.toUpperCase() ?? '')

export function buildWidgetSnapshot(i: {
  now: number
  week: WeekProgress
  streak: number
  labels: string[]
  text: Omit<WidgetSnapshot['text'], 'goalLine' | 'streakLine'> & { goalLine: (count: number, goal: number) => string; streakLine: (streak: number) => string }
}): WidgetSnapshot {
  return {
    updatedAt: i.now,
    week: {
      days: i.week.days.map((d, k) => ({ label: i.labels[k] ?? '', trained: d.trained, today: d.isToday, future: d.future })),
      count: i.week.count, goal: i.week.goal, met: i.week.met,
    },
    streak: i.streak,
    text: { ...i.text, goalLine: i.text.goalLine(i.week.count, i.week.goal), streakLine: i.text.streakLine(i.streak) },
  }
}
