import { useEffect, useState } from 'react'

/** Integer input that lets the field be empty/mid-edit and only commits valid values. */
export default function NumInput({ value, onCommit, min = 0, max = 999, placeholder, label, allowEmpty = false }: {
  value: number | undefined
  onCommit: (v: number | undefined) => void
  min?: number; max?: number; placeholder?: string; label: string; allowEmpty?: boolean
}) {
  const [text, setText] = useState(value?.toString() ?? '')
  useEffect(() => setText(value?.toString() ?? ''), [value])
  return (
    <input className="num" type="text" inputMode="numeric" aria-label={label} placeholder={placeholder} value={text}
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, '')
        setText(v)
        if (v === '') { if (allowEmpty) onCommit(undefined); return }
        const n = Number(v)
        if (n >= min && n <= max) onCommit(n)
      }}
      onBlur={() => setText(value?.toString() ?? '')} />
  )
}
