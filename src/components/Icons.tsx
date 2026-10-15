import type { ReactNode } from 'react'

/**
 * UI icons: 24px grid, round 2px strokes in the current text color, sized to the surrounding text unless `size` is
 * given. Decorative by default; pass `label` when the icon carries meaning on its own (no visible text next to it).
 */
export interface IconProps { size?: number | string; label?: string; className?: string }

function Icon({ size = '1.2em', label, className, children, filled }: IconProps & { children: ReactNode; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={`ico${className ? ` ${className}` : ''}`}
      fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {children}
    </svg>
  )
}

const dots = (points: [number, number][]) => points.map(([cx, cy]) => <circle key={`${cx},${cy}`} cx={cx} cy={cy} r="1.6" fill="currentColor" stroke="none" />)

export const TrashIcon = (p: IconProps) => <Icon {...p}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" /></Icon>
export const PencilIcon = (p: IconProps) => <Icon {...p}><path d="M16.5 3.5l4 4L8 20H4v-4z" /><path d="M13.5 6.5l4 4" /></Icon>
export const CloseIcon = (p: IconProps) => <Icon {...p}><path d="M18 6L6 18M6 6l12 12" /></Icon>
export const CheckIcon = (p: IconProps) => <Icon {...p}><path d="M5 12.5l4.5 4.5L19 7" /></Icon>
export const StarIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Icon {...p} filled={filled}><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z" /></Icon>
)
export const ArchiveIcon = (p: IconProps) => <Icon {...p}><path d="M3 4h18v4H3zM5 8v12h14V8M10 12h4" /></Icon>
export const ShareIcon = (p: IconProps) => <Icon {...p}><path d="M12 15V3M8 7l4-4 4 4M5 12v8h14v-8" /></Icon>
export const CopyIcon = (p: IconProps) => <Icon {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></Icon>
export const MoreIcon = (p: IconProps) => <Icon {...p}>{dots([[5, 12], [12, 12], [19, 12]])}</Icon>
export const GripIcon = (p: IconProps) => <Icon {...p}>{dots([[9, 6], [15, 6], [9, 12], [15, 12], [9, 18], [15, 18]])}</Icon>
export const RepeatIcon = (p: IconProps) => <Icon {...p}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></Icon>
export const PauseIcon = (p: IconProps) => <Icon {...p}><path d="M9 5v14M15 5v14" /></Icon>
export const PlayIcon = (p: IconProps) => <Icon {...p}><path d="M7 4.5l12 7.5-12 7.5z" /></Icon>
export const SwapIcon = (p: IconProps) => <Icon {...p}><path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" /></Icon>
export const TimerIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M10 2h4" /></Icon>
export const SlidersIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></Icon>
)
export const SkipIcon = (p: IconProps) => <Icon {...p}><path d="M5 5l10 7-10 7z" /><path d="M19 5v14" /></Icon>
export const UndoIcon = (p: IconProps) => <Icon {...p}><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></Icon>
export const BulbIcon = (p: IconProps) => (
  <Icon {...p}><path d="M9 18h6M10 21.5h4" /><path d="M12 2.5a6.5 6.5 0 0 0-3.8 11.8c.5.4.8 1 .8 1.7v.5h6V16c0-.7.3-1.3.8-1.7A6.5 6.5 0 0 0 12 2.5z" /></Icon>
)
export const NoteIcon = (p: IconProps) => <Icon {...p}><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13 20h7" /></Icon>
export const PinIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Icon {...p} filled={filled}><path d="M12 17v5" /><path d="M9 3h6l-1 6 3 3v3H7v-3l3-3z" /></Icon>
)
export const PinOffIcon = (p: IconProps) => <Icon {...p}><path d="M12 17v5M9 3h6l-1 6 3 3v3H7v-3l3-3z" /><path d="M3 3l18 18" /></Icon>
export const WrenchIcon = (p: IconProps) => (
  <Icon {...p}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" /></Icon>
)
export const BellIcon = (p: IconProps) => <Icon {...p}><path d="M6 9a6 6 0 0 1 12 0c0 6.5 2.5 8 2.5 8h-17S6 15.5 6 9" /><path d="M10.3 21a2 2 0 0 0 3.4 0" /></Icon>
export const DumbbellIcon = (p: IconProps) => <Icon {...p}><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" /></Icon>
export const LinkIcon = (p: IconProps) => (
  <Icon {...p}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></Icon>
)
export const AlertIcon = (p: IconProps) => <Icon {...p}><path d="M12 3.5L2.5 20h19z" /><path d="M12 10v4M12 17v.01" /></Icon>
export const FlameIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 22c4 0 7-2.8 7-7 0-4-3-6.5-4-9.5-1.5 2-2 3.5-2 5-1.5-1-2.5-3-2.5-5.5C7 8 5 11 5 15c0 4.2 3 7 7 7z" /></Icon>
)
export const SnowflakeIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 2v20M3.3 7l17.4 10M20.7 7L3.3 17" /><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5" /></Icon>
)
export const ArrowRightIcon = (p: IconProps) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>
export const ArrowUpIcon = (p: IconProps) => <Icon {...p}><path d="M12 19V5M6 11l6-6 6 6" /></Icon>
export const ArrowDownIcon = (p: IconProps) => <Icon {...p}><path d="M12 5v14M6 13l6 6 6-6" /></Icon>
export const ChevronUpIcon = (p: IconProps) => <Icon {...p}><path d="M6 15l6-6 6 6" /></Icon>
export const ChevronDownIcon = (p: IconProps) => <Icon {...p}><path d="M6 9l6 6 6-6" /></Icon>
export const ChevronLeftIcon = (p: IconProps) => <Icon {...p}><path d="M15 6l-6 6 6 6" /></Icon>
export const ChevronRightIcon = (p: IconProps) => <Icon {...p}><path d="M9 6l6 6-6 6" /></Icon>
/** Filled triangles for up/down changes next to a number. */
export const TrendUpIcon = (p: IconProps) => <Icon size=".8em" {...p} filled><path d="M12 6l7 11H5z" /></Icon>
export const TrendDownIcon = (p: IconProps) => <Icon size=".8em" {...p} filled><path d="M12 18L5 7h14z" /></Icon>
