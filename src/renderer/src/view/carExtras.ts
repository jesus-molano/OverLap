/**
 * Cells the standings and the relative share for a car's stint, tyres and laps, so both widgets
 * write them alike. Pure; words from the dictionary `m`.
 */
import { formatGained, formatLapTime, signAt } from '@shared/format'
import type { Messages } from '@shared/i18n'
import type { StandingsRow } from '@shared/types'
import { tyreLetter } from '@shared/tyres'
import type { IconName } from '@renderer/ui/icons'

/** Drawn for a tyre compound nobody can name (another car model, or not reported). */
export const TYRE_UNKNOWN = '—'

const NO_STINT = Object.freeze({ text: '', unit: '' })

/**
 * A stint as its lap count and unit ('7' + 'v'), drawn apart so the unit can be small; both ''
 * when unknown.
 */
export function stintCell(
  laps: number | null,
  m: Messages
): { readonly text: string; readonly unit: string } {
  if (laps === null || !Number.isFinite(laps) || laps < 0) return NO_STINT
  return { text: String(Math.floor(laps)), unit: m.widgets.laps.unit }
}

/** The compound's letter ('H', 'W'), TYRE_UNKNOWN when there is no name. */
export function tyreCell(name: string | null): string {
  return tyreLetter(name) || TYRE_UNKNOWN
}

/** 'best' = fastest of the class (purple plate), 'pb' = the driver's own best (green key). */
export type LapKind = 'normal' | 'pb' | 'best' | 'none'

/** What the «Última vuelta» cell reads of a row (a standings row, or a relative one). */
export type LapFields = Pick<StandingsRow, 'lastLap' | 'lastLapKind' | 'bestLap'> & {
  readonly classPosition: number | null
}

/**
 * The «Última vuelta» column. Race: the last lap and its kind. Elsewhere: the best lap, filled
 * for the class's best (its first place: outside races the order is by best lap).
 */
export function lapCell(row: LapFields, race: boolean): { text: string; kind: LapKind } {
  if (!race) {
    const text = formatLapTime(row.bestLap)
    if (text === '—') return { text, kind: 'none' }
    return { text, kind: row.classPosition === 1 ? 'best' : 'normal' }
  }
  const text = formatLapTime(row.lastLap)
  if (text === '—') return { text, kind: 'none' }
  const kind: LapKind =
    row.lastLapKind === 'class-best'
      ? 'best'
      : row.lastLapKind === 'personal-best'
        ? 'pb'
        : 'normal'
  return { text, kind }
}

/** Triangle in front of the positions gained (up: gained, down: lost). */
export type GainedIcon = Extract<IconName, 'arrow-up' | 'arrow-down'>

export const NO_GAIN = Object.freeze({ text: '', icon: null })

/**
 * Positions gained since the start: the count without sign ('4', formatGained) and a triangle
 * for its direction. None (rounds to 0) or unknown: an empty cell, no placeholder glyph.
 */
export function gainedCell(n: number | null): {
  readonly text: string
  readonly icon: GainedIcon | null
} {
  const sign = signAt(n, 0)
  if (sign === null || sign === 0) return NO_GAIN
  return { text: formatGained(n), icon: sign > 0 ? 'arrow-up' : 'arrow-down' }
}
