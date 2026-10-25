/**
 * Cells the standings and the relative share for a car's stint and tyres, so both widgets
 * write them alike. Pure; words from the dictionary `m`.
 */
import type { Messages } from '@shared/i18n'
import { tyreLetter } from '@shared/tyres'

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
