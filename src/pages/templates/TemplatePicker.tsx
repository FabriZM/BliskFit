import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { TEMPLATES } from '../../data/templates'
import { addTemplate, addTemplateRoutine } from '../../db/templates'
import { useSettings } from '../../stores/settings'
import { BackLink } from '../../components/PageHeader'
import { CheckIcon } from '../../components/Icons'

/** Starter programs to add with one tap; they become normal routines and a program you can edit or delete. */
export default function TemplatePicker() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = params.get('show') === 'programs' ? 'programs' : 'routines'
  const weekStartDay = useSettings((s) => s.settings.weekStartDay)

  const add = async (id: string) => nav(`/routines/programs/${await addTemplate(id, (k) => t(k), weekStartDay)}`)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const addRoutine = async (id: string, key: string) => {
    await addTemplateRoutine(id, key, (k) => t(k), weekStartDay)
    setAdded((s) => new Set(s).add(`${id}/${key}`))
  }

  return (
    <section>
      <BackLink to="/workout" label={t('tabs.workout')} />
      <h1>{t('templates.title')}</h1>
      <p className="muted">{t('templates.intro')}</p>
      <div className="segmented" role="group" aria-label={t('templates.title')}>
        {(['routines', 'programs'] as const).map((k) => (
          <button key={k} className={tab === k ? 'on' : ''} aria-pressed={tab === k} onClick={() => setParams({ show: k }, { replace: true })}>{t(`templates.${k}`)}</button>
        ))}
      </div>
      {tab === 'programs' && <>
      {TEMPLATES.map((tpl) => (
        <div className="card template-card stacked" key={tpl.id}>
          <div>
          <p><strong>{t(`templates.${tpl.id}.name`)}</strong></p>
          <p className="muted small">{t(`templates.level.${tpl.level}`)} · {t('templates.perWeek', { count: tpl.daysPerWeek })}</p>
          <p>{t(`templates.${tpl.id}.desc`)}</p>
          <ul className="muted small">{tpl.routines.map((r) => <li key={r.key}>{t(`templates.${tpl.id}.r.${r.key}`)}</li>)}</ul>
          </div>
          <button className="primary" onClick={() => void add(tpl.id)}>{t('templates.add')}</button>
        </div>
      ))}
      </>}
      {tab === 'routines' && <>
      {TEMPLATES.flatMap((tpl) => tpl.routines.map((r) => (
        <div className="card template-card" key={`${tpl.id}/${r.key}`}>
          <div>
            <strong>{t(`templates.${tpl.id}.r.${r.key}`)}</strong>
            <span className="muted small"> · {t('routines.exerciseCount', { count: r.exercises.length })}</span>
            <p className="muted small">{t('templates.partOf', { program: t(`templates.${tpl.id}.name`) })}</p>
          </div>
          <button className="primary" disabled={added.has(`${tpl.id}/${r.key}`)} onClick={() => void addRoutine(tpl.id, r.key)}>
            {added.has(`${tpl.id}/${r.key}`) ? <><CheckIcon /> {t('templates.added')}</> : t('templates.add')}
          </button>
        </div>
      )))}
      </>}
      <p className="muted small help">{t('templates.help')}</p>
    </section>
  )
}
