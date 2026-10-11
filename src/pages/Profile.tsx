import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SettingsIcon } from '../components/TabIcons'
import GoalChart from '../components/GoalChart'
import GymVisitsCard from '../components/GymVisitsCard'
import WeekCard from '../components/WeekCard'

export default function Profile() {
  const { t } = useTranslation()
  return (
    <section>
      <div className="row head">
        <h1>{t('tabs.profile')}</h1>
        <Link className="icon-link" to="/profile/settings" aria-label={t('profile.settings')} title={t('profile.settings')}><SettingsIcon /></Link>
      </div>
      <WeekCard />
      <GoalChart />
      <GymVisitsCard />
      <h2>{t('profile.stats')}</h2>
      <div className="card muted">{t('profile.comingSoon')}</div>
      <h2>{t('profile.measurements')}</h2>
      <div className="card muted">{t('profile.comingSoon')}</div>
    </section>
  )
}
