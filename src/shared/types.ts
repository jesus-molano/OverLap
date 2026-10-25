/**
 * Domain types shared by main, telemetry process, preload and renderer.
 * Pure TypeScript: no Electron, no Node, no DOM.
 */
import type { DriverIdentity } from './driver'
import type { Language } from './i18n/language'
import type { ShortcutSettings } from './shortcuts'
import type { WidgetId } from './widgets'

export interface Size {
  width: number
  height: number
}

export interface Rect extends Size {
  x: number
  y: number
}

export interface Point {
  x: number
  y: number
}

/** Edge or corner being dragged when resizing a widget in edit mode. */
export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

// ---------------------------------------------------------------------------
// Session info (parsed from the session YAML)
// ---------------------------------------------------------------------------

export interface DriverEntry {
  carIdx: number
  userName: string
  carNumber: string
  iRating: number
  /** e.g. "A 4.99". Empty string when unknown. */
  licString: string
  /** CSS colour of the license, or null when unknown. */
  licColor: string | null
  classId: number
  classShortName: string
  /** CSS colour (#rrggbb) of the car class. */
  classColor: string
  /** Seconds. 0 when unknown. */
  classEstLapTime: number
  isPaceCar: boolean
  isSpectator: boolean
  /** DriverInfo LicLevel (1..24: class = floor((L-1)/4), band = (L-1) % 4 + 1), 0 when unknown. */
  licLevel: number
  /** LicSubLevel: Safety Rating x 100 (e.g. 312 = 3.12), 0 when unknown. */
  licSubLevel: number
  /** CarClassRelSpeed (bigger = faster class), 0 when unknown. */
  classRelSpeed: number
  /** DriverInfo UserID (stable per person), 0 when unknown. */
  userId: number
  /** DriverInfo TeamID (stable per team entry in team races), 0 when unknown. */
  teamId: number
  /** DriverInfo CarID (car model), 0 when unknown: part of the personal-best key. */
  carId: number
  /** DriverInfo CarScreenName (falls back to CarScreenNameShort), '' when unknown. */
  carName: string
  /** DriverInfo CarIsAI: an AI driver (its iRating and licence are always unknown). */
  isAI: boolean
}

/** One session of the weekend (SessionInfo.Sessions[]). */
export interface SessionDetails {
  /** "Race", "Practice", "Lone Qualify", ... */
  type: string
  name: string
  /** Lap limit, null for "unlimited" or unknown. */
  laps: number | null
  /** Time limit in seconds, null for "unlimited" or unknown. */
  timeS: number | null
}

/** Starting grid entry from QualifyResultsInfo.Results (1-based; the YAML is 0-based). */
export interface GridEntry {
  position: number
  classPosition: number
}

export interface SessionMeta {
  /** DriverInfo.DriverCarIdx, -1 when missing (telemetry PlayerCarIdx wins when valid). */
  playerCarIdx: number
  /** DriverInfo.PaceCarIdx, -1 when there is none. */
  paceCarIdx: number
  /** DriverInfo.DriverCarEstLapTime in seconds, 0 when unknown (fallback for the player's class). */
  driverCarEstLapTime: number
  /** Parsed WeekendInfo.TrackLength in metres, null when missing or unparseable. */
  trackLengthM: number | null
  trackName: string
  /** Drivers by CarIdx. */
  drivers: ReadonlyMap<number, DriverEntry>
  /** SessionInfo.Sessions[].SessionType by SessionNum ("Race", "Practice", ...). */
  sessionTypes: ReadonlyMap<number, string>
  /** SessionInfo.Sessions[] by SessionNum. */
  sessions: ReadonlyMap<number, SessionDetails>
  /** WeekendInfo.SubSessionID, 0 when unknown: identifies one race. */
  subSessionId: number
  /** WeekendInfo.EventType ("Race", "Practice", "Test", ...), '' when unknown. */
  eventType: string
  /** WeekendInfo.Official == 1. */
  official: boolean
  /** WeekendInfo.TrackNumTurns (corners per lap, for SR), 0 when unknown. */
  trackNumTurns: number
  /** SplitTimeInfo.Sectors[].SectorStartPct ascending, starting at 0; empty when unknown. */
  sectorStarts: readonly number[]
  /** QualifyResultsInfo.Results by CarIdx; empty when unknown. */
  grid: ReadonlyMap<number, GridEntry>
  /** WeekendInfo.TeamRacing == 1: drivers swap inside one car entry. */
  teamRacing: boolean
  /** WeekendInfo.TrackPitSpeedLimit ('72.00 kph' / '45.00 mph') in km/h, null when unknown. */
  pitSpeedLimitKmh: number | null
  /** WeekendInfo.TrackID, 0 when unknown: part of the personal-best key. */
  trackId: number
  /** WeekendInfo.TrackConfigName ('' when none): different layouts get different personal bests. */
  trackConfig: string
}

