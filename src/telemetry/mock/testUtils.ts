/** Helpers for the mock's tests (not used by the app). */
import type { TelemetryFrame } from '@shared/telemetry'

/** Element `i`, failing the test when it is missing. */
export function at<T>(arr: readonly T[], i: number): T {
  const v = arr[i]
  if (v === undefined) throw new Error(`index ${i} out of range`)
  return v
}

/** Anything that steps like a MockRace or a MockSeries. */
export interface Steppable {
  step(dtS: number): void
  frame(): TelemetryFrame
}

/** Steps `sim` for `seconds` at `dtS`, calling `onFrame` with each frame and the seconds run. */
export function run(
  sim: Steppable,
  seconds: number,
  dtS: number,
  onFrame?: (f: TelemetryFrame, t: number) => void
): void {
  const steps = Math.round(seconds / dtS)
  for (let s = 1; s <= steps; s++) {
    sim.step(dtS)
    onFrame?.(sim.frame(), s * dtS)
  }
}

/** CarIdxLapCompleted + CarIdxLapDistPct. */
export function raceDist(f: TelemetryFrame, i: number): number {
  return at(f.CarIdxLapCompleted, i) + at(f.CarIdxLapDistPct, i)
}
