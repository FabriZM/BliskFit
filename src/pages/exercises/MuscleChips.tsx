import { useTranslation } from 'react-i18next'
import type { ID, MuscleGroup } from '../../db/types'
import { muscleLabel, orderMuscles } from '../../lib/muscles'

/** Chip picker over the muscle hierarchy. `taken` muscles are disabled (already used in the other list). */
export default function MuscleChips({ muscles, value, onChange, taken = [] }: {
  muscles: MuscleGroup[]; value: ID[]; onChange: (v: ID[]) => void; taken?: ID[]
}) {
  const { t } = useTranslation()
  const toggle = (id: ID) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  return (
    <div className="chips">
      {orderMuscles(muscles).map((m) => (
        <button type="button" key={m.id} disabled={taken.includes(m.id)}
          className={`chip${value.includes(m.id) ? ' on' : ''}${m.parentId ? ' child' : ''}`}
          aria-pressed={value.includes(m.id)} onClick={() => toggle(m.id)}>
          {muscleLabel(m, t)}
        </button>
      ))}
    </div>
  )
}