// ---------------------------------------------------------------------------
// Relative widget payload
// ---------------------------------------------------------------------------

/**
 * Race-distance relation of a car to the player:
 * - `same`: on the same lap as the player.
 * - `ahead`: one or more laps ahead of the player ("vuelta de más"); the
 *   player is being lapped by it.
 * - `behind`: one or more laps behind the player (doblado).
 */
export type LapRelation = 'same' | 'ahead' | 'behind'

export interface RelativeRow {
  carIdx: number
  isPlayer: boolean
  /** Class position (> 0) or null when the sim does not report one yet. */
  classPosition: number | null
  carNumber: string
  driverName: string
  classShortName: string
  classColor: string
  iRating: number | null
  licString: string | null
  licColor: string | null
  /**
   * Time gap to the player in seconds, irDashies convention: positive = car
   * is ahead of the player on track, negative = car is behind. 0 for the
   * player row. null when it cannot be estimated (missing est times).
   */
  gapS: number | null
  lapRelation: LapRelation
  /** On pit road or in the pit stall: rendered dimmed. */
  inPits: boolean
}

export interface RelativeData {
  /** Ordered top to bottom: furthest ahead first, player, furthest behind last. */
  rows: RelativeRow[]
  /** Index of the player row in `rows`, -1 when the player is not on track. */
  playerRow: number
  /**
   * Configured rows above/below the player. `rows` can hold fewer cars on
   * either side; the widget pads with empty rows so the player stays centred.
   */
  slotsAhead: number
  slotsBehind: number
  /** SessionType of the current session ("Race", "Practice", ...) or null. */
  sessionType: string | null
}

// ---------------------------------------------------------------------------
// Radar widget payload
// ---------------------------------------------------------------------------

/** Lateral lane of a radar car: negative = left of the player, 0 = same line. */
export type RadarLane = -2 | -1 | 0 | 1 | 2

export interface RadarCar {
  /** -1 for a car inferred from CarLeftRight that could not be matched to a CarIdx. */
  carIdx: number
  /** Longitudinal distance in metres along the track: positive = ahead of the player. */
  distM: number
  lane: RadarLane
  /** True when the car overlaps the player (alongside, per CarLeftRight). */
  overlapping: boolean
  /** 0 = at the edge of the range, 1 = touching. */
  proximity: number
  /** Proximity colour, green (far) to red (close). */
  color: string
  classColor: string
  /**
   * SessionTime (s) until which a car that was alongside keeps its side lane
   * after CarLeftRight stops counting it (iRacing gives no lateral data then).
   * Absent for cars that never had a side.
   */
  sideHoldUntil?: number
}

export interface RadarData {
  /** False when nobody is within range and nobody is alongside: the widget fades out. */
  visible: boolean
  rangeM: number
  /** Raw CarLeftRight value of this tick. */
  carLeftRight: number
  /** Cars alongside on each side according to CarLeftRight. */
  leftCount: 0 | 1 | 2
  rightCount: 0 | 1 | 2
  cars: RadarCar[]
  /** False when WeekendInfo.TrackLength was missing/unparseable: only lateral info is shown. */
  trackLengthKnown: boolean
}

// ---------------------------------------------------------------------------
// Payload map: one entry per widget in WIDGET_DEFS.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Standings widget payload
// ---------------------------------------------------------------------------

/** A gap shown as time, or as whole laps when the car is a lap or more behind. */
export type GapValue = { kind: 'time'; seconds: number } | { kind: 'laps'; laps: number }

