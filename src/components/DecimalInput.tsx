import { useEffect, useRef, useState } from 'react'
import { formatNum, parseDecimal } from '../lib/units'

/** Number field that tolerates mid-edit text ("82.", ",5") and only commits parsed values. */
export default function DecimalInput({ value, onCommit, placeholder, label, integer = false, className, selectOnFocus = false }: {
  value: number | undefined
  /** Select the whole value on focus, so typing replaces it instead of adding digits to it (set fields). */
  selectOnFocus?: boolean
  /** Extra classes for the input. */
  className?: string
  onCommit: (v: number | undefined) => void
  placeholder?: string
  label: string
  integer?: boolean
}) {
  const [text, setText] = useState(value === undefined ? '' : formatNum(value))
  // The tap that focused the field would drop the caret where it landed and undo the selection; keep it selected.
  const justFocused = useRef(false)
  useEffect(() => {
    if (parseDecimal(text) !== value) setText(value === undefined ? '' : formatNum(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only resync when the stored value changes
  }, [value])
  return (
    <input className={`num wide-num${className ? ` ${className}` : ''}`} type="text" inputMode={integer ? 'numeric' : 'decimal'} aria-label={label}
      placeholder={placeholder} value={text}
      onFocus={selectOnFocus ? (e) => { justFocused.current = true; e.currentTarget.select() } : undefined}
      onMouseUp={selectOnFocus ? (e) => { if (justFocused.current) { justFocused.current = false; e.preventDefault(); e.currentTarget.select() } } : undefined}
      onBlur={selectOnFocus ? () => { justFocused.current = false } : undefined}
      onChange={(e) => {
        const v = e.target.value.replace(integer ? /[^\d]/g : /[^\d.,]/g, '')
        setText(v)
        if (v === '') return onCommit(undefined)
        const n = parseDecimal(v)
        if (n !== undefined) onCommit(integer ? Math.round(n) : n)
      }} />
  )
}
