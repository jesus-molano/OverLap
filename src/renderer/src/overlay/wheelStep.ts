/**
 * The edit-mode mouse wheel, one meaning everywhere ("bigger / smaller"): auto-height widgets
 * step their content scale, free widgets resize around their centre. Pure.
 */

/** At most one step this often, whatever the wheel's resolution. */
export const WHEEL_INTERVAL_MS = 50

/** One wheel notch as a step: up (negative deltaY) is bigger; null without vertical motion. */
export function wheelDirection(deltaY: number): 1 | -1 | null {
  if (deltaY < 0) return 1
  if (deltaY > 0) return -1
  return null
}

/** Rate limit on the events' own timestamps (no timer). */
export interface WheelGate {
  /** True when a step may run at `timeStamp` (ms), which then starts the next interval. */
  accept(timeStamp: number): boolean
}

export function createWheelGate(intervalMs: number = WHEEL_INTERVAL_MS): WheelGate {
  let last = -Infinity
  return {
    accept(timeStamp: number): boolean {
      // A timestamp from before the last step (another time origin) starts over.
      if (timeStamp >= last && timeStamp - last < intervalMs) return false
      last = timeStamp
      return true
    }
  }
}