export type StandingsStatus = 'running' | 'finished' | 'pits' | 'off-track' | 'disconnected'

export interface StandingsRow {
  carIdx: number
  isPlayer: boolean
  /** 1-based, within the class. */
  classPosition: number
  /** Grid class position minus current one (+ = gained), null when the grid is unknown or not a race. */
  positionsGained: number | null
  carNumber: string
  driverName: string
  classColor: string
  iRating: number | null
  licString: string | null
  licColor: string | null
  /** To the class car ahead; null for the class leader or when unknown. */
  interval: GapValue | null
  /** To the class leader; null for the leader or when unknown. */
  gapToLeader: GapValue | null
  /** Seconds, null when none. */
  lastLap: number | null
  /** 'class-best' = fastest lap of the class this session (purple), 'personal-best' = this driver's best (green). */
  lastLapKind: 'normal' | 'personal-best' | 'class-best'
  bestLap: number | null
  pitStops: number
  /** CarIdxLapCompleted at the last pit exit, null when none. */
  lastPitLap: number | null
  /** On the first lap after leaving the pits ("OUT"). */
  outLap: boolean
  status: StandingsStatus
  /** Penalty flag shown as a badge. */
  penalty: 'black' | 'meatball' | null
  /** Projected iRating change at the current position (race only), null when not computed. */
  iRatingDelta: number | null
}

export interface StandingsClassBlock {
  classId: number
  /** The session info's short name; '' when it has none (the widget words a fallback). */
  className: string
  classColor: string
  /** Strength of field of the class, null when unknown. */
  sof: number | null
  carCount: number
  isPlayerClass: boolean
  /** Rows in display order. `gapBefore` on a row means rows were skipped above it (draw a separator). */
  rows: (StandingsRow & { gapBefore: boolean })[]
}

export interface PlayerRatingProjection {
  /** Projected iRating change at the current class position. */
  iRatingDelta: number
  /** About how much iRating one position is worth in this class (positive). */
  perPosition: number
  /**
   * "Neutro": the last (highest-numbered) class position at which the projected
   * change is still >= 0, i.e. finish there or better and you do not lose
   * iRating; 0 when even P1 loses or it is unknown (you have not started).
   */
  breakEvenPosition: number
  /** iRating change if you gain / lose one position (null at the ends). */
  ifGainOne: number | null
  ifLoseOne: number | null
}

export interface SafetyRatingProjection {
  /** Current SR, e.g. 3.12. */
  current: number
  /** Projected SR if the race ended now. */
  projected: number
  /** Licence class letter, current and projected ('R', 'D', 'C', 'B', 'A', 'P'). */
  licClass: string
  projectedLicClass: string
  incidents: number
  corners: number
  /**
   * Incidents you can still add this session without losing SR: over the whole
   * race when its laps left are known, else over the corners driven so far
   * (then 0 at the start, before any margin exists); 0 when already losing.
   */
  incidentBudget: number
}

export interface StandingsHeader {
  sessionType: string | null
  /** Laps left for the player (estimated in timed races), null when unknown. */
  lapsRemaining: number | null
  /** Seconds left in timed sessions, null otherwise. */
  timeRemainingS: number | null
  /** Race sessions with known iRatings only. */
  iRating: PlayerRatingProjection | null
  safetyRating: SafetyRatingProjection | null
}

export interface StandingsData {
  header: StandingsHeader
  /** Player's class first, then the others by class speed. */
  classes: StandingsClassBlock[]
}

// ---------------------------------------------------------------------------
// Battle widget payload
// ---------------------------------------------------------------------------

export interface BattleOpponent {
  /** On pit road / in the stall: the card is dimmed. */
  inPits: boolean
  carIdx: number
  carNumber: string
  driverName: string
  classColor: string
  iRating: number | null
  licString: string | null
  licColor: string | null
  /** Current time gap in seconds (always positive). */
  gapS: number
  /**
   * Seconds per lap the gap changes in YOUR favour (+ = you gain: closing on
   * the car ahead or pulling away from the car behind); null with too little
   * clean data.
   */
  trendSPerLap: number | null
  /** Ahead: whole laps until you catch it at the current trend; behind: until it catches you; null when not converging or not predicted. */
  lapsToCatch: number | null
  /** Whether that catch happens before the finish, null when unknown. */
  catchesBeforeEnd: boolean | null
  /** Ahead only: s/lap you must gain to catch it before the finish, null when unknown or already catching in time. */
  neededSPerLap: number | null
  /** Its times of the same laps as playerLastLaps (its own last ones while you have none; null = no time). */
  lastLaps: (number | null)[]
  /** Per sector of the latest lap you both completed: seconds YOU gained (+) or lost (-) against it; null when unknown. */
  sectorDeltas: number[] | null
  /** iRating swing between finishing ahead of or behind this car (race only), null when not computed. */
  iRatingAtStake: number | null
}

