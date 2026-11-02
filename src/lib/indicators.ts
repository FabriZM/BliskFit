const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d

/** Waist over height (both cm). Under 0.4 is lean, 0.4 to 0.49 healthy, 0.5 to 0.59 raised risk, 0.6 and over high. */
export type WhtrBand = 'lean' | 'healthy' | 'raised' | 'high'

export function whtr(waistCm: number | undefined, heightCm: number | undefined): number | undefined {
  if (!waistCm || !heightCm || waistCm <= 0 || heightCm <= 0) return undefined
  return round(waistCm / heightCm, 2)
}

export function whtrBand(value: number): WhtrBand {
  if (value < 0.4) return 'lean'
  if (value < 0.5) return 'healthy'
  if (value < 0.6) return 'raised'
  return 'high'
}

/** The classic "golden" V-taper: shoulders 1.618 times the waist. */
export const V_TAPER_TARGET = 1.618

/** Shoulder circumference over waist circumference. */
export function shoulderToWaist(shouldersCm: number | undefined, waistCm: number | undefined): number | undefined {
  if (!shouldersCm || !waistCm || shouldersCm <= 0 || waistCm <= 0) return undefined
  return round(shouldersCm / waistCm, 2)
}

export interface LeanMass { leanKg: number; fatKg: number; ffmi: number }

/** Lean and fat mass from weight and body fat %, and the fat-free mass index (lean kg over height in m squared). */
export function leanMass(weightKg: number | undefined, bodyFatPct: number | undefined, heightCm: number | undefined): LeanMass | undefined {
  if (!weightKg || !heightCm || bodyFatPct === undefined || weightKg <= 0 || heightCm <= 0 || bodyFatPct < 0 || bodyFatPct >= 100) return undefined
  const fat = (weightKg * bodyFatPct) / 100
  const lean = weightKg - fat
  return { leanKg: round(lean, 1), fatKg: round(fat, 1), ffmi: round(lean / (heightCm / 100) ** 2, 1) }
}
