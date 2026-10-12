import { describe, expect, it } from 'vitest'
import i18n from 'i18next'
import en from '../i18n/en.json'
import es from '../i18n/es.json'
import type { Exercise } from '../db/types'
import { describeExercise } from './describe'

await i18n.init({ resources: { en: { translation: en }, es: { translation: es } }, lng: 'en', interpolation: { escapeValue: false } })

const ex: Exercise = {
  id: '1', name: 'Bench', trackingType: 'weight_reps', mechanic: 'compound',
  primaryMuscleIds: ['m:chest'], secondaryMuscleIds: ['m:triceps', 'm:shoulders'], source: 'seeded',
}
const muscle = (lng: string) => (id: string) => i18n.t(`muscles.${id.slice(2)}`, { lng })

describe('describeExercise', () => {
  it('builds a sentence from mechanic and muscles', () => {
    expect(describeExercise(ex, muscle('en'), i18n.getFixedT('en'), 'en'))
      .toBe('A compound movement for the chest. Also works the triceps and shoulders.')
    expect(describeExercise(ex, muscle('es'), i18n.getFixedT('es'), 'es'))
      .toBe('Movimiento compuesto que trabaja pecho. También involucra tríceps y hombros.')
  })

  it("prefers the user's own description", () => {
    expect(describeExercise({ ...ex, description: ' Mine ' }, muscle('en'), i18n.getFixedT('en'), 'en')).toBe('Mine')
  })
})