export interface BattleData {
  /** True when an opponent is within the threshold; otherwise the widget fades out. */
  visible: boolean
  /** Whole laps you still have to complete, including the current one; null when unknown. */
  lapsRemaining: number | null
  /** Your last lap times, most recent first, up to 3. */
  playerLastLaps: (number | null)[]
  ahead: BattleOpponent | null
  behind: BattleOpponent | null
}

// ---------------------------------------------------------------------------
// Inputs widget payload (60 Hz, player only)
// ---------------------------------------------------------------------------

export interface InputsData {
  /** 0..1, quantised to 0.01. */
  throttle: number
  brake: number
  /** Pedal position 0..1 (1 = pressed), i.e. 1 - Clutch. */
  clutch: number
  /** -1 (full right) .. 1 (full left) relative to SteeringWheelAngleMax; 0 when unknown. */
  steering: number
  /** -1 reverse, 0 neutral, 1.. forward. */
  gear: number
  speedKmh: number
  abs: boolean
  /** False when the player is not in the car: the widget fades out. */
  active: boolean
  /**
   * SessionTime of the sample (s), so the trace can be spaced by time, not by sample; NaN when
   * unknown (the trace then spaces samples by period).
   */
  t: number
}

// ---------------------------------------------------------------------------
// Traffic widget payload (v2.1)
// ---------------------------------------------------------------------------

/**
 * - `faster`: a car of a faster class closing on you from behind.
 * - `slower`: a car of a slower class you are closing on ahead.
 * - `hazard`: a car ahead that is stopped, very slow or off track.
 */
export type TrafficKind = 'faster' | 'slower' | 'hazard'
export type HazardKind = 'stopped' | 'slow' | 'off-track'

export interface TrafficEntry {
  driver: DriverIdentity
  kind: TrafficKind
  className: string
  /** Seconds of road between you and it: + ahead of you, - behind. */
  gapS: number
  /**
   * Seconds until you meet: the faster car reaches you / you reach the slower
   * car or the hazard. null when not converging.
   */
  etaS: number | null
  /** Where you meet as a lap fraction (0..1), null when unknown. */
  meetPct: number | null
  /** 1-based sector of meetPct (SessionMeta.sectorStarts), null when unknown. */
  meetSector: number | null
  /** On a different lap: the faster car is lapping you / you are lapping the slower one. */
  lapping: boolean
  /** Hazards only. */
  hazard: HazardKind | null
}

export interface TrafficData {
  /** False when there is nothing to show: the widget fades out. */
  visible: boolean
  /** Closest first (by etaS, then |gapS|), at most TrafficOptions.maxEntries each. */
  faster: TrafficEntry[]
  slower: TrafficEntry[]
  hazards: TrafficEntry[]
}

// ---------------------------------------------------------------------------
// Alerts widget payload (v2.1)
// ---------------------------------------------------------------------------

export type FlagKind =
  | 'disqualified'
  | 'black'
  | 'meatball'
  | 'red'
  | 'caution'
  | 'yellow'
  | 'debris'
  | 'blue'
  | 'white'
  | 'checkered'
  | 'green'

export interface AlertsData {
  /** False when nothing is active: the widget fades out. */
  visible: boolean
  /** Flags that apply to you, most important first (see FlagKind order). */
  flags: FlagKind[]
  /** On pit road: limiter on / off / on but over the limit; null when not on pit road. */
  pitLimiter: 'on' | 'off' | 'speeding' | null
  speedKmh: number
  pitLimitKmh: number | null
}

