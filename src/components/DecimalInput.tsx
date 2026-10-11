import { useEffect, useState } from 'react'
import { formatNum, parseDecimal } from '../lib/units'

/** Number field that tolerates mid-edit text ("82.", ",5") and only commits parsed values. */
export default function DecimalInput({ value, onCommit, placeholder, label, integer = false }: {
  value: number | undefined
  onCommit: (v: number | undefined) => void
  placeholder?: string
  label: string
  integer?: boolean
}) {
  const [text, setText] = useState(value === undefined ? '' : formatNum(value))
  useEffect(() => {
    if (parseDecimal(text) !== value) setText(value === undefined ? '' : formatNum(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only resync when the stored value changes
  }, [value])
  return (
    <input className="num wide-num" type="text" inputMode={integer ? 'numeric' : 'decimal'} aria-label={label}
      placeholder={placeholder} value={text}
      onChange={(e) => {
        const v = e.target.value.replace(integer ? /[^\d]/g : /[^\d.,]/g, '')
        setText(v)
        if (v === '') return onCommit(undefined)
        const n = parseDecimal(v)
        if (n !== undefined) onCommit(integer ? Math.round(n) : n)
      }} />
  )
}
