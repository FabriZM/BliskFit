import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { muscleLabel } from '../../lib/muscles'
import { formatNum } from '../../lib/units'
import type { Exercise, SetLog } from '../../db/types'
import { muscleSetCounts } from '../../lib/workout'

/** "Chest 12 · Triceps 4.5" — sets so far this session, per muscle. */
export default function MuscleCounter({ sets, exercises }: { sets: SetLog[]; exercises: Map<string, Exercise> }) {
  const { t } = useTranslation()
  const muscles = useLiveQuery(() => db.muscleGroups.toArray(), []) ?? []
  const counts = [...muscleSetCounts(sets, exercises)].sort((a, b) => b[1] - a[1])
  if (!counts.length) return null
  return (
    <div className="muscle-counter" aria-label={t('workout.musclesSoFar')}>
      {counts.map(([id, n]) => {
        const m = muscles.find((x) => x.id === id)
        return <span className="chip on" key={id}>{m ? muscleLabel(m, t) : id} {formatNum(n)}</span>
      })}
    </div>
  )
}
