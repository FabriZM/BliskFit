import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId } from '../../db/db'
import { getActiveProgramId, setActiveProgramId } from '../../db/programs'
import { weekStart } from '../../lib/programs'
import { useSettings } from '../../stores/settings'
import { BackLink } from '../../components/PageHeader'
import EmptyState from '../../components/EmptyState'
import { CalendarIcon } from '../../components/TabIcons'
import { CheckIcon } from '../../components/Icons'

export default function ProgramList() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const weekStartDay = useSettings((s) => s.settings.weekStartDay)
  const data = useLiveQuery(async () => ({ programs: await db.programs.toArray(), active: await getActiveProgramId() }), [])

  const create = async () => {
    const id = newId()
    await db.programs.add({
      id, name: t('programs.untitled'), mode: 'weekday', weeks: 1,
      startDate: weekStart(new Date(), weekStartDay).getTime(), schedule: { 0: {} },
    })
    nav(`/routines/programs/${id}`)
  }

  return (
    <section>
      <BackLink to="/workout" label={t('tabs.workout')} />
      <div className="row head">
        <h1>{t('programs.title')}</h1>
        <button className="primary" onClick={() => void create()}>+ {t('programs.new')}</button>
      </div>
      {data && data.programs.length === 0 && <EmptyState icon={<CalendarIcon />} action={<button className="primary" onClick={() => nav('/routines/templates?show=programs')}>{t('templates.browsePrograms')}</button>}>{t('programs.none')}</EmptyState>}
      <ul className="list">
        {data?.programs.map((p) => (
          <li key={p.id}>
            <div className="routine-row">
              <Link to={`/routines/programs/${p.id}`}>
                <strong>{p.name}{data.active === p.id ? <> · <CheckIcon /> {t('programs.active')}</> : null}</strong>
                <span className="muted">{p.mode === 'rotation' ? t('programs.rotationSummary', { count: p.rotation?.length ?? 0 }) : t('programs.weeksSummary', { count: p.weeks })}</span>
              </Link>
              {data.active !== p.id && <button onClick={() => void setActiveProgramId(p.id)}>{t('programs.setActive')}</button>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
