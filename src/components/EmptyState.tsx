import type { ReactNode } from 'react'

/** Friendly placeholder for an empty list or screen: an icon, a short message and an optional action. */
export default function EmptyState({ icon, children, action }: { icon: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden>{icon}</span>
      <p>{children}</p>
      {action}
    </div>
  )
}