// ---------------------------------------------------------------------------
// Delta widget payload (v2.2)
// ---------------------------------------------------------------------------

/**
 * - `pb`: your all-time best lap with this car on this track layout (stored on disk).
 * - `session`: your best lap of this session.
 * - `class`: the fastest lap of your class in this session, by anyone.
 */
export type DeltaReference = 'pb' | 'session' | 'class'

export interface DeltaData {
  /** False when there is no reference or you are not driving: the widget fades out. */
  visible: boolean
  /** The reference actually used (it can fall back when the preferred one does not exist yet). */
  reference: DeltaReference
  /**
   * For a 'class' reference driven by someone else: '#44 J. Lindqvist'
   * (number and abbreviated name, no words to translate); '' otherwise. The
   * widget names the other kinds itself.
   */
  refDriver: string
  /** A 'class' reference that is your own lap. */
  refSelf: boolean
  refLapTime: number | null
  /** Seconds versus the reference at this point of the lap: negative = faster. Quantised 0.01. */
  delta: number | null
  /** How the delta is changing, s per s (negative = gaining), smoothed over ~0.5 s; quantised 0.01. */
  trend: number
  /** refLapTime + delta, null when unknown. */
  predictedLap: number | null
  /** Completed sectors of the current lap versus the reference (+ lost, - gained), null = not reached. */
  sectors: (number | null)[]
  /** False once the current lap touched pit road, went off track or stopped (it won't count). */
  lapValid: boolean
}

export interface WidgetPayloads {
  relative: RelativeData
  radar: RadarData
  standings: StandingsData
  battle: BattleData
  inputs: InputsData
  traffic: TrafficData
  alerts: AlertsData
  delta: DeltaData
}

/** Distributive union `{ widget: 'relative', payload: RelativeData } | ...`. */
export type WidgetDataMessage = {
  [K in WidgetId]: { widget: K; payload: WidgetPayloads[K] }
}[WidgetId]

// ---------------------------------------------------------------------------
// Connection status
// ---------------------------------------------------------------------------

export type SourceKind = 'iracing' | 'mock'

/**
 * - `starting`: telemetry process booting.
 * - `waiting`: real source, iRacing not running or not in a session; retrying.
 * - `connected`: real source delivering data.
 * - `mock`: simulated source delivering data.
 * - `error`: telemetry process crashed or the source failed; main restarts it.
 */
export type ConnectionState = 'starting' | 'waiting' | 'connected' | 'mock' | 'error'

/**
 * What the state alone does not say, for an 'error' state: the telemetry
 * process restarting, or the iRacing SDK's native module missing.
 */
export type StatusNote = 'none' | 'restarting' | 'native-missing'

/**
 * Connection status. No sentence: each window words it in its language
 * (statusText in @shared/i18n).
 */
export interface OverlayStatus {
  state: ConnectionState
  source: SourceKind
  note: StatusNote
  /** Technical detail of an error (the exception's message, untranslated); '' otherwise. */
  detail: string
}

// ---------------------------------------------------------------------------
// Settings (persisted as JSON in userData) and telemetry config
// ---------------------------------------------------------------------------

/** Why a visibility rule hides a widget: not shown in this kind of session, or in the pits. */
export type HiddenReason = 'practice' | 'qualify' | 'race' | 'pits'

/** Session kinds a widget can be limited to ("Mostrar en"). */
export interface ShowInSessions {
  practice: boolean
  qualify: boolean
  race: boolean
}

export interface WidgetSettings {
  visible: boolean
  bounds: Rect
  /**
   * A locked widget stays click-through and cannot be moved or resized, even
   * in edit mode, so it cannot be nudged by accident.
   */
  locked: boolean
  /** Opacity of the widget's background panel, 0..1. Text and cars stay fully opaque. */
  backgroundOpacity: number
  /** Content scale in % (60..200, default 100); multiplies appearance.fontScale. */
  scale: number
  /**
   * Height follows the content (auto-height widgets only, see WidgetDef.sizeModel);
   * the user only controls the width.
   */
  autoHeight: boolean
  /** Which edge stays put when the auto height changes ('top' grows downwards). */
  anchor: 'top' | 'bottom'
  /** Session kinds in which the widget is shown at all (evaluated by the telemetry process). */
  showIn: ShowInSessions
  /** Hide while the player is on pit road or in the stall. */
  hideInPits: boolean
}

