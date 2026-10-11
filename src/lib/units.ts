import type { Units } from '../db/types'

const LB_PER_KG = 2.2046226218
const round1 = (n: number) => Math.round(n * 10) / 10

/** Weights are stored in kg; these convert at the UI edge. */
export const kgToDisplay = (kg: number, units: Units): number => round1(units === 'kg' ? kg : kg * LB_PER_KG)
export const displayToKg = (v: number, units: Units): number => (units === 'kg' ? v : v / LB_PER_KG)

/** Accepts "82,5" and "82.5"; returns undefined for anything that isn't a non-negative number. */
export function parseDecimal(text: string): number | undefined {
  const t = text.trim().replace(',', '.')
  if (t === '' || !/^\d*\.?\d*$/.test(t) || t === '.') return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

export const formatNum = (n: number): string => (Number.isInteger(n) ? String(n) : String(round1(n)))

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? h + ':' : ''}${mm}:${String(s).padStart(2, '0')}`
}
