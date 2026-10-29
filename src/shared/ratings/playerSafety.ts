/**
 * Your projected safety rating for this session, as the standings' header and the info bars'
 * `safetyRating` item show it. One instance per provider (it caches the projection and, in team
 * races, your own licence). Moved out of the standings provider so both read the same numbers.
 */
import { frac } from '../num'
import type { RaceView } from '../race/raceView'
import type { TelemetryFrame } from '../telemetry'
import type { DriverEntry, SafetyRatingProjection, SessionMeta } from '../types'
import { projectSessionSafetyRating } from './sessionSafety'

interface Licence {
  licLevel: number
  licSubLevel: number
}

export class PlayerSafety {
  private sr: { key: string; result: SafetyRatingProjection | null } | null = null
  /** Team races: the user's own licence, from the last tick they were driving. */
  private ownLicence: Licence | null = null

  reset(): void {
    this.sr = null
    this.ownLicence = null
  }

  /**
   * Incidents (the whole session's PlayerCarMyIncidentCount) over the corners the user drove
   * (the model's distance spans the same stretch). In a race whose laps left are known the
   * budget covers the whole race; in practice nobody knows how much more you will drive, so it
   * is "if you stopped now". Recomputed only when an input changes, so the object stays the same.
   */
  project(
    frame: TelemetryFrame,
    session: SessionMeta,
    race: RaceView,
    playerIdx: number,
    /** Race laps left (the budget's horizon), null outside races or when unknown. */
    lapsLeft: number | null,
    sessionType: string
  ): SafetyRatingProjection | null {
    const driver = session.drivers.get(playerIdx)
    if (!driver) return null
    const lic = this.licenceOf(frame, session, driver)
    const turns = session.trackNumTurns
    const driven = race.playerDistanceDriven
    const corners = turns > 0 && driven > 0 ? Math.floor(turns * driven) : 0
    let totalCorners: number | null = null
    if (turns > 0 && lapsLeft !== null && Number.isFinite(lapsLeft) && lapsLeft >= 0) {
      // lapsLeft counts the lap in progress, whose driven part is already in `driven`.
      const d = race.car(playerIdx)?.distance ?? NaN
      const left = Math.max(0, lapsLeft - (Number.isFinite(d) ? frac(d) : 0))
      totalCorners = Math.floor(turns * (Math.max(0, driven) + left))
    }
    const incidents = race.playerIncidents
    const key = `${lic.licLevel}:${lic.licSubLevel}:${incidents}:${corners}:${totalCorners}:${sessionType}`
    if (this.sr?.key === key) return this.sr.result
    const result = projectSessionSafetyRating({
      licLevel: lic.licLevel,
      licSubLevel: lic.licSubLevel,
      incidents,
      corners,
      totalCorners,
      sessionType
    })
    this.sr = { key, result }
    return result
  }

  /**
   * In team races the entry at the player's CarIdx is whoever drives it now;
   * the SR is the user's, so their licence is taken while IsOnTrack (they are
   * the one in the car) and kept through a teammate's stint.
   */
  private licenceOf(frame: TelemetryFrame, session: SessionMeta, driver: DriverEntry): Licence {
    const current = { licLevel: driver.licLevel, licSubLevel: driver.licSubLevel }
    if (!session.teamRacing) return current
    if (frame.IsOnTrack[0] === true) this.ownLicence = current
    return this.ownLicence ?? current
  }
}
