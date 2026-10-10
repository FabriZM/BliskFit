import { useTranslation } from 'react-i18next'

export default function Placeholder({ title }: { title: string }) {
  const { t } = useTranslation()
  return (
    <section>
      <h1>{title}</h1>
      <p className="muted">{t('placeholder')}</p>
    </section>
  )
}
