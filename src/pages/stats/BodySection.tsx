import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import AsymmetryList from '../../components/stats/AsymmetryList'
import PhotosPanel from '../../components/stats/PhotosPanel'
import SeriesCard from '../../components/stats/SeriesCard'
import { measurementLabel } from '../../components/stats/measurementLabel'
import { BODY_FAT, STANDARD_MEASUREMENTS, parseMeasurementType } from '../../lib/body'
import type { StatsCtx } from './ctx'
import { ArrowRightIcon } from '../../components/Icons'

const order = (base: string) => {
  if (base === BODY_FAT) return -1
  const i = (STANDARD_MEASUREMENTS as readonly string[]).indexOf(base)
  return i < 0 ? 100 : i
}

/** Read-only: weight with trend, each measurement (left/right side by side), asymmetry, progress photos. Logging is on the Body log screen. */
export default function BodySection({ ctx }: { ctx: StatsCtx }) {
  const { t } = useTranslation()
  const { data } = ctx
  if (!data.bodyWeights.length && !data.measurements.length && !data.photos.length) {
    return <div className="card muted">{t('stats.bodyEmpty')} <Link to="/profile/body">{t('stats.openBodyLog')}</Link></div>
  }

  // Group measurement types by base name so left/right sit next to each other.
  const types = [...new Set(data.measurements.map((m) => m.type))]
  const bases = [...new Set(types.map((x) => parseMeasurementType(x).base))].sort((a, b) => order(a) - order(b) || a.localeCompare(b))

  return (
    <>
      <p className="small"><Link to="/profile/body">{t('stats.openBodyLog')} <ArrowRightIcon /></Link></p>
      {data.bodyWeights.length > 0 && <SeriesCard ctx={ctx} pin={{ kind: 'bodyweight', range: ctx.range }} title={t('body.weight')}>
        <p className="muted small">{t('stats.trendHelp')}</p>
      </SeriesCard>}
      {bases.map((base) => {
        const group = types.filter((x) => parseMeasurementType(x).base === base).sort()
        return (
          <div key={base} className={group.length > 1 ? 'pair-grid' : undefined}>
            {group.map((type) => (
              <SeriesCard key={type} ctx={ctx} pin={{ kind: 'measurement', measurement: type, range: ctx.range }} title={measurementLabel(type, t)} />
            ))}
          </div>
        )
      })}
      {data.measurements.length > 0 && <div className="card"><AsymmetryList measurements={data.measurements} /></div>}
      <PhotosPanel photos={data.photos} />
    </>
  )
}
