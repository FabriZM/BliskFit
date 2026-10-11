import { useTranslation } from 'react-i18next'
import { useSettings } from '../stores/settings'
import type { PRKind } from '../lib/prs'

/** Highlighted "PR" pill (no animation). Hidden entirely when PR badges are switched off in Settings. */
export default function PRBadge({ kinds, inline = false }: { kinds: PRKind[]; inline?: boolean }) {
  const { t } = useTranslation()
  const show = useSettings((s) => s.settings.prBadges)
  if (!show || kinds.length === 0) return null
  return <span className={`pr-badge${inline ? ' inline' : ''}`} title={kinds.map((k) => t(`pr.kind.${k}`)).join(' · ')}>PR</span>
}
