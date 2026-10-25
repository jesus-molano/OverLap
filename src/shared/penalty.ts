/** The per-car flag badge of the standings and the relative, from CarIdxSessionFlags. Pure. */
import { SessionFlag } from './flags'
import type { CarPenalty } from './types'

/**
 * The most serious per-car flag: black (or disqualified), meatball, then the furled black
 * flag (a warning); null for none. Bit fields arrive as signed Int32: normalised first.
 */
export function penaltyOf(flags: number | undefined): CarPenalty | null {
  if (flags === undefined || !Number.isFinite(flags)) return null
  const f = flags >>> 0
  if (f & (SessionFlag.Black | SessionFlag.Disqualify)) return 'black'
  if (f & SessionFlag.Repair) return 'meatball'
  if (f & SessionFlag.Furled) return 'furled'
  return null
}
