/**
 * View model of the driver cell shared by every widget (number, name, iRating, licence), so the
 * same driver reads the same everywhere. Pure; render it with ui/DriverCell.vue.
 */
import type { DriverIdentity } from '@shared/driver'
import { formatIRating, formatLicenseShort, shownDriverName } from '@shared/format'
import type { Messages } from '@shared/i18n'
import type { NameFormat } from '@shared/types'
import type { DriverStyles, InlineStyle } from './styles'

/** The payload fields the cell reads (RelativeRow, StandingsRow and BattleOpponent have them). */
export type DriverCellInput = Pick<
  DriverIdentity,
  'carNumber' | 'driverName' | 'teamName' | 'classColor' | 'iRating' | 'licString' | 'licColor'
>

export interface DriverCellView {
  /** Car number as painted on the car ('23', '007'); '' when unknown. */
  number: string
  /**
   * Already formatted with the widget's name format; the team's name when the driver's own is
   * unknown, 'Piloto #7' when that one is too (shownDriverName).
   */
  name: string
  /** `name` is the 'Piloto #7' placeholder: drawn dim. */
  nameUnknown: boolean
  /** '2.3k', '' when unknown. */
  iRating: string
  /** 'A 4.9', '' when unknown. */
  lic: string
  /** `--lic` / `--lic-fg` / `--lic-soft` / `--lic-ink`, shared per colour. */
  licStyle: InlineStyle
  /** `--cls` / `--cls-fg` / `--cls-ink`, shared per colour. */
  clsStyle: InlineStyle
}

/** '#23' for running text; '' when unknown. */
export function formatCarNumber(n: string): string {
  const t = n.trim()
  return t === '' ? '' : `#${t}`
}

export function toDriverCell(
  d: DriverCellInput,
  styles: DriverStyles,
  nameFormat: NameFormat,
  m: Messages
): DriverCellView {
  const name = shownDriverName(styles.name(d.driverName, nameFormat), d.teamName, d.carNumber, m)
  return {
    number: d.carNumber.trim(),
    name: name.text,
    nameUnknown: name.unknown,
    iRating: formatIRating(d.iRating),
    lic: formatLicenseShort(d.licString),
    licStyle: styles.lic(d.licColor),
    clsStyle: styles.cls(d.classColor)
  }
}

/** Licence class letter(s) and the rest of a short licence: 'A 4.9' -> ['A', '4.9']. */
export function splitLicense(lic: string): readonly [string, string] {
  const t = lic.trim()
  const i = t.search(/\s/)
  return i < 0 ? [t, ''] : [t.slice(0, i), t.slice(i).trim()]
}
