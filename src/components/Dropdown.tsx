import { useEffect, useId, useRef, useState } from 'react'

export type DropdownOption = { value: string; label: string; disabled?: boolean; indent?: boolean }

/** App-styled replacement for a native <select> (no OS picker). */
export function Dropdown({ value, options, onChange, label }: {
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
  /** Accessible name. */
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  // Fixed so cards with overflow:hidden (sets, exercise cards) can't clip the list.
  const [pos, setPos] = useState<React.CSSProperties>({})
  const root = useRef<HTMLDivElement>(null)
  const id = useId()
  const current = options.find((o) => o.value === value)
  const enabled = (i: number) => i >= 0 && i < options.length && !options[i].disabled

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const close = (e: Event) => { if (!(e.target instanceof Node && root.current?.contains(e.target))) setOpen(false) }
    document.addEventListener('pointerdown', away)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => { document.removeEventListener('pointerdown', away); window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close) }
  }, [open])

  useEffect(() => {
    if (open) root.current?.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest' })
  }, [open])

  const show = () => {
    const r = root.current?.getBoundingClientRect()
    if (r) {
      const below = window.innerHeight - r.bottom, up = below < 200 && r.top > below
      const room = Math.max(120, (up ? r.top : below) - 12)
      setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - 8 - Math.max(r.width, 180))), minWidth: r.width, maxHeight: Math.min(320, room),
        ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }) })
    }
 setActive(Math.max(0, options.findIndex((o) => o.value === value))); setOpen(true) }
  const pick = (i: number) => { if (!enabled(i)) return; onChange(options[i].value); setOpen(false) }
  const move = (dir: 1 | -1) => {
    let i = active
    do { i += dir } while (i >= 0 && i < options.length && options[i].disabled)
    if (enabled(i)) { setActive(i); root.current?.querySelector(`[data-i="${i}"]`)?.scrollIntoView({ block: 'nearest' }) }
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && open) { e.preventDefault(); setOpen(false) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); open ? move(1) : show() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); open ? move(-1) : show() }
    else if ((e.key === 'Enter' || e.key === ' ') && open) { e.preventDefault(); pick(active) }
  }

  return (
    <div className="dd" ref={root} onKeyDown={onKeyDown}>
      <button type="button" className="dd-btn" aria-haspopup="listbox" aria-expanded={open} aria-controls={id} aria-label={label}
        onClick={() => (open ? setOpen(false) : show())}>
        <span>{current?.label ?? ''}</span>
      </button>
      {open && (
        <ul className="dd-list" style={pos} id={id} role="listbox" aria-label={label}>
          {options.map((o, i) => (
            <li key={o.value} data-i={i} role="option" aria-selected={o.value === value} aria-disabled={o.disabled || undefined}
              className={`${o.value === value ? 'sel ' : ''}${i === active ? 'act ' : ''}${o.indent ? 'indent' : ''}`}
              onPointerEnter={() => enabled(i) && setActive(i)} onClick={(e) => { e.preventDefault(); pick(i) }}>
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
