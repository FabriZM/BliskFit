import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/** Top of a tab's main screen: optional logo mark, the title, and icon/button actions on the right. */
export default function PageHeader({ title, actions, brand }: { title: ReactNode; actions?: ReactNode; brand?: boolean }) {
  return (
    <header className="page-head">
      {brand && <span className="brand-mark" aria-hidden />}
      <h1>{title}</h1>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}

/** Chevron-only "back" button at the top of a sub-screen; `label` names the destination for screen readers. */
export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link className="back-link" to={to} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
    </Link>
  )
}
