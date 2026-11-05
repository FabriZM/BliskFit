import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useGoalHistory } from '../db/goals'
import type { Exercise } from '../db/types'
import { loadDiagram, type Sex } from './BodyFigure'
import { HEAT_COLORS, drawBodyMap } from '../lib/bodyCanvas'
import { weekdayNames } from '../lib/dates'
import { dateKey, goalForWeek, streakInfo, trainingDayKeys, weekProgress } from '../lib/goals'
import { effectiveHeat, heatFromSets, heatLevel } from '../lib/muscleHeat'
import { platform } from '../lib/platform'
import { weekStart } from '../lib/programs'
import { buildWidgetSnapshot, widgetDayLabels } from '../lib/widgetSnapshot'
import { useSettings } from '../stores/settings'

const IMG_W = 480
const IMG_H = 360

/** The muscle map for the widget: this week's work shaded on a transparent background, as base64 PNG. */
async function musclesPng(heat: Map<string, number>, sex: Sex): Promise<string | undefined> {
  const max = Math.max(0, ...heat.values())
  if (max === 0) return undefined
  const [front, back] = await Promise.all([loadDiagram(sex, 'front'), loadDiagram(sex, 'back')])
  const canvas = document.createElement('canvas')
  canvas.width = IMG_W; canvas.height = IMG_H
  drawBodyMap(canvas.getContext('2d')!, { diagrams: { front, back }, level: (slug) => heatLevel(effectiveHeat(heat, `m:${slug}`), max) },
    { x: 0, y: 0, w: IMG_W, h: IMG_H }, { base: '#1d2c2a', heat: HEAT_COLORS, gap: '#0b1514' }, 40)
  return canvas.toDataURL('image/png').split(',')[1]
}

/**
 * Keeps the Android home-screen widgets up to date: whenever workouts, the weekly goal or the language change, it
 * sends the widgets this week's days, the streak and a muscle map of this week's sets. Renders nothing; the web
 * app has no widgets.
 */
export default function HomeWidgets() {
  const { t, i18n } = useTranslation()
  const { weeklyGoal, weekStartDay, streakFreezes, bodyModel } = useSettings((s) => s.settings)
  const history = useGoalHistory()
  // Coming back to the app (maybe on a new day or week) refreshes the widgets too.
  const [shownAt, setShownAt] = useState(0)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') setShownAt(Date.now()) }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
  // Everything the widgets show comes from finished workouts, so this re-runs when one is added, edited or deleted.
  const data = useLiveQuery(async () => {
    if (!platform.widgets) return null
    const sessions = await db.sessions.where('status').equals('finished').toArray()
    const start = weekStart(new Date(), weekStartDay).getTime()
    const ids = sessions.filter((s) => s.startedAt >= start).map((s) => s.id)
    const sets = ids.length ? await db.setLogs.where('sessionId').anyOf(ids).toArray() : []
    const exercises = new Map((await db.exercises.bulkGet([...new Set(sets.map((s) => s.exerciseId))])).filter((e): e is Exercise => !!e).map((e) => [e.id, e]))
    return { sessions, heat: heatFromSets(sets, exercises) }
  }, [weekStartDay])

  useEffect(() => {
    if (!data || !platform.widgets) return
    const timer = setTimeout(async () => {
      const today = new Date()
      const keys = trainingDayKeys(data.sessions)
      const goalFor = (ws: Date) => goalForWeek(history, dateKey(ws), weeklyGoal)
      const week = weekProgress(keys, today, weekStartDay, goalFor(weekStart(today, weekStartDay)))
      const { streak } = streakInfo(keys, today, weekStartDay, goalFor, streakFreezes)
      const snapshot = buildWidgetSnapshot({
        now: Date.now(), week, streak, labels: widgetDayLabels(weekdayNames(i18n.language, 'short'), weekStartDay),
        text: {
          weekTitle: t('profile.thisWeek'), musclesTitle: t('heatmap.title'), musclesEmpty: t('heatmap.empty'),
          goalLine: (count, goal) => t('profile.daysOfGoal', { count, goal }), streakLine: (n) => (n > 0 ? t('profile.streakWeeks', { count: n }) : ''),
        },
      })
      try { await platform.widgets!.update(snapshot, await musclesPng(data.heat, bodyModel === 'female' ? 'female' : 'male')) } catch { /* widgets are optional */ }
    }, 1000)
    return () => clearTimeout(timer)
  }, [data, history, weeklyGoal, weekStartDay, streakFreezes, bodyModel, t, i18n.language, shownAt])

  return null
}
