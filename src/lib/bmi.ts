/** WHO adult bands: under 18.5 underweight, 18.5 to under 25 healthy, 25 to under 30 overweight, 30 and over obese. */
export type BmiCategory = 'underweight' | 'healthy' | 'overweight' | 'obese'

export const HEALTHY_BMI = { min: 18.5, max: 24.9 }

const round1 = (n: number) => Math.round(n * 10) / 10

/** Body mass index from weight in kg and height in cm; undefined without both. */
export function bmi(kg: number | undefined, cm: number | undefined): number | undefined {
  if (!kg || !cm || kg <= 0 || cm <= 0) return undefined
  const m = cm / 100
  return round1(kg / (m * m))
}

export function bmiCategory(value: number): BmiCategory {
  if (value < 18.5) return 'underweight'
  if (value < 25) return 'healthy'
  if (value < 30) return 'overweight'
  return 'obese'
}

/** The weight (kg) a person of this height has at the given BMI. */
export const weightAtBmi = (value: number, cm: number): number => round1(value * (cm / 100) ** 2)

export interface BmiGoal { bmi: number; kg: number }

/**
 * A suggested goal: the nearest edge of the healthy range (BMI 24.9 from above, 18.5 from below). Undefined when
 * already healthy, or without a height and weight.
 */
export function suggestGoal(currentKg: number | undefined, cm: number | undefined): BmiGoal | undefined {
  const now = bmi(currentKg, cm)
  if (now === undefined || !cm || (now >= HEALTHY_BMI.min && now < 25)) return undefined
  const target = now < HEALTHY_BMI.min ? HEALTHY_BMI.min : HEALTHY_BMI.max
  return { bmi: target, kg: weightAtBmi(target, cm) }
}
