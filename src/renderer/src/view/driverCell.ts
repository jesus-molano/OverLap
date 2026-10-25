/**
 * View model of the driver cell shared by every widget (number, name, iRating, licence), so the
 * same driver reads the same everywhere. Pure; render it with ui/DriverCell.vue.
 */
import type { DriverIdentity } from '@shared/driver'
import { formatIRating, formatLicenseShort } from '@shared/format'
import type { NameFormat } from '@shared/types'
import type { DriverStyles, InlineStyle } from './styles'

/** The payload fields the cell reads (RelativeRow, StandingsRow and BattleOpponent have them). */
export type DriverCellInput = Pick<
  DriverIdentity,
  'carNumber' | 'driverName' | 'classColor' | 'iRating' | 'licString' | 'licColor'
>

export interface DriverCellView {
  /** Car number as painted on the car ('23', '007'); '' when unknown. */
  number: string
  /** Already formatted with the widget's name format. */
  name: string
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
  nameFormat: NameFormat = 'full'
): DriverCellView {
  return {
    number: d.carNumber.trim(),
    name: styles.name(d.driverName, nameFormat),
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
