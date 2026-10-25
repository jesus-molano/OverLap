/**
 * Signed lap-fraction distance from `fromPct` to `toPct`, wrapped across the
 * start/finish line into [-0.5, 0.5]: positive = `toPct` is ahead.
 * Matches irDashies: exactly +0.5 counts as ahead, exactly -0.5 as behind.
 */
export function wrapPctDelta(toPct: number, fromPct: number): number {
  let d = toPct - fromPct
  if (d > 0.5) d -= 1
  else if (d < -0.5) d += 1
  return d
}

/** CarIdxLapDistPct is -1 (or garbage) for cars that are not in the world. */
export function isValidPct(pct: number | undefined): pct is number {
  return typeof pct === 'number' && Number.isFinite(pct) && pct >= 0 && pct <= 1
}
