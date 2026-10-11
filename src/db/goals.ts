import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { useSettings } from '../stores/settings'
import { dateKey, withGoalChange, type GoalChange } from '../lib/goals'
import { weekStart } from '../lib/programs'

const KEY = 'goalHistory'

export async function getGoalHistory(): Promise<GoalChange[]> {
  return ((await db.meta.get(KEY))?.value as GoalChange[] | undefined) ?? []
}

/** Live goal history (empty until the goal has been changed once). */
export function useGoalHistory(): GoalChange[] {
  return useLiveQuery(getGoalHistory, []) ?? []
}

/**
 * Changes the weekly goal. Past weeks keep the goal they had; the new one applies from the current week.
 * Stored as a small change log in `meta`, so every goal view is derived (nothing per week is stored).
 */
export async function setWeeklyGoal(newGoal: number): Promise<void> {
  const { settings, update } = useSettings.getState()
  const oldGoal = settings.weeklyGoal
  if (newGoal === oldGoal) return
  const weekKey = dateKey(weekStart(new Date(), settings.weekStartDay))
  await db.meta.put({ key: KEY, value: withGoalChange(await getGoalHistory(), { oldGoal, newGoal, weekKey }) })
  await update({ weeklyGoal: newGoal })
}
