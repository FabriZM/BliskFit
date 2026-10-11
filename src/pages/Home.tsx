import { useTranslation } from 'react-i18next'
import TodayCard from '../components/TodayCard'

export default function Home() {
  const { t } = useTranslation()
  return (
    <section>
      <h1>{t('tabs.home')}</h1>
      <TodayCard />
    </section>
  )
}
