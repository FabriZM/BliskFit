import { SIDED, STANDARD_MEASUREMENTS, parseMeasurementType } from '../../lib/body'

type T = (k: string, o?: { defaultValue: string }) => string

/** "waist" -> Waist, "biceps_l" -> Biceps (L); custom names are shown as typed. */
export function measurementLabel(type: string, t: T): string {
  const { base, side } = parseMeasurementType(type)
  const name = (STANDARD_MEASUREMENTS as readonly string[]).includes(base) ? t(`body.m_${base}`) : base
  return side ? `${name} (${t(side === 'l' ? 'body.leftShort' : 'body.rightShort')})` : name
}

export const isSidedStandard = (base: string) => SIDED.has(base)
