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

export type Sex = 'male' | 'female'

/** Waist over hips. The WHO flags abdominal obesity from 0.90 in men and 0.85 in women. */
export const WHR_LIMIT: Record<Sex, number> = { male: 0.9, female: 0.85 }

export function whr(waistCm: number | undefined, hipsCm: number | undefined): number | undefined {
  if (!waistCm || !hipsCm || waistCm <= 0 || hipsCm <= 0) return undefined
  return round(waistCm / hipsCm, 2)
}

export const whrRaised = (value: number, sex: Sex): boolean => value >= WHR_LIMIT[sex]

/**
 * US Navy body fat estimate (%) from tape measurements in cm: waist, neck and height, plus hips for women.
 * Accurate to about 3 to 4 points; undefined for inputs outside what the formula handles.
 */
export function navyBodyFat(sex: Sex, heightCm: number | undefined, waistCm: number | undefined, neckCm: number | undefined, hipsCm?: number): number | undefined {
  if (!heightCm || !waistCm || !neckCm) return undefined
  let pct: number
  if (sex === 'male') {
    if (waistCm <= neckCm) return undefined
    pct = 495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450
  } else {
    if (!hipsCm || waistCm + hipsCm <= neckCm) return undefined
    pct = 495 / (1.29579 - 0.35004 * Math.log10(waistCm + hipsCm - neckCm) + 0.221 * Math.log10(heightCm)) - 450
  }
  return Number.isFinite(pct) && pct >= 2 && pct <= 60 ? round(pct, 1) : undefined
}

/** Resting energy use (kcal/day), Mifflin-St Jeor. */
export function bmr(sex: Sex, weightKg: number | undefined, heightCm: number | undefined, age: number | undefined): number | undefined {
  if (!weightKg || !heightCm || age === undefined || weightKg <= 0 || heightCm <= 0) return undefined
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161))
}

/** Activity multiplier from the weekly training goal in days: light up to 2, moderate 3 to 5, high 6 or more. */
export const activityFactor = (trainingDays: number): number => (trainingDays <= 2 ? 1.375 : trainingDays <= 5 ? 1.55 : 1.725)

/** Calories to keep weight steady (kcal/day): BMR times the activity factor. */
export const maintenanceKcal = (restingKcal: number, trainingDays: number): number => Math.round((restingKcal * activityFactor(trainingDays)) / 10) * 10
