import { describe, expect, it } from 'vitest'
import { messagesFor } from '@shared/i18n'
import { choiceOptions } from './choice'
import {
  densityChoices,
  densityChoicesInherit,
  nameExample,
  nameFormatChoices,
  nameFormatChoicesInherit
} from './choices'

const es = messagesFor('es')
const en = messagesFor('en')

describe('name format choices', () => {
  it('offers every format with an example as hint', () => {
    const choices = nameFormatChoices(es)
    expect(choices.map((c) => c.value)).toEqual(['full', 'abbr', 'surname', 'tv'])
    expect(choices.map((c) => c.label)).toEqual(['Completo', 'Abreviado', 'Apellido', 'TV'])
    expect(choices.map((c) => c.hint)).toEqual([
      'Pierre-Étienne Duvalier',
      'P. Duvalier',
      'Duvalier',
      'DUV'
    ])
  })

  it('labels "inherit" with the global format', () => {
    const choices = nameFormatChoicesInherit(es, 'surname')
    expect(choices[0]).toMatchObject({
      value: 'inherit',
      label: 'Global (Apellido)',
      hint: 'El de Apariencia'
    })
    expect(choices).toHaveLength(5)
    expect(densityChoicesInherit(es, 'compact')[0]!.label).toBe('Global (Compacta)')
  })

  it('shows what a format does to a sample name', () => {
    expect(nameExample(es, 'abbr')).toBe('Ejemplo: Pierre-Étienne Duvalier se ve «P. Duvalier»')
  })

  it('speaks English with the English dictionary', () => {
    expect(nameFormatChoices(en).map((c) => c.label)).toEqual([
      'Full',
      'Abbreviated',
      'Surname',
      'TV'
    ])
    expect(nameFormatChoicesInherit(en, 'surname')[0]!.label).toBe('Global (Surname)')
    expect(densityChoices(en).map((c) => c.label)).toEqual(['Comfortable', 'Compact'])
    expect(densityChoicesInherit(en, 'compact')[0]!.label).toBe('Global (Compact)')
    expect(nameExample(en, 'tv')).toBe('Example: Pierre-Étienne Duvalier shows as “DUV”')
  })
})

describe('choiceOptions', () => {
  it('words the values in order and leaves out missing hints', () => {
    const options = choiceOptions(['on', 'off'] as const, {
      off: { label: 'Fijo' },
      on: { label: 'Automático', hint: 'Crece' }
    })
    expect(options).toEqual([
      { value: 'on', label: 'Automático', hint: 'Crece' },
      { value: 'off', label: 'Fijo' }
    ])
    expect('hint' in options[1]!).toBe(false)
  })

  it('words the density choices in Spanish by default', () => {
    expect(densityChoices(es)).toEqual([
      { value: 'comfortable', label: 'Cómoda', hint: 'Filas más holgadas' },
      { value: 'compact', label: 'Compacta', hint: 'Filas más juntas' }
    ])
  })
})
