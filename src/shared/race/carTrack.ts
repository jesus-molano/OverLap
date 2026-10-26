/**
 * Per-car state of the RaceModel: timing-line crossings of the last
 * HISTORY_LAPS laps in ring buffers (allocated once per car slot) plus the
 * bookkeeping behind RaceCarState. Lines are absolute ids:
 * lap * RACE_TIMING_LINES + line, so line 0 of lap L is the S/F crossing that
 * completes lap L.
 */
import { LapCapture } from './profiles'
import type { CurrentLapView } from './profiles'
import { RACE_TIMING_LINES } from './raceView'
import type { LapRecord, RaceCarState } from './raceView'

export const HISTORY_LAPS = 5
export const HISTORY_SIZE = HISTORY_LAPS * RACE_TIMING_LINES
/** Empty ring slot / no crossing yet. */
export const NO_LINE = -0x80000000
/** Crossing flags. */
export const FLAG_PIT = 1
export const FLAG_CAUTION = 2

type Mutable<T> = { -readonly [K in keyof T]: T[K] }
/** RaceCarState as the model writes it; providers only see it read-only. */
export type MutableCarState = Mutable<RaceCarState>
/** LapRecord whose time CarIdxLastLapTime may still refine (official precision). */
export type MutableLapRecord = Mutable<LapRecord>

function slotOf(line: number): number {
  const s = line % HISTORY_SIZE
  return s < 0 ? s + HISTORY_SIZE : s
}

function resetState(s: MutableCarState): void {
  s.distance = NaN
  s.classPosition = 0
  s.overallPosition = 0
  s.inWorld = false
  s.inPits = false
  s.offTrack = false
  s.disconnected = false
  s.finished = false
  s.pitStops = 0
  s.towStops = 0
  s.towed = false
  s.towedAt = NaN
  s.lastPitLap = null
  s.outLap = false
  s.stintLaps = 0
  s.lastLapTime = null
  s.bestLapTime = null
  s.laps = []
  s.pace = null
  s.speed = 0
  s.stoppedForS = 0
  s.sessionFlags = 0
}

export class CarTrack {
  readonly times = new Float64Array(HISTORY_SIZE)
  readonly lines = new Int32Array(HISTORY_SIZE)
  readonly flags = new Uint8Array(HISTORY_SIZE)
  /** Handed out by RaceView.car(); mutated in place. */
  readonly state: MutableCarState

  /** Seen in world this session and still an eligible entry. */
  active = false
  /** Identity of the entry in this slot (entryKey()): a team driver change keeps it. */
  entryKey = ''
  classId = 0
  /** DriverEntry.classEstLapTime (last pace fallback: often well off the real pace), 0 when unknown. */
  estLapTime = 0
  /**
   * Pace fallbacks before the first clean lap, 0 when unknown: the entry's best lap of the
   * event's earlier sessions (qualifying, practice) and the fastest one of its class.
   */
  priorBest = 0
  classPriorBest = 0

  // Movement (effective lap/pct after the S/F wrap fix-up).
  prevValid = false
  prevD = 0
  prevT = 0
  prevPct = 0
  effLap = 0
  /** Last valid distance (kept while out of the world, for ordering). */
  lastD = NaN
  /** Forward progress of this tick beyond the high-water mark (0 on teleports). */
  lastDelta = 0
  /** Highest distance since the last discontinuity (jitter does not count twice). */
  hwD = 0
  /** Highest line counted as crossed since the last discontinuity. */
  hwLine = NO_LINE
  /**
   * Latest recorded crossing in time (frozen at the finish line once finished). After a
   * teleport, the line where the car landed, crossed long ago or never (see jumpT).
   */
  lastLine = NO_LINE
  /**
   * SessionTime of the last tick that did not continue the one before (world entry, tow,
   * reset, jump): a crossing older than this was made before the car got where it is.
   */
  jumpT = -Infinity
  /** SessionTime the lap counter started to disagree with the pct near the line; NaN when not. */
  lapMismatchT = NaN
  /** Whole laps the last tick added without driving them (a lap credited in the box). */
  creditedLaps = 0
  /** The lap in progress saw a teleport, a world exit/entry or started mid-lap. */
  dirty = true
  /** The lap in progress went off track (iRacing invalidates it). */
  lapOffTrack = false
  /** The lap in progress had the car crawling on track (a stop is not its pace). */
  lapStopped = false
  /** Lap number of the last recorded S/F crossing. */
  lastSfLap = NO_LINE
  /** SessionTime of that crossing, NaN when none. */
  lastSfT = NaN
  /** Race: first S/F line crossed under green; the lap starting there is not clean. */
  startSfLine = NO_LINE
  /** The last tick continued the one before (no world entry, teleport or jump). */
  continuous = false

  // Speed and stop detection (motion.ts).
  /** Distance and SessionTime where the speed sample in progress started (spdT NaN: none). */
  spdD = 0
  spdT = NaN
  /** Bias-corrected EMA of the speed samples since the last restart: raw average and weight. */
  spdEma = 0
  spdWeight = 0
  /** state.speed holds a measured value (a sample since the car entered the world). */
  spdKnown = false
  /** Span (s) of the consecutive samples discarded as jumps. */
  spdJumpS = 0
  /** SessionTime of the last in-world tick seen by updateMotion, NaN when none. */
  motionT = NaN

