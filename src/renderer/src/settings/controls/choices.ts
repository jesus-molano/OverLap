/** Option lists shared by several settings pages, worded by the dictionary passed in. Pure. */
import type { Messages } from '@shared/i18n'
import { formatDriverName } from '@shared/format'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import type { AppearanceSettings, NameFormat } from '@shared/types'
import { SAMPLE_NAME } from '../samples/sampleData'
import { choiceOptions, type ChoiceOption } from './choice'

type Density = AppearanceSettings['density']

const NAME_FORMATS = OPTION_SCHEMA.appearance.nameFormat.values
const DENSITIES = OPTION_SCHEMA.appearance.density.values

/** Every name format, with what it does to the sample name as hint. */
export function nameFormatChoices(m: Messages): readonly ChoiceOption<NameFormat>[] {
  const labels = m.settings.choices.nameFormat
  return NAME_FORMATS.map((value) => ({
    value,
    label: labels[value],
    hint: formatDriverName(SAMPLE_NAME, value)
  }))
}

/** The same list with 'inherit' first, labelled with what it currently resolves to. */
export function nameFormatChoicesInherit(
  m: Messages,
  global: NameFormat
): readonly ChoiceOption<NameFormat | 'inherit'>[] {
  const c = m.settings.choices
  return [
    { value: 'inherit', label: c.inherit(c.nameFormat[global]), hint: c.nameInheritHint },
    ...nameFormatChoices(m)
  ]
}

export function densityChoices(m: Messages): readonly ChoiceOption<Density>[] {
  return choiceOptions(DENSITIES, m.settings.choices.density)
}

export function densityChoicesInherit(
  m: Messages,
  global: Density
): readonly ChoiceOption<Density | 'inherit'>[] {
  const c = m.settings.choices
  return [
    { value: 'inherit', label: c.inherit(c.density[global].label), hint: c.densityInheritHint },
    ...densityChoices(m)
  ]
}

/** 'Ejemplo: Pierre-Étienne Duvalier → P. Duvalier' for the format a widget ends up using. */
export function nameExample(m: Messages, format: NameFormat): string {
  return m.settings.choices.example(SAMPLE_NAME, formatDriverName(SAMPLE_NAME, format))
}
