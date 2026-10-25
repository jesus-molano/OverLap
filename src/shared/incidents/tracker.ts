/**
 * IncidentTracker: your incidents as they happen, from every 60 Hz tick (a PlayerIncidents
 * report may last a single tick). A rise of PlayerCarMyIncidentCount opens an incident; rises
 * within INCIDENTS.groupS of the last one are the same incident (iRacing upgrades an off-track
 * to a loss of control, or 2x to 4x, a moment later). Each incident takes its type from the
 * PlayerIncidents reports seen around it (the most serious wins, INCIDENT_SEVERITY: the penalty
 * byte is not the points), the lap and sector from the RaceView and the furthest surface off the
 * asphalt seen around it.
 *
 * Nothing counts while a replay plays, in the first second of a session or connection, or
 * when the clock goes back: the count is only followed then. Never anyone else's incidents:
 * iRacing has none (AI and results read 0). O(1) per tick, no allocation but per incident.
 */
import { frac } from '../num'
import type { RaceView } from '../race/raceView'
import { resolvePlayerCarIdx } from '../sessionInfo'
import type { TelemetryFrame } from '../telemetry'
import { sectorOf } from '../traffic'
import type { IncidentKind, IncidentSurface, SessionMeta } from '../types'
import { countOf } from './count'
import {
  INCIDENT_SEVERITY,
  SURFACE_RANK,
  decodeIncident,
  incidentBits,
  incidentSurface
} from './decode'
import type { DecodedIncident } from './decode'

export const INCIDENTS = {
  /** Rises this close (s after the last one) are one incident. */
  groupS: 2,
  /** A report this long (s) before a rise, or after the last one, belongs to that incident. */
  reportWindowS: 2,
  /** A surface seen this long (s) before or after the first rise is where it happened. */
  surfaceWindowS: 1.5,
  /** After a (re)start or a replay, rises in this long (s) are the count catching up. */
  settleS: 1,
  /** SessionTime going back more than this (s): a replay or a restarted session. */
  backwardS: 1
} as const

/** One incident: the rises of your count grouped. */
export interface IncidentEvent {
  /** Points it added, every rise of the group. */
  readonly points: number
  /** The report's type, null when PlayerIncidents reported nothing around it. */
  readonly kind: IncidentKind | null
  readonly lap: number | null
  readonly sector: number | null
  readonly surface: IncidentSurface | null
  /** SessionTime of the first and of the last rise. */
  readonly startT: number
  readonly lastT: number
}

interface OpenEvent {
  points: number
  /** The most serious report taken so far (null: none yet, so any report names it). */
  kind: IncidentKind | null
  lap: number | null
  sector: number | null
  surface: IncidentSurface | null
  startT: number
  lastT: number
}

const SURFACES = Object.keys(SURFACE_RANK) as IncidentSurface[]

export class IncidentTracker {
  /** The count every rise is measured from; null until a value is seen. */
  private baseline: number | null = null
  /** Rises before this SessionTime are absorbed (start, replay). */
  private settleUntil = -Infinity
  private lastT = Number.NaN
  /**
   * PlayerIncidents last tick: a report is a change to a value that reports something (null
   * before the first tick: a value that never changed since may be an old incident's).
   */
  private lastBits: number | null = null
  /** A report not taken by any incident yet, and when it came. */
  private pending: DecodedIncident | null = null
  private pendingT = Number.NaN
  /** SessionTime each off-track surface was last under the car. */
  private readonly surfaceSeen = new Map<IncidentSurface, number>()
  private event: OpenEvent | null = null

  /** Your last incident this session (the alerts decide how long to show it), null before any. */
  get latest(): IncidentEvent | null {
    return this.event
  }

  /** New session or connection: nothing seen so far is compared with what comes. */
  reset(): void {
    this.baseline = null
    this.settleUntil = -Infinity
    this.lastT = Number.NaN
    this.lastBits = null
    this.pending = null
    this.pendingT = Number.NaN
    this.surfaceSeen.clear()
    this.event = null
  }

