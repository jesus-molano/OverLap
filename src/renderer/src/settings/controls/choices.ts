/** Option lists shared by several settings pages, worded by the dictionary passed in. Pure. */
import type { Messages } from '@shared/i18n'
import { formatDriverName } from '@shared/format'
import type { BrandMarkMode } from '@shared/carBrands'
import { BRAND_MARK_CHOICES, IRATING_FORMATS, OPTION_SCHEMA } from '@shared/settingsSchema'
import type { AppearanceSettings, IRatingFormat, NameFormat } from '@shared/types'
import { SAMPLE_NAME } from '../samples/sampleData'
import { choiceOptions, toChoice, fromChoice, type BoolChoice, type ChoiceOption } from './choice'

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

/** 'Ejemplo: Pierre-Étienne Duvalier se ve «P. Duvalier»' for the format a widget ends up using. */
export function nameExample(m: Messages, format: NameFormat): string {
  return m.settings.choices.example(SAMPLE_NAME, formatDriverName(SAMPLE_NAME, format))
}

/** A switch that can follow Apariencia's, as a choice: 'inherit', 'on', 'off'. */
export type FlagChoice = 'inherit' | BoolChoice

export const toFlagChoice = (v: boolean | 'inherit'): FlagChoice =>
  v === 'inherit' ? 'inherit' : toChoice(v)
export const fromFlagChoice = (v: FlagChoice): boolean | 'inherit' =>
  v === 'inherit' ? 'inherit' : fromChoice(v)

/** «Global (Sí)», «Sí», «No»: the global labelled with what it is. */
export function flagChoicesInherit(
  m: Messages,
  global: boolean
): readonly ChoiceOption<FlagChoice>[] {
  const c = m.settings.choices
  return [
    {
      value: 'inherit',
      label: c.inherit(c.onOff[toChoice(global)].label),
      hint: c.flagInheritHint
    },
    ...choiceOptions(BOOL_CHOICES, c.onOff)
  ]
}

const BOOL_CHOICES: readonly BoolChoice[] = ['on', 'off']

/**
 * «Sí», «No»: a global of the «Piloto» block in Apariencia, the same control as the widgets' own
 * (flagChoicesInherit) without the «Global» it is.
 */
export function flagChoices(m: Messages): readonly ChoiceOption<BoolChoice>[] {
  return choiceOptions(BOOL_CHOICES, m.settings.choices.onOff)
}

/** The make logo's «Global (Auto)», then Auto / Siempre / Nunca. */
export function brandChoicesInherit(
  m: Messages,
  global: BrandMarkMode
): readonly ChoiceOption<BrandMarkMode | 'inherit'>[] {
  const c = m.settings.choices
  const texts = m.settings.driverCell.brandChoices
  return [
    { value: 'inherit', label: c.inherit(texts[global].label), hint: c.flagInheritHint },
    ...choiceOptions(BRAND_MARK_CHOICES, texts)
  ]
}

/** «2.5k» / «2.520» (request 10): each written as it reads in the current language. */
export function iRatingFormatChoices(m: Messages): readonly ChoiceOption<IRatingFormat>[] {
  return choiceOptions(IRATING_FORMATS, m.settings.driverCell.iRatingFormatChoices)
}

/** The iRating format's «Global (2.5k)», then 2.5k / 2.520. */
export function iRatingFormatChoicesInherit(
  m: Messages,
  global: IRatingFormat
): readonly ChoiceOption<IRatingFormat | 'inherit'>[] {
  const c = m.settings.choices
  const texts = m.settings.driverCell.iRatingFormatChoices
  return [
    { value: 'inherit', label: c.inherit(texts[global].label), hint: c.flagInheritHint },
    ...iRatingFormatChoices(m)
  ]
}
