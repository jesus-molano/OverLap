/**
 * '10 VUELTAS' / '5 VUELTAS', for the alerts widget: shown for a few seconds when your laps to go
 * reach each mark, once per session. iRacing's own TenToGo/FiveToGo bits are not relied on (it
 * seems never to set them); the count is the RaceModel's: SessionLapsRemainEx in lap races (your
 * own laps, so one less when you are lapped), its estimate from the clock in timed ones. Pure.
 */

export const LAPS_TO_GO = {
  /** Marks, largest first. */
  marks: [10, 5],
  /** Shown at least this long (s of SessionTime) after the mark is reached. */
  showS: 6
} as const

/**
 * One per alerts provider. update() at every compute; resume() after a gap in the computes (the
 * marks already shown stay shown); reset() for a new session.
 */
export class LapsToGo {
  /** Laps to go at the last compute, NaN when unknown: only a change from a known count fires. */
  private prev = Number.NaN
  private readonly fired = new Set<number>()
  private laps = 0
  private since = Number.NaN

  resume(): void {
    this.prev = Number.NaN
    this.since = Number.NaN
  }

  reset(): void {
    this.resume()
    this.fired.clear()
  }

  /**
   * `left`: laps you still have to complete including the one you are on (RaceView
   * lapsRemaining), null when unknown or not racing. Returns the mark to show now, or null.
   */
  update(now: number, left: number | null, showS: number = LAPS_TO_GO.showS): number | null {
    if (left !== null && Number.isFinite(left)) {
      const n = Math.ceil(left - 1e-6)
      let hit = 0
      for (const mark of LAPS_TO_GO.marks) {
        // Reached now (a jump over a mark counts it as passed, without showing it).
        if (!(this.prev > mark && n <= mark) || this.fired.has(mark)) continue
        this.fired.add(mark)
        hit = mark
      }
      if (hit > 0 && n >= 1) {
        this.laps = hit
        this.since = now
      }
      this.prev = n
    }
    return now - this.since < showS ? this.laps : null
  }
}
