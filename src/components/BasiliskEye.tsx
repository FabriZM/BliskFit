import { EYE_PATH } from '../lib/brand'

/**
 * The basilisk's eye, drawn once and shared (tab bar, rest bar, launch screen) so they all match.
 * `pupil`: 0 = a closed slit (locked in) … 1 = round. `open`: 0 = lid shut … 1 = fully open.
 * Both are applied as CSS transforms, so a change animates when the caller adds a transition.
 */
export default function BasiliskEye({ pupil = 0, open = 1, size = 24, className }: { pupil?: number; open?: number; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden>
      <g className="eye-lid" style={{ transform: `scaleY(${open})`, transformOrigin: '12px 12px' }}>
        <path d={EYE_PATH} fill="currentColor" opacity=".22" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <ellipse className="eye-pupil" cx="12" cy="12" rx="4" ry="5.2" fill="currentColor"
          style={{ transform: `scaleX(${0.22 + 0.78 * pupil})`, transformOrigin: '12px 12px' }} />
      </g>
    </svg>
  )
}
