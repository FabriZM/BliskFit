import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ID } from '../db/types'
import { HEAT_LEVELS, heatLevel } from '../lib/muscleHeat'

/** Traced body diagrams from MuscleMap (MIT, see src/data/musclemap/LICENSE): an outline and one path per muscle surface. */
interface Diagram { viewBox: string; outline: string; muscles: [part: string, d: string][] }
type Sex = 'male' | 'female'
type View = 'front' | 'back'

const loaders = import.meta.glob<{ default: Diagram }>('../data/musclemap/*.json')

/** Surface id (CHEST_LEFT -> CHEST) to the app's muscle slug. Obliques have no muscle of their own and count as abdominals. */
const PART_MUSCLE: Record<string, string> = {
  CHEST: 'chest', SHOULDER_FRONT: 'shoulders', SHOULDER_SIDE: 'shoulders', SHOULDER_REAR: 'shoulders',
  BICEPS: 'biceps', TRICEPS: 'triceps', FOREARM: 'forearms', CORE: 'abdominals', OBLIQUE: 'abdominals',
  QUADRICEPS: 'quadriceps', ADDUCTOR: 'adductors', ABDUCTOR: 'abductors', CALVES: 'calves', HAMSTRINGS: 'hamstrings',
  GLUTEUS: 'glutes', LATISSIMUS: 'lats', RHOMBOID: 'middle-back', LOWER_BACK: 'lower-back', TRAPEZIUS: 'traps',
}
const muscleOf = (part: string): string | undefined => PART_MUSCLE[part.replace(/_(LEFT|RIGHT)$/, '')]

const SEX_KEY = 'heatmap-sex'
const storedSex = (): Sex => { try { return localStorage.getItem(SEX_KEY) === 'female' ? 'female' : 'male' } catch { return 'male' } }

function useDiagram(sex: Sex, view: View): Diagram | undefined {
  const [d, setD] = useState<Diagram>()
  useEffect(() => {
    let live = true
    setD(undefined)
    void loaders[`../data/musclemap/${sex}-${view}.json`]?.().then((m) => { if (live) setD(m.default) })
    return () => { live = false }
  }, [sex, view])
  return d
}

/**
 * Front and back body map shaded by how much each muscle was worked: grey = not targeted, light to dark red =
 * more sets. `heat` is sets per muscle id (see lib/muscleHeat). Colour is never the only signal: tapping a muscle
 * reads out its sets and a list below gives them all.
 */
export default function BodyHeatmap({ heat }: { heat: Map<ID, number> }) {
  const { t } = useTranslation()
  const [sel, setSel] = useState<string>()
  const [sex, setSex] = useState<Sex>(storedSex)
  const max = Math.max(0, ...heat.values())
  const sets = (n: number) => t('heatmap.sets', { count: Math.round(n * 10) / 10 })
  const name = (slug: string) => t(`muscles.${slug}`)
  const toggle = (slug: string) => setSel((cur) => (cur === slug ? undefined : slug))
  const readout = sel ? `${name(sel)} · ${sets(heat.get(`m:${sel}`) ?? 0)}` : max === 0 ? t('heatmap.empty') : ''
  const worked = [...heat].filter(([id, v]) => v > 0 && id.startsWith('m:')).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const front = useDiagram(sex, 'front')
  const back = useDiagram(sex, 'back')

  const pickSex = (s: Sex) => { setSex(s); try { localStorage.setItem(SEX_KEY, s) } catch { /* private mode */ } }

  const figure = (label: string, d: Diagram | undefined) => (
    <figure>
      {d ? (
        <svg viewBox={d.viewBox} aria-hidden>
          <path className="base" d={d.outline} />
          {d.muscles.map(([part, path], i) => {
            const slug = muscleOf(part)
            const level = slug ? heatLevel(heat.get(`m:${slug}`) ?? 0, max) : 0
            return <path key={i} className={`shape h${level}${slug && slug === sel ? ' sel' : ''}`} d={path} onClick={slug ? () => toggle(slug) : undefined} />
          })}
        </svg>
      ) : <div className="figure-loading" />}
      <figcaption>{label}</figcaption>
    </figure>
  )

  return (
    <div className="body-heatmap" role="group" aria-label={t('heatmap.aria')}>
      <div className="figures">
        {figure(t('heatmap.front'), front)}
        {figure(t('heatmap.back'), back)}
      </div>
      <p className="readout" aria-live="polite">{readout}</p>
      <div className="legend" aria-hidden>
        <span>{t('heatmap.none')}</span>
        {Array.from({ length: HEAT_LEVELS + 1 }, (_, i) => <i key={i} style={{ background: `var(--heat-${i})` }} />)}
        <span>{t('heatmap.more')}</span>
      </div>
      <div className="sex-toggle" role="group" aria-label={t('heatmap.model')}>
        {(['male', 'female'] as const).map((s) => (
          <button key={s} className={sex === s ? 'on' : ''} aria-pressed={sex === s} onClick={() => pickSex(s)}>{t(`heatmap.${s}`)}</button>
        ))}
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
