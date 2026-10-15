import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { TEMPLATES } from '../../data/templates'
import { addTemplate } from '../../db/templates'
import { useSettings } from '../../stores/settings'
import { BackLink } from '../../components/PageHeader'

/** Starter programs to add with one tap; they become normal routines and a program you can edit or delete. */
export default function TemplatePicker() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const weekStartDay = useSettings((s) => s.settings.weekStartDay)

  const add = async (id: string) => nav(`/routines/programs/${await addTemplate(id, (k) => t(k), weekStartDay)}`)

  return (
    <section>
      <BackLink to="/workout" label={t('tabs.workout')} />
      <h1>{t('templates.title')}</h1>
      <p className="muted">{t('templates.intro')}</p>
      {TEMPLATES.map((tpl) => (
        <div className="card" key={tpl.id}>
          <p><strong>{t(`templates.${tpl.id}.name`)}</strong></p>
          <p className="muted small">{t(`templates.level.${tpl.level}`)} · {t('templates.perWeek', { count: tpl.daysPerWeek })}</p>
          <p>{t(`templates.${tpl.id}.desc`)}</p>
          <ul className="muted small">{tpl.routines.map((r) => <li key={r.key}>{t(`templates.${tpl.id}.r.${r.key}`)}</li>)}</ul>
          <div className="actions"><button className="primary" onClick={() => void add(tpl.id)}>{t('templates.add')}</button></div>
        </div>
      ))}
      <p className="muted small help">{t('templates.help')}</p>
    </section>
  )
}
