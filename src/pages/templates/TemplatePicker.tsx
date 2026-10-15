import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { TEMPLATES } from '../../data/templates'
import { addTemplate, addTemplateRoutine } from '../../db/templates'
import { useSettings } from '../../stores/settings'
import { BackLink } from '../../components/PageHeader'

/** Starter programs to add with one tap; they become normal routines and a program you can edit or delete. */
export default function TemplatePicker() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const show = useSearchParams()[0].get('show')
  const programs = show !== 'routines'
  const routines = show !== 'programs'
  const weekStartDay = useSettings((s) => s.settings.weekStartDay)

  const add = async (id: string) => nav(`/routines/programs/${await addTemplate(id, (k) => t(k), weekStartDay)}`)
  const addRoutine = async (id: string, key: string) => nav(`/routines/${await addTemplateRoutine(id, key, (k) => t(k), weekStartDay)}`)

  return (
    <section>
      <BackLink to="/workout" label={t('tabs.workout')} />
      <h1>{t(show === 'routines' ? 'templates.routines' : show === 'programs' ? 'templates.programs' : 'templates.title')}</h1>
      <p className="muted">{t('templates.intro')}</p>
      {programs && <>
      {routines && <h2>{t('templates.programs')}</h2>}
      {TEMPLATES.map((tpl) => (
        <div className="card" key={tpl.id}>
          <p><strong>{t(`templates.${tpl.id}.name`)}</strong></p>
          <p className="muted small">{t(`templates.level.${tpl.level}`)} · {t('templates.perWeek', { count: tpl.daysPerWeek })}</p>
          <p>{t(`templates.${tpl.id}.desc`)}</p>
          <ul className="muted small">{tpl.routines.map((r) => <li key={r.key}>{t(`templates.${tpl.id}.r.${r.key}`)}</li>)}</ul>
          <div className="actions"><button className="primary" onClick={() => void add(tpl.id)}>{t('templates.add')}</button></div>
        </div>
      ))}
      </>}
      {routines && <>
      {programs && <h2>{t('templates.routines')}</h2>}
      {TEMPLATES.flatMap((tpl) => tpl.routines.map((r) => (
        <div className="card routine-row" key={`${tpl.id}/${r.key}`}>
          <div>
            <strong>{t(`templates.${tpl.id}.r.${r.key}`)}</strong>
            <span className="muted small"> · {t('routines.exerciseCount', { count: r.exercises.length })}</span>
            <p className="muted small">{t('templates.partOf', { program: t(`templates.${tpl.id}.name`) })}</p>
          </div>
          <button onClick={() => void addRoutine(tpl.id, r.key)}>{t('templates.add')}</button>
        </div>
      )))}
      </>}
      <p className="muted small help">{t('templates.help')}</p>
    </section>
  )
}
