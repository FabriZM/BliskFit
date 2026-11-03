import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Exercise } from '../db/types'
import { heatFromSets } from '../lib/muscleHeat'
import { useNow } from '../lib/useNow'
import BodyHeatmap from './BodyHeatmap'

/** Muscles worked in the last 7 or 30 days (today included) as a body map. Profile only. */
export default function MuscleWeekCard() {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const now = useNow(60_000)
  const today = new Date(now)
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (period === 'week' ? 6 : 29)).getTime()

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
