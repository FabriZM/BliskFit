import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SettingsIcon } from '../components/TabIcons'
import GoalChart from '../components/GoalChart'
import GymVisitsCard from '../components/GymVisitsCard'
import PinnedStats from '../components/PinnedStats'
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
      <PinnedStats />
    </section>
  )
}
