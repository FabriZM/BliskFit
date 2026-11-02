import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Exercise } from '../db/types'
import { heatFromSets } from '../lib/muscleHeat'
import { weekStart } from '../lib/programs'
import { useNow } from '../lib/useNow'
import { useSettings } from '../stores/settings'
import BodyHeatmap from './BodyHeatmap'

/** Muscles worked this week or this month as a body map. Profile only. */
export default function MuscleWeekCard() {
  const { t } = useTranslation()
  const weekStartDay = useSettings((s) => s.settings.weekStartDay)
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const now = useNow(60_000)
  const today = new Date(now)
  const from = (period === 'week' ? weekStart(today, weekStartDay) : new Date(today.getFullYear(), today.getMonth(), 1)).getTime()

  const heat = useLiveQuery(async () => {
    const ids = (await db.sessions.where('status').equals('finished').filter((s) => s.startedAt >= from).toArray()).map((s) => s.id)
    const sets = ids.length ? await db.setLogs.where('sessionId').anyOf(ids).toArray() : []
    const exIds = [...new Set(sets.map((s) => s.exerciseId))]
    const exById = new Map((await db.exercises.bulkGet(exIds)).filter((e): e is Exercise => !!e).map((e) => [e.id, e]))
    return heatFromSets(sets, exById)
  }, [from])

  return (
    <div className="card">
      <h2>{t('heatmap.title')}</h2>
      <div className="segmented" role="group" aria-label={t('heatmap.title')}>
        {(['week', 'month'] as const).map((p) => (
          <button key={p} className={period === p ? 'on' : ''} aria-pressed={period === p} onClick={() => setPeriod(p)}>{t(`heatmap.${p}`)}</button>
        ))}
      </div>
      {heat && <BodyHeatmap heat={heat} />}
    </div>
  )
}
