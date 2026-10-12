import { useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useDerived, useStatsData } from '../../db/stats'
import type { StatsRange } from '../../db/types'
import { gymsUsed, rangeStart, RANGES } from '../../lib/stats'
import { useNow } from '../../lib/useNow'
import { useSettings } from '../../stores/settings'
import BodySection from './BodySection'
import ExercisesSection from './ExercisesSection'
import GymsSection from './GymsSection'
import MusclesSection from './MusclesSection'
import OverviewSection from './OverviewSection'
import type { StatsCtx } from './ctx'
import { BackLink } from '../../components/PageHeader'

const SECTIONS = ['overview', 'exercises', 'muscles', 'body', 'gyms'] as const
type Section = (typeof SECTIONS)[number]

/** Profile → Stats. Every training chart and number; the section and range live in the URL so Profile pins can deep-link here. */
export default function StatsPanel() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const { weekStartDay, units } = useSettings((s) => s.settings)
  const data = useStatsData()
  const derived = useDerived(data)
  const now = useNow(60_000)
  const scrolled = useRef<string | null>(null)

  const rangeParam = params.get('r')
  const range: StatsRange = RANGES.includes(rangeParam as StatsRange) ? (rangeParam as StatsRange) : '3m'
  const gymsAvailable = !!data && gymsUsed(data.sessions).length >= 2
  const sections = SECTIONS.filter((s) => s !== 'gyms' || gymsAvailable)
  const sParam = params.get('s') as Section | null
  const section: Section = sParam && sections.includes(sParam) ? sParam : 'overview'
  const card = params.get('card')

  // Deep link from a pinned card: scroll to it once the section has rendered.
  useEffect(() => {
    if (!card || !data || scrolled.current === card) return
    const el = document.getElementById(card)
    if (!el) return
    scrolled.current = card
    el.scrollIntoView({ block: 'start' })
    el.classList.add('flash')
    setTimeout(() => el.classList.remove('flash'), 1600)
  }, [card, data, section, derived])

  const set = (patch: Record<string, string | null>) => setParams((p) => {
    const next = new URLSearchParams(p)
    for (const [k, v] of Object.entries(patch)) { if (v === null) next.delete(k); else next.set(k, v) }
    return next
  }, { replace: true })

  const today = new Date(now)
  const ctx: StatsCtx | undefined = data && derived ? {
    data, derived, range, today, weekStartDay, units, from: rangeStart(range, today), exById: derived.exById,
    input: {
      sessions: data.sessions, sets: data.sets, exById: derived.exById, muscles: data.muscles, buckets: derived.buckets,
      bodyWeights: data.bodyWeights, measurements: data.measurements,
    },
  } : undefined

  return (
    <section>
      <BackLink to="/profile" label={t('tabs.profile')} />
      <div className="row head">
        <h1>{t('stats.title')}</h1>
        <Link className="btn" to="/profile/body">{t('body.logLink')}</Link>
      </div>
      <div className="segmented stats-sections" role="tablist" aria-label={t('stats.title')}>
        {sections.map((s) => (
          <button key={s} role="tab" aria-selected={section === s} className={section === s ? 'on' : ''}
            onClick={() => set({ s, card: null })}>{t(`stats.section_${s}`)}</button>
        ))}
      </div>
      <div className="segmented small-seg range-seg" role="group" aria-label={t('chart.range')}>
        {RANGES.map((r) => (
          <button key={r} className={range === r ? 'on' : ''} aria-pressed={range === r} onClick={() => set({ r })}>{t(`stats.range_${r}`)}</button>
        ))}
      </div>
      {!ctx ? null : (
        <>
          {section === 'overview' && <OverviewSection ctx={ctx} />}
          {section === 'exercises' && <ExercisesSection ctx={ctx} />}
          {section === 'muscles' && <MusclesSection ctx={ctx} />}
          {section === 'body' && <BodySection ctx={ctx} />}
          {section === 'gyms' && gymsAvailable && <GymsSection ctx={ctx} />}
        </>
      )}
    </section>
  )
}
