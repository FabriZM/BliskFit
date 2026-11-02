import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ID } from '../db/types'
import { HEAT_LEVELS, effectiveHeat, heatLevel } from '../lib/muscleHeat'
import BodyFigure from './BodyFigure'

/**
 * Front and back body map shaded by how much each muscle was worked: grey = not targeted, light to dark red =
 * more sets. `heat` is sets per muscle id (see lib/muscleHeat). Colour is never the only signal: tapping a muscle
 * reads out its sets and a list below gives them all.
 */
export default function BodyHeatmap({ heat }: { heat: Map<ID, number> }) {
  const { t } = useTranslation()
  const [sel, setSel] = useState<string>()
  const max = Math.max(0, ...heat.values())
  const sets = (n: number) => t('heatmap.sets', { count: Math.round(n * 10) / 10 })
  const name = (slug: string) => t(`muscles.${slug}`)
  const toggle = (slug: string) => setSel((cur) => (cur === slug ? undefined : slug))
  const readout = sel ? `${name(sel)} · ${sets(effectiveHeat(heat, `m:${sel}`))}` : max === 0 ? t('heatmap.empty') : ''
  const worked = [...heat].filter(([id, v]) => v > 0 && id.startsWith('m:')).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const selected = useMemo(() => new Set(sel ? [sel] : []), [sel])

  return (
    <div className="body-heatmap" role="group" aria-label={t('heatmap.aria')}>
      <BodyFigure level={(slug) => heatLevel(effectiveHeat(heat, `m:${slug}`), max)} selected={selected} onSelect={toggle} />
      <p className="readout" aria-live="polite">{readout}</p>
      <div className="legend" aria-hidden>
        <span>{t('heatmap.none')}</span>
        {Array.from({ length: HEAT_LEVELS + 1 }, (_, i) => <i key={i} style={{ background: `var(--heat-${i})` }} />)}
        <span>{t('heatmap.more')}</span>
      </div>
      {worked.length > 0 && (
        <details>
          <summary>{t('heatmap.list')}</summary>
          <ul>
            {worked.map(([id, v]) => {
              const slug = id.slice(2)
              return <li key={id}><button className={slug === sel ? 'on' : ''} onClick={() => toggle(slug)}><span>{name(slug)}</span><span className="muted">{sets(v)}</span></button></li>
            })}
          </ul>
        </details>
      )}
    </div>
  )
}
