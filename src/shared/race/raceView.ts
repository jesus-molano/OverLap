/**
 * Read-only view of the race state that the RaceModel (raceModel.ts) builds
 * from every 60 Hz tick. Providers (standings, battle, ...) read it through
 * `ProviderContext.race`; only the telemetry loop feeds the model.
 *
 * Timing works like real timing loops: the lap is split into RACE_TIMING_LINES
 * virtual lines; for every car the model records the SessionTime at which it
 * crosses each line (interpolated inside the tick, ~10 ms resolution). The gap
 * between two cars is the difference of their crossing times of the same line
 * on the same lap. That follows actual pace, unlike CarIdxEstTime (based on the
 * class reference lap).
 */

/** Virtual timing lines per lap (one every 1 % of the lap). */
export const RACE_TIMING_LINES = 100

/** One lap as timed by the model at the S/F line. */
export interface LapRecord {
  /** CarIdxLapCompleted after the lap (the lap number that was completed). */
  readonly lap: number
  /** Seconds. */
  readonly time: number
  /**
   * False when the lap is not representative: it touched pit road, ran under
   * caution, left the track (an off-track excursion, which iRacing may have
   * invalidated), stopped on track (RaceCarState.stoppedForS), was the first
   * racing lap, the car was towed/teleported, or the model started mid-lap.
   */
  readonly clean: boolean
}

export interface RaceCarState {
  readonly carIdx: number
  /** Continuous race distance in laps (CarIdxLapCompleted + CarIdxLapDistPct); NaN when not in world. */
  readonly distance: number
  /**
   * 1-based position within the class by race distance in races, by best lap
   * otherwise. A change must hold for 0.5 s before it shows (no flicker at the
   * S/F line). 0 when not classified (never seen in world this session).
   */
  readonly classPosition: number
  /** Same, over all classes. */
  readonly overallPosition: number
  /** In the world right now (CarIdxTrackSurface !== NotInWorld and valid pct). */
  readonly inWorld: boolean
  /** On pit road or in the pit stall. */
  readonly inPits: boolean
  readonly offTrack: boolean
  /**
   * Not in world for > 10 s after having been in it during a race
   * (disconnected/retired). Never true for a car that already finished.
   */
  readonly disconnected: boolean
  /**
   * Took the chequered flag (from the crossing times, robust to the
   * SessionState change arriving a tick early or late). Its gaps, position and
   * last lap are frozen at the finish line.
   */
  readonly finished: boolean
  /** Pit-road entries during Racing (a pit-lane start is not a stop). */
  readonly pitStops: number
  /** CarIdxLapCompleted when it last left pit road during Racing, null when never. */
  readonly lastPitLap: number | null
  /** On the first lap after a pit exit. */
  readonly outLap: boolean
  /**
   * Laps completed since the last pit exit (or since the start; joined mid-race, stops before
   * that are unknown). Outside races, since the car was first seen or left the pits.
   */
  readonly stintLaps: number
  /** Last lap time (model-timed, falling back to CarIdxLastLapTime), seconds, null when none. */
  readonly lastLapTime: number | null
  /** Best lap this session (CarIdxBestLapTime when > 0, else model-timed), null when none. */
  readonly bestLapTime: number | null
  /** Up to the last 10 laps, most recent first. */
  readonly laps: readonly LapRecord[]
  /**
   * Seconds per lap at the car's current pace: average of its last clean laps,
   * falling back to its class est lap time, then its best lap; null when none
   * is known. The same estimate lapsRemaining() uses.
   */
  readonly pace: number | null
  /** Current speed in laps per second (smoothed over ~0.5 s); 0 when not in world. */
  readonly speed: number
  /**
   * Seconds the car has been crawling (speed below ~15 % of its pace) while
   * in the world and not in the pits; 0 when moving normally.
   */
  readonly stoppedForS: number
  /** CarIdxSessionFlags of the last tick. */
  readonly sessionFlags: number
}

export interface RaceView {
  /** SessionTime of the last tick (s). */
  readonly sessionTime: number
  /** Changes when the model reset itself (new SubSessionID/SessionNum or reconnect). */
  readonly sessionKey: string
  /** Race session (type /race/i) and SessionState >= Racing. */
  readonly racing: boolean
  /** The player's CarIdx (telemetry PlayerCarIdx, falling back to DriverCarIdx), -1 when unknown. */
  readonly playerCarIdx: number

  /** State of one car, undefined when it was never seen this session or is not a classified entry. */
  car(carIdx: number): RaceCarState | undefined
  /** Every classified car (excludes pace car and spectators), unordered. */
  cars(): readonly RaceCarState[]

  /**
   * Seconds `behind` trails `ahead` at the last timing line `behind` crossed
   * (difference of their crossing times of that line on the same lap). Null
   * when `ahead` has no crossing of that line+lap in the history (e.g. it is
   * several laps ahead, or history is too short). Negative when `behind` is
   * actually ahead.
   */
  timeGap(behind: number, ahead: number): number | null
  /** Whole laps `behind` trails `ahead` by race distance (floor of the distance difference, >= 0). */
  lapsBehind(behind: number, ahead: number): number
  /**
   * Gap samples of timeGap(behind, ahead) at each line crossed during the last
   * `laps` laps (oldest first), each with the fractional race distance of
   * `behind` at that line. Samples where either car was on pit road or under a
   * caution are flagged unclean. Used for trends (least squares).
   */
  gapHistory(
    behind: number,
    ahead: number,
    laps: number
  ): readonly { distance: number; gap: number; clean: boolean }[]
  /**
   * Time each car took over each sector of its last completed lap (sector
   * boundaries from SessionMeta.sectorStarts, snapped to timing lines), null
   * when unknown.
   */
  lastLapSectors(carIdx: number): readonly number[] | null
  /** Sector times of one completed lap (CarIdxLapCompleted after it), null when not in history. */
  lapSectors(carIdx: number, lap: number): readonly number[] | null

  /**
   * Laps the car still has to complete including the current one (estimated
   * from the overall leader's pace in timed races, from SessionLapsRemainEx and
   * laps down otherwise); null when unknown.
   */
  lapsRemaining(carIdx: number): number | null
  /**
   * The car's lap in progress: the lap number being driven (CarIdxLapCompleted
   * + 1) and the seconds since it crossed the S/F line; null when unknown
   * (not in world, or the model joined mid-lap and has not seen a crossing).
   */
  currentLap(carIdx: number): { lap: number; elapsedS: number } | null
  /**
   * Elapsed-time profile of a completed lap: RACE_TIMING_LINES + 1 cumulative
   * seconds from its start (profile[0] = 0, last = lap time), one per timing
   * line. `which` = 'best': the car's best clean lap of this session (kept
   * after it leaves the 5-lap history); 'last': its last completed lap.
   */
  lapProfile(
    carIdx: number,
    which: 'best' | 'last'
  ): { lap: number; lapTime: number; clean: boolean; profile: readonly number[] } | null
  /** Seconds left in a timed session, null otherwise. */
  readonly timeRemainingS: number | null

  /**
   * Laps the player drove this session (fractional; only while the player is
   * driving: IsOnTrack, not a teammate; tows/teleports excluded), for SR
   * corners. Not lost on a reconnect to the same session. When the model starts
   * mid-session it is seeded once from the player's laps completed (from lap 1,
   * not in team races), so it spans the same stretch as PlayerCarMyIncidentCount.
   */
  readonly playerDistanceDriven: number
  /** PlayerCarMyIncidentCount of the last tick (0 when unknown). */
  readonly playerIncidents: number
}
