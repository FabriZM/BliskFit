import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../stores/settings'

/** Traced body diagrams from MuscleMap (MIT, see src/data/musclemap/LICENSE): an outline and one path per muscle surface. */
interface Diagram { viewBox: string; outline: string; muscles: [part: string, d: string][] }
type Sex = 'male' | 'female'
type View = 'front' | 'back'

const loaders = import.meta.glob<{ default: Diagram }>('../data/musclemap/*.json')

/** Surface id (CHEST_LEFT -> CHEST) to the app's muscle slug. */
const PART_MUSCLE: Record<string, string> = {
  CHEST: 'chest', SHOULDER_FRONT: 'front-delts', SHOULDER_SIDE: 'side-delts', SHOULDER_REAR: 'rear-delts',
  BICEPS: 'biceps', TRICEPS: 'triceps', FOREARM: 'forearms', CORE: 'abdominals', OBLIQUE: 'obliques',
  QUADRICEPS: 'quadriceps', ADDUCTOR: 'adductors', ABDUCTOR: 'abductors', CALVES: 'calves', HAMSTRINGS: 'hamstrings',
  GLUTEUS: 'glutes', LATISSIMUS: 'lats', RHOMBOID: 'middle-back', LOWER_BACK: 'lower-back', TRAPEZIUS: 'traps',
}
const muscleOf = (part: string): string | undefined => PART_MUSCLE[part.replace(/_(LEFT|RIGHT)$/, '')]

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
 * Front and back body with a tappable shape per muscle (a muscle's left and right side act as one). `level` is its
 * heat step 0..5 (0 = grey), `selected` marks muscles to highlight, and `onSelect` receives the tapped muscle slug.
 * Shows the body chosen in settings.
 */
export default function BodyFigure({ level, selected, onSelect, switchable = false }: {
  level?: (slug: string) => number
  selected?: ReadonlySet<string>
  onSelect: (slug: string) => void
  /** One view at a time with a Front/Back switch (bigger shapes to tap); otherwise both side by side. */
  switchable?: boolean
}) {
  const { t } = useTranslation()
  const sex: Sex = useSettings((s) => s.settings.bodyModel) === 'female' ? 'female' : 'male'
  const [view, setView] = useState<View>('front')
  const front = useDiagram(sex, 'front')
  const back = useDiagram(sex, 'back')

  const figure = (label: string, d: Diagram | undefined) => (
    <figure>
      {d ? (
        <svg viewBox={d.viewBox} aria-hidden>
          <path className="base" d={d.outline} />
          {d.muscles.map(([part, path], i) => {
            const slug = muscleOf(part)
            const on = !!slug && !!selected?.has(slug)
            return <path key={i} className={`shape h${slug ? level?.(slug) ?? 0 : 0}${on ? ' sel' : ''}`} d={path} onClick={slug ? () => onSelect(slug) : undefined} />
          })}
        </svg>
      ) : <div className="figure-loading" />}
      {!switchable && <figcaption>{label}</figcaption>}
    </figure>
  )

  return (
    <div className={`body-fig${switchable ? ' single' : ''}`}>
      {switchable && (
        <div className="segmented" role="group" aria-label={t('heatmap.view')}>
          {(['front', 'back'] as const).map((v) => (
            <button key={v} className={view === v ? 'on' : ''} aria-pressed={view === v} onClick={() => setView(v)}>{t(`heatmap.${v}`)}</button>
          ))}
        </div>
      )}
      <div className="figures">
        {switchable
          ? figure(t(`heatmap.${view}`), view === 'front' ? front : back)
          : <>{figure(t('heatmap.front'), front)}{figure(t('heatmap.back'), back)}</>}
      </div>
    </div>
  )
}
