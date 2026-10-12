import { useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ExercisesIcon, ProfileIcon, WorkoutIcon } from './TabIcons'

// Three tabs. Routines and programs live under Workout, so those routes keep the Workout tab highlighted.
const TABS = [
  { path: '/profile', key: 'profile', Icon: ProfileIcon, match: ['/profile'] },
  { path: '/workout', key: 'workout', Icon: WorkoutIcon, match: ['/workout', '/routines', '/import'] },
  { path: '/exercises', key: 'exercises', Icon: ExercisesIcon, match: ['/exercises'] },
] as const

/**
 * Bottom navigation. The active tab sits in a bubble (the basilisk's eye) raised in a notch of the bar. Switching tabs: the bubble dives
 * into the bar, the notch snaps to the new tab, and the bubble rises there (timings in index.css).
 */
export default function TabBar() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const active = TABS.findIndex(({ match }) => match.some((m) => pathname === m || pathname.startsWith(m + '/')))

  // Count tab changes: each one remounts the bubble to replay the dive-and-rise; the first render stays still.
  const last = useRef(active)
  const moves = useRef(0)
  if (last.current !== active) { last.current = active; moves.current++ }

  return (
    <nav className="tabbar" style={{ '--i': Math.max(0, active) } as React.CSSProperties}>
      {/* Behind the bar surface, so a diving bubble disappears into it. */}
      <div className="tabbar-bubbles" aria-hidden>
        {active >= 0 && <span className="tabbar-bubble"><i key={moves.current} className={moves.current ? 'dive' : undefined} /></span>}
      </div>
      {/* Bar surface with the notch at the centre of a double-width strip, slid under the active tab. */}
      <div className="tabbar-bg" aria-hidden>
        <div className="tabbar-fill" />
        <div className="tabbar-notch">
          <svg viewBox="0 0 112 40" width="112" height="40" preserveAspectRatio="none">
            <path className="notch-fill" d="M0 0H10C24 0 26 40 56 40S88 0 102 0H112V40H0Z" />
            <path className="notch-edge" d="M0 .5H10C24 .5 26 40.5 56 40.5S88 .5 102 .5H112" />
          </svg>
          <div className="tabbar-fill" />
        </div>
        <div className="tabbar-fill" />
      </div>
      {TABS.map(({ path, key, Icon }, i) => (
        <Link key={key} to={path} className={i === active ? 'active' : undefined} aria-current={i === active ? 'page' : undefined}>
          <Icon />
          <span>{t(`tabs.${key}`)}</span>
        </Link>
      ))}
    </nav>
  )
}