  // Lap times.
  records: MutableLapRecord[] = []
  bestClean = Infinity
  /** Last CarIdxBestLapTime > 0 seen (kept when it drops to -1 on a disconnect). */
  officialBest = Infinity
  /** Latest record waiting for CarIdxLastLapTime to confirm it (official precision). */
  pending: MutableLapRecord | null = null
  officialBefore = -1
  prevOfficial = -1
  confirmUntil = 0

  // Lap profiles (profiles.ts): buffers allocated once per car slot.
  /** The last completed lap, when all its lines were recorded. */
  readonly lastLap = new LapCapture()
  /** The best clean lap of the session (outlives the history). */
  readonly bestLap = new LapCapture()
  /** Last value currentLap() handed out (reused while unchanged). */
  currentView: CurrentLapView | null = null

  // Pits and status.
  pitKnown = false
  /** Race: the car stood still at the green (a standing start): its first lap is timed from it. */
  gridStart = false
  prevOnPit = false
  stintStartLap = NaN
  seenRacing = false
  lastInWorldT = 0
  finishLap = 0
  finishT = 0

  constructor(readonly carIdx: number) {
    this.lines.fill(NO_LINE)
    this.state = {
      carIdx,
      distance: NaN,
      classPosition: 0,
      overallPosition: 0,
      inWorld: false,
      inPits: false,
      offTrack: false,
      disconnected: false,
      finished: false,
      pitStops: 0,
      towStops: 0,
      towed: false,
      towedAt: NaN,
      lastPitLap: null,
      outLap: false,
      stintLaps: 0,
      lastLapTime: null,
      bestLapTime: null,
      laps: [],
      pace: null,
      speed: 0,
      stoppedForS: 0,
      sessionFlags: 0
    }
  }

  /** Forgets everything; keeps the buffers. */
  clear(): void {
    this.lines.fill(NO_LINE)
    this.flags.fill(0)
    resetState(this.state)
    this.active = false
    this.entryKey = ''
    this.classId = 0
    this.estLapTime = 0
    this.priorBest = 0
    this.classPriorBest = 0
    this.prevValid = false
    this.lastD = NaN
    this.lastDelta = 0
    this.hwD = 0
    this.hwLine = NO_LINE
    this.lastLine = NO_LINE
    this.jumpT = -Infinity
    this.lapMismatchT = NaN
    this.creditedLaps = 0
    this.dirty = true
    this.lapOffTrack = false
    this.lapStopped = false
    this.lastSfLap = NO_LINE
    this.lastSfT = NaN
    this.startSfLine = NO_LINE
    this.resetMotion()
    this.records = []
    this.bestClean = Infinity
    this.officialBest = Infinity
    this.pending = null
    this.officialBefore = -1
    this.prevOfficial = -1
    this.lastLap.clear()
    this.bestLap.clear()
    this.currentView = null
    this.pitKnown = false
    this.gridStart = false
    this.prevOnPit = false
    this.stintStartLap = NaN
    this.seenRacing = false
    this.lastInWorldT = 0
    this.finishLap = 0
    this.finishT = 0
  }

  /**
   * Telemetry gap (reconnect): keeps the counts and history but nothing is
   * interpolated across it, the lap in progress is unclean and a pit edge
   * across it is not counted.
   */
  breakContinuity(): void {
    this.prevValid = false
    this.lastDelta = 0
    this.dirty = true
    this.pitKnown = false
    this.resetMotion()
  }

  /** Speed unknown (reads 0) and not stopped: world exit, telemetry gap or a new entry. */
  resetMotion(): void {
    this.continuous = false
    this.spdD = 0
    this.spdT = NaN
    this.spdEma = 0
    this.spdWeight = 0
    this.spdKnown = false
    this.spdJumpS = 0
    this.motionT = NaN
    this.state.speed = 0
    this.state.stoppedForS = 0
  }

  /**
   * Takes the chequered flag at S/F crossing `lap` (SessionTime `t`): timing
   * stops there, also when the finish is found a few ticks late.
   */
  finish(lap: number, t: number): void {
    this.state.finished = true
    this.finishLap = lap
    this.finishT = t
    this.lastLine = Math.min(this.lastLine, lap * RACE_TIMING_LINES)
  }

  /** Records a line crossing; ignored past the finish line (cool-down laps are not timed). */
  record(line: number, time: number, flags: number): void {
    if (this.state.finished && line > this.finishLap * RACE_TIMING_LINES) return
    const s = slotOf(line)
    this.lines[s] = line
    this.times[s] = time
    this.flags[s] = flags
    this.lastLine = line
  }

  /**
   * Makes `line` the last one, forgetting the crossings after it: a tow or reset put the car
   * back behind them, and they will be crossed again.
   */
  rewindTo(line: number): void {
    const from = Math.max(line + 1, this.lastLine - HISTORY_SIZE + 1)
    for (let k = from; k <= this.lastLine; k++) {
      const s = slotOf(k)
      if (this.lines[s] === k) this.lines[s] = NO_LINE
    }
    this.lastLine = line
  }

  has(line: number): boolean {
    return this.lines[slotOf(line)] === line
  }

  /** Crossing time of `line`, NaN when it is not in the history. */
  time(line: number): number {
    const s = slotOf(line)
    return this.lines[s] === line ? (this.times[s] ?? NaN) : NaN
  }

  /** Crossing flags of `line` (only meaningful when has(line)). */
  flagsAt(line: number): number {
    return this.flags[slotOf(line)] ?? 0
  }

  /** Race distance used for ordering and laps down: frozen at the finish line once finished. */
  orderDistance(): number {
    return this.state.finished ? this.finishLap : this.lastD
  }
}
