import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PinSpec } from '../../db/types'
import { setPins } from '../../db/stats'
import { MAX_PINS, isPinned, togglePin } from '../../lib/pins'
import { useSettings } from '../../stores/settings'

/** Pins (or unpins) a card, with this card's current range, to Profile. At most 6 pins. */
export default function PinButton({ pin, label }: { pin: PinSpec; label: string }) {
  const { t } = useTranslation()
  const pins = useSettings((s) => s.settings.pinnedStats)
  const [full, setFull] = useState(false)
  const pinned = isPinned(pins, pin)
  return (
    <>
      <button className={`icon pin${pinned ? ' on' : ''}`} aria-pressed={pinned} title={pinned ? t('stats.unpin') : t('stats.pin')}
        aria-label={`${pinned ? t('stats.unpin') : t('stats.pin')}: ${label}`}
        onClick={() => {
          const current = useSettings.getState().settings.pinnedStats
          const next = togglePin(current, pin)
          if (!next) return setFull(true)
          setFull(false)
          void setPins(next)
        }}>{pinned ? '★' : '☆'}</button>
      {full && <span className="pin-full small" role="status">{t('stats.pinsFull', { count: MAX_PINS })}</span>}
    </>
  )
}