/** How driver names are written: 'Alejandro Ruiz' / 'A. Ruiz' / 'Ruiz' / 'RUI'. */
export type NameFormat = 'full' | 'abbr' | 'surname' | 'tv'

/** Global look, applied once per window (CSS variables on the document root). */
export interface AppearanceSettings {
  /** Accent colour (#rrggbb): means "you" and nothing else. */
  accent: string
  /** Global text scale in % (80..150). */
  fontScale: number
  density: 'comfortable' | 'compact'
  nameFormat: NameFormat
  licenseStyle: 'soft' | 'solid' | 'letter'
  numberStyle: 'chip' | 'stripe'
  /** Colour-blind-safe palette (blue/orange instead of green/red; shapes always present). */
  colorBlind: boolean
  units: 'metric' | 'imperial'
  /** Alternate row shading. */
  stripes: boolean
  /** Text outline over the game: 'auto' = only when the background opacity is low. */
  textHalo: 'auto' | 'on' | 'off'
  /** The "MOCK"/"SIM" pill in widget headers. */
  showSimPill: boolean
  /** Interface language. */
  language: Language
}

export interface RelativeOptions {
  carsAhead: number
  carsBehind: number
  /** Optional columns (display only; the telemetry process ignores them). */
  showClassPosition: boolean
  showLicense: boolean
  showIRating: boolean
  /** 'inherit' (default) = appearance.nameFormat, like every other widget. */
  nameFormat: NameFormat | 'inherit'
}

export interface RadarOptions {
  /** Cars further than this (metres, along the track) are not shown. */
  rangeM: number
  /** Distance labels on the range guides. */
  showRangeLabels: boolean
}

/**
 * Right-hand columns of the standings, in display order; the left block
 * (position, number, name) is fixed. 'gap' follows gapMode, 'gapLeader' is the
 * gap to the class leader shown as its own column.
 */
export type StandingsColumnId =
  'gained' | 'ir' | 'lic' | 'delta' | 'gap' | 'gapLeader' | 'last' | 'pit'

export interface StandingsColumn {
  id: StandingsColumnId
  visible: boolean
}

export interface StandingsOptions {
  /** compact: top rows + window around you + other class leaders; full: every car of every class. */
  mode: 'compact' | 'full'
  /** Compact: leading rows of your class (0..10). */
  topRows: number
  /** Compact: rows above and below you (0..10). */
  aroundRows: number
  /** Compact: one line with the leader of each other class. */
  otherClassLeaders: boolean
  /** Which gap the 'gap' column shows ('both' = interval, plus gapLeader as its own column). */
  gapMode: 'interval' | 'leader' | 'both'
  /** Every column id exactly once, in order (normalisation fixes missing/duplicated ids). */
  columns: StandingsColumn[]
  /** 'inherit' = appearance.nameFormat. */
  nameFormat: NameFormat | 'inherit'
  /** Projected iRating change on every row (otherwise only on yours and in the header). */
  iRatingDeltaAll: boolean
  /** Header line with your projected iRating. */
  headerIRating: boolean
  /** Header line with your projected SR and incident margin. */
  headerSafetyRating: boolean
  showSof: boolean
  showCarCount: boolean
  /** 'inherit' = appearance.density. */
  density: 'inherit' | 'comfortable' | 'compact'
}

export interface BattleOptions {
  /** Show an opponent when the gap is below this (s, 0.3..5). */
  thresholdS: number
  showAhead: boolean
  showBehind: boolean
  layout: 'stacked' | 'side'
  /** What each lane shows below the headline. */
  detail: 'none' | 'sectors' | 'laps' | 'both'
  /** Keep an opponent shown this long (s, 0..10) after it leaves the threshold. */
  holdS: number
  /** Catch prediction line ("Le alcanzas en ~3 v"). */
  showPrediction: boolean
  showIRatingAtStake: boolean
  /** 'inherit' = appearance.nameFormat. */
  nameFormat: NameFormat | 'inherit'
}

