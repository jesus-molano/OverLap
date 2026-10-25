/**
 * The player's incidents in the mock, the way iRacing shows them: each timeline incident
 * (MOCK_TIMELINE.playerIncidents) raises PlayerCarMyIncidentCount (the team's count with it:
 * a solo car), reports its type in PlayerIncidents for a moment and puts the car on a surface
 * off the asphalt while it is off track:
 * - 1 point: an off-track onto the grass;
 * - 2 points: an off-track into the gravel, upgraded a moment later to a loss of control
 *   (1x, then 1x more: iRacing keeps the worse of the two);
 * - 4 points: a car contact; anything else: a rise with no report.
 * Live frames only (screen.ts plays a replay in MockSource). Deterministic: the same timeline
 * gives the same frames.
 */
import {
  IncidentPenalty,
  IncidentReport,
  TrackMaterial,
  encodeIncident
} from '@shared/incidents/decode'
import type { MockVars } from './frameBuffer'

/**
 * WeekendInfo.WeekendOptions incident limits of the mock session, as js-yaml reads them: a
 * penalty at 17x and every 8x after it, the DQ at 25x (a real session may say 'unlimited').
 */
export const MOCK_INCIDENT_LIMITS = Object.freeze({
  IncidentLimit: 25,
  IncidentWarningInitialLimit: 17,
  IncidentWarningSubsequentLimit: 8
})

/** A report stays in PlayerIncidents this long (s): seen in a frame even when fast-forwarding. */
const REPORT_HOLD_S = 0.4
/** The upgrade of a 2x incident comes this long (s) after its first report. */
const UPGRADE_AFTER_S = 0.8

interface Step {
  /** Seconds since the session started. */
  readonly atS: number
  readonly points: number
  /** PlayerIncidents while it is shown, 0 for a rise without a report. */
  readonly report: number
}

const OFF_TRACK_1X = encodeIncident(IncidentReport.OffTrack, IncidentPenalty.OneX)
const LOSS_OF_CONTROL_2X = encodeIncident(IncidentReport.OutOfControl, IncidentPenalty.TwoX)
const CAR_CONTACT_4X = encodeIncident(IncidentReport.CollisionWithCar, IncidentPenalty.FourX)

/** What `points` at `atS` sends, in order. */
function stepsOf(atS: number, points: number): Step[] {
  if (points === 1) return [{ atS, points: 1, report: OFF_TRACK_1X }]
  if (points === 2) {
    return [
      { atS, points: 1, report: OFF_TRACK_1X },
      { atS: atS + UPGRADE_AFTER_S, points: 1, report: LOSS_OF_CONTROL_2X }
    ]
  }
  if (points === 4) return [{ atS, points: 4, report: CAR_CONTACT_4X }]
  return [{ atS, points: Math.max(0, Math.round(points)), report: 0 }]
}

export class MockPlayerIncidents {
  private count = 0
  private readonly steps: Step[] = []
  private report = 0
  private reportUntilS = -Infinity
  /** irsdk_TrkSurf under the car while it is off track (the last incident's). */
  private offMaterial: number = TrackMaterial.Grass1

  /** A timeline incident of `points` at `atS` (seconds since the session started). */
  add(atS: number, points: number): void {
    this.steps.push(...stepsOf(atS, points))
    this.steps.sort((a, b) => a.atS - b.atS)
    this.offMaterial = points >= 2 ? TrackMaterial.Gravel1 : TrackMaterial.Grass1
  }

  /** Writes the incident variables at `elapsedS`; `offTrack`: the car is off the track now. */
  publish(v: MockVars, elapsedS: number, offTrack: boolean): void {
    let next = this.steps[0]
    while (next !== undefined && next.atS <= elapsedS) {
      this.steps.shift()
      this.count += next.points
      if (next.report !== 0) {
        this.report = next.report
        this.reportUntilS = next.atS + REPORT_HOLD_S
      }
      next = this.steps[0]
    }
    if (elapsedS >= this.reportUntilS) this.report = 0
    v.PlayerCarMyIncidentCount[0] = this.count
    v.PlayerCarTeamIncidentCount[0] = this.count
    v.PlayerIncidents[0] = this.report
    v.PlayerTrackSurfaceMaterial[0] = offTrack ? this.offMaterial : TrackMaterial.Asphalt1
  }
}
