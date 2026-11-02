import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ID } from '../db/types'
import { HEAT_LEVELS, heatLevel, regionHeat, type HeatRegion } from '../lib/muscleHeat'

interface Region extends HeatRegion { d: string[] }

const ell = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`
/** The same shape on the left and right of the body (figure is 100 wide, centred on 50). */
const pair = (cx: number, cy: number, rx: number, ry: number) => [ell(cx, cy, rx, ry), ell(100 - cx, cy, rx, ry)]
const m = (slug: string): ID => `m:${slug}`

/** Hand-drawn, stylised regions. Ids are muscle slugs; a region's muscles are what colours it. */
const FRONT: Region[] = [
  { id: 'neck', muscles: [m('neck')], d: ['M45 25h10v8H45z'] },
  { id: 'shoulders', muscles: [m('shoulders')], d: pair(30, 41, 8.5, 8) },
  { id: 'chest', muscles: [m('chest')], d: ['M49 37c-5-2-10-1-13 2l1 12c5 3 10 3 12 0z', 'M51 37c5-2 10-1 13 2l-1 12c-5 3-10 3-12 0z'] },
  { id: 'biceps', muscles: [m('biceps')], d: pair(23.5, 58, 5, 11) },
  { id: 'forearms', muscles: [m('forearms')], d: pair(19.5, 85, 4.5, 13) },
  { id: 'abdominals', muscles: [m('abdominals')], d: ['M42.5 56h15v32a7.5 7.5 0 0 1-15 0z'] },
  { id: 'quadriceps', muscles: [m('quadriceps')], d: pair(41, 124, 9, 25) },
  { id: 'adductors', muscles: [m('adductors')], d: pair(48, 112, 2.2, 13) },
  { id: 'calves', muscles: [m('calves')], d: pair(40, 176, 6, 17) },
]
const BACK: Region[] = [
  { id: 'traps', muscles: [m('traps')], d: ['M50 25l12 8-5 14h-14l-5-14z'] },
  { id: 'shoulders', muscles: [m('shoulders')], d: pair(30, 41, 8.5, 8) },
  { id: 'lats', muscles: [m('lats')], d: ['M37 48l8 4-1 24-7-6z', 'M63 48l-8 4 1 24 7-6z'] },
  { id: 'middle-back', muscles: [m('middle-back')], d: ['M45.5 52h9v14h-9z'] },
  { id: 'lower-back', muscles: [m('lower-back')], d: ['M44.5 68h11v13h-11z'] },
  { id: 'triceps', muscles: [m('triceps')], d: pair(23.5, 58, 5, 11) },
  { id: 'forearms', muscles: [m('forearms')], d: pair(19.5, 85, 4.5, 13) },
  { id: 'glutes', muscles: [m('glutes')], d: pair(42, 93, 8.5, 9) },
  { id: 'abductors', muscles: [m('abductors')], d: pair(31, 93, 3.5, 6) },
  { id: 'hamstrings', muscles: [m('hamstrings')], d: pair(41, 127, 8.5, 22) },
  { id: 'calves', muscles: [m('calves')], d: pair(40, 176, 6, 17) },
]

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
  const name = (id: string) => t(`muscles.${id}`)
  const readout = sel ? `${name(sel)} · ${sets(heat.get(m(sel)) ?? 0)}` : max === 0 ? t('heatmap.empty') : ''
  const worked = [...heat].filter(([id, v]) => v > 0 && id.startsWith('m:')).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

  const figure = (label: string, regions: Region[]) => (
    <figure>
      <svg viewBox="0 0 100 205">
        <circle className="base" cx="50" cy="13" r="10" />
        <rect className="base" x="34" y="30" width="32" height="68" rx="9" />
        <path className="base" d="M33 100h34l-3 90H36z" />
        {regions.map((r) => {
          const v = regionHeat(heat, r)
          const cls = `shape h${heatLevel(v, max)}${sel === r.id ? ' sel' : ''}`
          return (
            <g key={r.id} tabIndex={0} role="button" aria-label={`${name(r.id)}, ${sets(v)}`}
              onClick={() => setSel(sel === r.id ? undefined : r.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(sel === r.id ? undefined : r.id) } }}>
              {r.d.map((d, i) => <path key={i} className={cls} d={d} />)}
            </g>
          )
        })}
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  )

  return (
    <div className="body-heatmap" role="group" aria-label={t('heatmap.aria')}>
      <div className="figures">
        {figure(t('heatmap.front'), FRONT)}
        {figure(t('heatmap.back'), BACK)}
      </div>
      <p className="readout" aria-live="polite">{readout}</p>
      <div className="legend" aria-hidden>
        <span>{t('heatmap.none')}</span>
        {Array.from({ length: HEAT_LEVELS + 1 }, (_, i) => <i key={i} style={{ background: `var(--heat-${i})` }} />)}
        <span>{t('heatmap.more')}</span>
      </div>
      {worked.length > 0 && (
        <details>
          <summary>{t('heatmap.list')}</summary>
          <ul>{worked.map(([id, v]) => <li key={id}><span>{name(id.replace(/^m:/, ''))}</span><span className="muted">{sets(v)}</span></li>)}</ul>
        </details>
      )}
    </div>
  )
}