export interface InputsOptions {
  /** Seconds of trace history (2..10). */
  traceSeconds: number
  showClutch: boolean
  showSteering: boolean
  showGearSpeed: boolean
  /** Clutch line in the trace (the bar follows showClutch). */
  clutchInTrace: boolean
  /** Trace line width in px (1..3). */
  traceWidth: number
  /** Pedal colours (#rrggbb). */
  colors: { throttle: string; brake: string; clutch: string }
  steeringStyle: 'bar' | 'wheel'
  layout: 'trace-bars-info' | 'info-bars-trace' | 'bars'
}

export interface TrafficOptions {
  /** Look for faster cars up to this many seconds behind (2..30). */
  behindS: number
  /** Look for slower cars up to this many seconds ahead (2..30). */
  aheadS: number
  /** Look for hazards up to this many seconds ahead (2..20). */
  hazardS: number
  /** Entries per group (1..5). */
  maxEntries: number
  showFaster: boolean
  showSlower: boolean
  showHazards: boolean
  /** Faster/slower traffic only in multiclass sessions (hazards always). */
  onlyMulticlass: boolean
  /** 'inherit' = appearance.nameFormat. */
  nameFormat: NameFormat | 'inherit'
}

export interface AlertsOptions {
  showFlags: boolean
  /** Blue flag (let a faster car by) as its own toggle: some find it noisy. */
  showBlue: boolean
  showPitLimiter: boolean
  /** Keep a flag shown at least this long (s, 0..10) so a flicker is readable. */
  holdS: number
}

export interface DeltaOptions {
  reference: DeltaReference
  /** Use the next available reference while the preferred one does not exist (pb -> session -> class). */
  fallback: boolean
  /** Full scale of the bar in seconds (0.5..3). */
  rangeS: number
  showPredicted: boolean
  showSectors: boolean
  showTrend: boolean
}

export interface OverlaySettings {
  /** 4 added appearance and per-widget scale/auto-height/visibility rules; v1..v3 files are migrated. */
  version: 4
  appearance: AppearanceSettings
  widgets: Record<WidgetId, WidgetSettings>
  relative: RelativeOptions
  radar: RadarOptions
  standings: StandingsOptions
  battle: BattleOptions
  inputs: InputsOptions
  traffic: TrafficOptions
  alerts: AlertsOptions
  delta: DeltaOptions
  /** Global keyboard shortcuts (main registers them; nothing else acts on them). */
  shortcuts: ShortcutSettings
}

/**
 * Change requested by the settings window. Untrusted: main validates and
 * clamps it (`applySettingsPatch`). Bounds are not patched here; they only
 * change by dragging in edit mode or with the 'reset-widget-bounds' command.
 */
export interface SettingsPatch {
  appearance?: Partial<AppearanceSettings>
  widgets?: Partial<
    Record<
      WidgetId,
      Partial<
        Pick<
          WidgetSettings,
          | 'visible'
          | 'locked'
          | 'backgroundOpacity'
          | 'scale'
          | 'autoHeight'
          | 'anchor'
          | 'hideInPits'
        > & { showIn: Partial<ShowInSessions> }
      >
    >
  >
  relative?: Partial<RelativeOptions>
  radar?: Partial<RadarOptions>
  standings?: Partial<StandingsOptions>
  battle?: Partial<BattleOptions>
  inputs?: Partial<InputsOptions>
  traffic?: Partial<TrafficOptions>
  alerts?: Partial<AlertsOptions>
  delta?: Partial<DeltaOptions>
  /** A combination another action has is refused (the current one is kept). */
  shortcuts?: Partial<ShortcutSettings>
}

/** What main tells the telemetry process. */
export interface TelemetryConfig {
  /** Only these widgets are computed and sent. */
  enabledWidgets: WidgetId[]
  /**
   * Visibility rules per widget, evaluated every tick against the current
   * session type and whether the player is on pit road. A widget hidden by a
   * rule is not computed and its overlay panel is not drawn (except in edit
   * mode).
   */
  rules: Record<WidgetId, { showIn: ShowInSessions; hideInPits: boolean }>
  relative: RelativeOptions
  radar: RadarOptions
  standings: StandingsOptions
  battle: BattleOptions
  inputs: InputsOptions
  traffic: TrafficOptions
  alerts: AlertsOptions
  delta: DeltaOptions
}