  observe(frame: TelemetryFrame, session: SessionMeta, race: RaceView): void {
    const t = frame.SessionTime[0]
    if (t === undefined || !Number.isFinite(t)) return
    if (t < this.lastT - INCIDENTS.backwardS) this.reset()
    this.lastT = t
    const count = countOf(frame.PlayerCarMyIncidentCount[0])
    const bits = incidentBits(frame.PlayerIncidents[0])

    if (frame.IsReplayPlaying[0] === true) {
      // Follow the report without counting. The count and the clock are the replay's (often
      // earlier and lower than live), so neither is kept: the first live tick is a new baseline
      // and settles from the live SessionTime.
      this.baseline = null
      this.settleUntil = -Infinity
      this.lastBits = bits
      this.pending = null
      return
    }

    this.watchReport(bits, t)
    this.watchSurface(frame.PlayerTrackSurfaceMaterial[0], t)
    if (count === null) return
    if (this.baseline === null) this.settleUntil = Math.max(this.settleUntil, t + INCIDENTS.settleS)
    // The first value, a lower one (the sim started a new count) or the count still settling.
    if (this.baseline === null || count < this.baseline || t < this.settleUntil) {
      if (count !== this.baseline) this.pending = null
      this.baseline = count
      return
    }
    if (count === this.baseline) return
    const rise = count - this.baseline
    this.baseline = count
    const ev = this.event
    if (ev !== null && t - ev.lastT <= INCIDENTS.groupS) {
      ev.points += rise
      ev.lastT = t
      return
    }
    this.open(rise, t, frame, session, race)
  }

  private open(
    points: number,
    t: number,
    frame: TelemetryFrame,
    session: SessionMeta,
    race: RaceView
  ): void {
    const { lap, sector } = whereNow(frame, session, race)
    const ev: OpenEvent = {
      points,
      kind: null,
      lap,
      sector,
      surface: this.surfaceSince(t - INCIDENTS.surfaceWindowS),
      startT: t,
      lastT: t
    }
    if (this.pending !== null && t - this.pendingT <= INCIDENTS.reportWindowS) {
      take(ev, this.pending)
    }
    this.pending = null
    this.event = ev
  }

  /** A change of PlayerIncidents to a report goes to the open incident, or waits for one. */
  private watchReport(bits: number, t: number): void {
    if (bits === this.lastBits) return
    const first = this.lastBits === null
    this.lastBits = bits
    if (first) return
    const report = decodeIncident(bits)
    if (report === null) return
    const ev = this.event
    if (ev !== null && t - ev.lastT <= INCIDENTS.reportWindowS) {
      take(ev, report)
      return
    }
    // Two reports before the count rises (an off-track, then the wall): the worst waits.
    const waiting = this.pending
    if (
      waiting !== null &&
      t - this.pendingT <= INCIDENTS.reportWindowS &&
      INCIDENT_SEVERITY[waiting.kind] > INCIDENT_SEVERITY[report.kind]
    ) {
      return
    }
    this.pending = report
    this.pendingT = t
  }

  private watchSurface(material: number | undefined, t: number): void {
    const surface = incidentSurface(material)
    if (surface === null) return
    this.surfaceSeen.set(surface, t)
    // The car often reaches the gravel after the count went up (the spin is reported first).
    const ev = this.event
    if (ev === null || t - ev.startT > INCIDENTS.surfaceWindowS) return
    if (ev.surface === null || SURFACE_RANK[surface] > SURFACE_RANK[ev.surface]) {
      ev.surface = surface
    }
  }

  /** The furthest off-track surface under the car since `from`, null when none. */
  private surfaceSince(from: number): IncidentSurface | null {
    let best: IncidentSurface | null = null
    for (const s of SURFACES) {
      const seen = this.surfaceSeen.get(s)
      if (seen === undefined || seen < from) continue
      if (best === null || SURFACE_RANK[s] > SURFACE_RANK[best]) best = s
    }
    return best
  }
}

/**
 * The most serious report names the incident (INCIDENT_SEVERITY; a later one as serious wins):
 * an off-track that ends in the wall is a wall hit, whatever each report's penalty byte says.
 */
function take(ev: OpenEvent, report: DecodedIncident): void {
  if (ev.kind !== null && INCIDENT_SEVERITY[report.kind] < INCIDENT_SEVERITY[ev.kind]) return
  ev.kind = report.kind
}

/** The lap you are on and the sector, from the race model (the frame when it has no car). */
function whereNow(
  frame: TelemetryFrame,
  session: SessionMeta,
  race: RaceView
): { lap: number | null; sector: number | null } {
  const idx = race.playerCarIdx >= 0 ? race.playerCarIdx : resolvePlayerCarIdx(frame, session)
  if (idx < 0) return { lap: null, sector: null }
  let distance = race.car(idx)?.distance ?? Number.NaN
  if (!Number.isFinite(distance)) {
    const completed = frame.CarIdxLapCompleted[idx]
    const pct = frame.CarIdxLapDistPct[idx]
    if (completed !== undefined && pct !== undefined && pct >= 0 && pct <= 1) {
      distance = completed + pct
    }
  }
  if (!Number.isFinite(distance)) return { lap: null, sector: null }
  const lap = Math.floor(distance) + 1
  return { lap: lap >= 1 ? lap : null, sector: sectorOf(frac(distance), session.sectorStarts) }
}
