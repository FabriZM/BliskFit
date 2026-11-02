import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import BodyFigure from '../../components/BodyFigure'
import { CloseIcon } from '../../components/Icons'
import type { ID, MuscleGroup } from '../../db/types'
import { leafMuscles } from '../../lib/muscles'

/**
 * Search by body: tap muscles on the figure to pick them (tap again to drop one). The button shows how many
 * exercises the pick finds, via `count`, and applies it. Neck and the calf's parts aren't drawn: use the dropdown.
 */
export default function BodyPicker({ muscles, value, count, onApply, onClose }: {
  muscles: MuscleGroup[]
  value: ID[]
  count: (ids: ID[]) => number
  onApply: (ids: ID[]) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<ID[]>(() => leafMuscles(muscles, value))
  const selected = useMemo(() => new Set(draft.filter((id) => id.startsWith('m:')).map((id) => id.slice(2))), [draft])
  const toggle = (slug: string) => setDraft((d) => (d.includes(`m:${slug}`) ? d.filter((id) => id !== `m:${slug}`) : [...d, `m:${slug}`]))
  const names = draft.map((id) => t(`muscles.${id.slice(2)}`, { defaultValue: muscles.find((m) => m.id === id)?.name ?? id }))
  const n = count(draft)

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={t('exercises.pickTitle')} onClick={onClose}>
      <div className="modal-card body-picker" onClick={(e) => e.stopPropagation()}>
        <div className="head">
          <h2>{t('exercises.pickTitle')}</h2>
          <button className="icon" aria-label={t('common.close')} onClick={onClose}><CloseIcon /></button>
        </div>
        <BodyFigure switchable selected={selected} onSelect={toggle} />
        <p className="readout muted" aria-live="polite">{names.length ? names.join(', ') : t('exercises.pickHint')}</p>
        <div className="actions">
          <button disabled={!draft.length} onClick={() => setDraft([])}>{t('exercises.clearMuscles')}</button>
          <button className="primary" onClick={() => onApply(draft)}>{t('exercises.showCount', { count: n })}</button>
        </div>
      </div>
    </div>
  )
}
