/**
 * Domain types shared by main, telemetry process, preload and renderer.
 * Pure TypeScript: no Electron, no Node, no DOM.
 */
import type { BrandId, BrandMarkMode } from './carBrands'
import type { DriverIdentity } from './driver'
import type { Language } from './i18n/language'
import type { LayoutSection, WIDGET_OPTION_FIELDS } from './settingsSchema'
import type { MoreShortcuts, ShortcutAction, ShortcutSettings } from './shortcuts'
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
  /** DriverInfo TeamName: the team in team races, the driver's own name again elsewhere. */
  teamName: string
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
  /** The car's make (carBrands.ts, from CarScreenName, CarScreenNameShort and CarPath). */
  brand: BrandId
  /**
   * The driver's country as a flag code of country-flag-icons (ISO 3166 alpha-2, 'GB-ENG' for
   * the home nations): countries.ts countryOfFlair(FlairName); '' for none ('-none-'), unknown,
   * the pace car and spectators.
   */
  country: string
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
  /** SessionTrackRubberState as iRacing writes it ('moderate usage', 'carry over'), '' when unknown. */
  rubberState: string
}

/** Starting grid entry from QualifyResultsInfo.Results (1-based; the YAML is 0-based). */
export interface GridEntry {
  position: number
  classPosition: number
  /** Its qualifying time (FastestTime) in seconds, null without one (it starts at the back). */
  bestLap: number | null
}

export interface SessionMeta {
  /** DriverInfo.DriverCarIdx, -1 when missing (telemetry PlayerCarIdx wins when valid). */
  playerCarIdx: number
  /** DriverInfo.PaceCarIdx, -1 when there is none. */
  paceCarIdx: number
  /** DriverInfo.DriverCarEstLapTime in seconds, 0 when unknown (fallback for the player's class). */
  driverCarEstLapTime: number
  /**
   * DriverInfo.DriverCarIdleRPM of your car, 0 or missing when unknown (the alerts' pressure
   * lights need the engine running). Optional: hand-built sessions (tests) may leave it out.
   */
  driverCarIdleRpm?: number
  /**
   * Your car's shift lights (DriverInfo DriverCarSL*RPM, else from DriverCarRedLine), null when
   * the YAML gives neither. Optional like driverCarIdleRpm.
   */
  shiftRpm?: ShiftRpm | null
  /** Parsed WeekendInfo.TrackLength in metres, null when missing or unparseable. */
  trackLengthM: number | null
  trackName: string
  /** Drivers by CarIdx. */
  drivers: ReadonlyMap<number, DriverEntry>
  /**
   * DriverInfo.DriverTires: TireCompoundType by TireIndex (the value of CarIdxTireCompound),
   * e.g. 0 'Hard', 1 'Wet'. It only describes your own car model (DriverCarIdx's CarID); empty
   * when unknown.
   */
  tyreCompounds: ReadonlyMap<number, string>
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
  /** WeekendInfo.WeekendOptions incident limits (all null when 'unlimited' or missing). */
  incidentLimits: IncidentLimits
  /**
   * Your car's tank and the session's pit limits (fuel/spec.ts). parseSessionMeta always sets
   * it; a session built by hand (tests) may leave it out, which reads as all unknown.
   */
  pitSpec?: PitSpec
}

/** Your car's tank and the session's pit limits, from the session YAML (fuel/spec.ts). */
export interface PitSpec {
  /** DriverCarFuelMaxLtr: the tank in litres; null when unknown. */
  fuelMaxL: number | null
  /**
   * The part of the tank you may fill, 0..1: the smaller of DriverCarMaxFuelPct and your class's
   * CarClassMaxFuelPct (the BoP cap); null when neither is known.
   */
  maxFuelFrac: number | null
  /** WeekendOptions FastRepairsLimit; null when unlimited or unknown. */
  fastRepairsLimit: number | null
  /** Your class's CarClassDryTireSetLimit; null when unlimited (0) or unknown. */
  tyreSetLimit: number | null
}

// ---------------------------------------------------------------------------
// Incidents (the player's only: iRacing gives no incident data for other drivers)
// ---------------------------------------------------------------------------

/**
 * Incident limits of the session, from WeekendOptions (text: 'unlimited' or a number; the
 * warning ones are not in the SDK's types and may be missing). null = no such limit.
 */
export interface IncidentLimits {
  /** IncidentLimit: disqualified on reaching it. */
  dq: number | null
  /** IncidentWarningInitialLimit: the first penalty on reaching it. */
  penalty: number | null
  /** IncidentWarningSubsequentLimit: another penalty every this many after the first one. */
  penaltyEvery: number | null
}

/** The next limit of the session ahead of your count: a penalty or the DQ, at `at` incidents. */
export interface IncidentThreshold {
  kind: 'penalty' | 'dq'
  at: number
}

/** The incident count of the relative and standings headers ('3x · eq. 7x · pen. a 17x'). */
export interface IncidentCount {
  /** PlayerCarMyIncidentCount: yours, this session. */
  mine: number
  /** PlayerCarTeamIncidentCount in team races, null otherwise. */
  team: number | null
  /** The next limit (counted on the team's incidents in team races), null without limits. */
  limit: IncidentThreshold | null
}

/** irsdk_IncidentFlags report of PlayerIncidents (points: 2x, 1x, 0x, 2x, 0x, 4x). */
export type IncidentKind =
  | 'loss-of-control'
  | 'off-track'
  | 'contact-world'
  | 'collision-world'
  | 'contact-car'
  | 'collision-car'

/** Where the car was off the asphalt when it happened (PlayerTrackSurfaceMaterial). */
export type IncidentSurface = 'kerb' | 'grass' | 'dirt' | 'sand' | 'gravel' | 'astroturf'

/** Your last incident, while the alerts banner shows it ('+2x Pérdida de control · V5 · S3'). */
export interface IncidentAlert {
  /** Points it added: rises a moment apart are one incident (iRacing upgrades 2x to 4x). */
  points: number
  /** What PlayerIncidents reported, null when it reported nothing (the alert reads '+2x'). */
  kind: IncidentKind | null
  /** The lap you were on (1-based), null when unknown. */
  lap: number | null
  /** 1-based sector (SessionMeta.sectorStarts), null when unknown. */
  sector: number | null
  /** Off the asphalt (kerb, grass, gravel...), null on the track itself or when unknown. */
  surface: IncidentSurface | null
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

/**
 * Per-car flag drawn as a badge (CarIdxSessionFlags), most serious first: black flag
 * (disqualification included), meatball (repairs), furled black flag (a warning).
 */
export type CarPenalty = 'black' | 'meatball' | 'furled'

export interface RelativeRow {
  carIdx: number
  isPlayer: boolean
  /**
   * Class position (> 0), the same as Standings (the race model's); null when unknown: no
   * lap time outside races, not classified yet.
   */
  classPosition: number | null
  carNumber: string
  /** '' when unknown; teamName stands in then (see DriverIdentity). */
  driverName: string
  teamName?: string
  classShortName: string
  classColor: string
  iRating: number | null
  licString: string | null
  licColor: string | null
  /** The car's make (DriverEntry.brand); 'unknown' draws no mark. */
  brand: BrandId
  /** The driver's flag code (DriverEntry.country), '' for none. */
  country: string
  /**
   * Time gap to the player in seconds, irDashies convention: positive = car
   * is ahead of the player on track, negative = car is behind. 0 for the
   * player row. null when it cannot be estimated (missing est times).
   */
  gapS: number | null
  lapRelation: LapRelation
  /** On pit road or in the pit stall: rendered dimmed. */
  inPits: boolean
  /** In the pits around a tow (showsTow, as in the standings): a tow badge instead of PIT. */
  towed: boolean
  /** Laps of the car's current stint (RaceCarState.stintLaps), null when unknown (a replay). */
  stintLaps: number | null
  /** Its tyre compound's name ('Hard'), null when unknown (tyreCompoundOf in tyres.ts). */
  tyre: string | null
  penalty: CarPenalty | null
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
  /** Your incident count for the header, null when unknown (no player car). */
  incidents: IncidentCount | null
  /** What its info bars show (InfoFeed); null while no bar item needs data. */
  info: InfoBarData | null
  /**
   * More than one make in the whole field (fieldHasMultipleBrands): brand marks in 'auto' mode.
   * Decided on the field, not on the rows shown, so a moving window never makes marks flicker.
   */
  multiBrand: boolean
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
  /** '' when unknown; teamName stands in then (see DriverIdentity). */
  driverName: string
  teamName?: string
  classColor: string
  iRating: number | null
  licString: string | null
  licColor: string | null
  /** The car's make (DriverEntry.brand); 'unknown' draws no mark. */
  brand: BrandId
  /** The driver's flag code (DriverEntry.country), '' for none. */
  country: string
  /** To the class car ahead; null for the class leader or when unknown. */
  interval: GapValue | null
  /** To the class leader; null for the leader or when unknown. */
  gapToLeader: GapValue | null
  /** Seconds, null when none. */
  lastLap: number | null
  /** 'class-best' = fastest lap of the class this session (purple), 'personal-best' = this driver's best (green). */
  lastLapKind: 'normal' | 'personal-best' | 'class-best'
  bestLap: number | null
  /** 'class-best': bestLap is the fastest lap of the class this session (purple). */
  bestLapKind: 'normal' | 'class-best'
  /**
   * Pit stops so far (tows not counted), null when unknown (a replay: its model never saw the
   * stops before it).
   */
  pitStops: number | null
  /** CarIdxLapCompleted at the last pit exit, null when none or unknown. */
  lastPitLap: number | null
  /** On the first lap after leaving the pits ("OUT"). */
  outLap: boolean
  /**
   * In the pits around a tow or reset (RaceCarState.towed, while its countdown runs: showsTow):
   * a tow badge instead of PIT.
   */
  towed: boolean
  /** Laps of the current stint (RaceCarState.stintLaps); null if unknown (replay) or not shown. */
  stintLaps: number | null
  /**
   * Its tyre compound's name ('Hard'); null when unknown, no column shows it, or the whole
   * field runs the same usual compound (tyresVary: the column then says nothing).
   */
  tyre: string | null
  status: StandingsStatus
  /** Flag shown as a badge. */
  penalty: CarPenalty | null
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
  /** Your incident count, in every session type; null when unknown (no player car). */
  incidents: IncidentCount | null
}

export interface StandingsData {
  header: StandingsHeader
  /** Player's class first, then the others by class speed. */
  classes: StandingsClassBlock[]
  /** What its info bars show (InfoFeed); null while no bar item needs data. */
  info: InfoBarData | null
  /** More than one make in the whole field (RelativeData.multiBrand). */
  multiBrand: boolean
}

// ---------------------------------------------------------------------------
// Battle widget payload
// ---------------------------------------------------------------------------

export interface BattleOpponent {
  /** On pit road / in the stall: the card is dimmed. */
  inPits: boolean
  carIdx: number
  carNumber: string
  /** '' when unknown; teamName stands in then (see DriverIdentity). */
  driverName: string
  teamName?: string
  classColor: string
  iRating: number | null
  licString: string | null
  licColor: string | null
  /** The car's make (DriverEntry.brand); 'unknown' draws no mark. */
  brand: BrandId
  /** The driver's flag code (DriverEntry.country), '' for none. */
  country: string
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
  /** More than one make in the whole field (RelativeData.multiBrand). */
  multiBrand: boolean
  /** What its header and footer bars show (InfoFeed); null while no bar item needs data. */
  info: InfoBarData | null
}

// ---------------------------------------------------------------------------
// Inputs widget payload (60 Hz, player only)
// ---------------------------------------------------------------------------

/** A car's shift lights, RPM: the first light, the shift point, the last light, the blink. */
export interface ShiftRpm {
  first: number
  shift: number
  last: number
  blink: number
}

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
  /** The wheel's angle in whole degrees (positive = left), within the car's lock; 0 when unknown. */
  steeringDeg: number
  /** Engine revs, whole; 0 when unknown. */
  rpm: number
  /** The car's shift lights (SessionMeta.shiftRpm), RPM; all 0 when unknown (no lights lit). */
  slFirst: number
  slShift: number
  slLast: number
  slBlink: number
  /** dcBrakeBias as the car shows it (one decimal), null when the car has no such control. */
  brakeBias: number | null
  /** dcTractionControl (the TC setting, whole), null when the car has none. */
  tc: number | null
  /** Force-feedback torque 0..1 (SteeringWheelPctTorque, 0.01), null when unknown. */
  ffb: number | null
  /** The force feedback is at its maximum (clipping) on this tick. */
  ffbClip: boolean
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
/**
 * Why a faster car is listed whatever its pace (B08): `lap`, your class a lap or more ahead
 * coming to lap you; `blue`, passing you while you are shown the blue flag.
 */
export type TrafficPassing = 'lap' | 'blue'

export interface TrafficEntry {
  driver: DriverIdentity
  kind: TrafficKind
  /** Class short name; '' when every entry of the session is in one class. */
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
  /** Faster cars passing you (TrafficPassing), null for the others. */
  passing: TrafficPassing | null
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
  /** What its header and footer bars show (InfoFeed); null while no bar item needs data. */
  info: InfoBarData | null
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
  /** The furled black flag: a warning from race control (what for is not said). */
  | 'furled'
  | 'blue'
  | 'white'
  | 'checkered'
  | 'green'

/**
 * An alert that is not a flag (alerts.ts NOTICE_ORDER). Of the engine's lights the band keeps the
 * critical ones (a stall, the oil pressure, mandatory repairs); the warning lights strip shows
 * them all (LightsData).
 */
export type AlertNotice =
  /** Driving forward against the direction of the lap. */
  | { kind: 'wrongWay' }
  /** Engine stalled (only while in the car). */
  | { kind: 'stalled' }
  /** Just into the pit lead-in from the track, limiter off. */
  | { kind: 'pitEntry' }
  /** Low oil pressure with the engine running. */
  | { kind: 'oilPressure' }
  /** Towed: the countdown in your box until you can drive (PlayerCarTowTime), whole seconds left. */
  | { kind: 'tow'; seconds: number }
  /**
   * Mandatory repairs pending (EngineWarnings): pit for them before you may race on (the meatball
   * follows). Optional ones are the warning lights' alone.
   */
  | { kind: 'damage' }
  /** Laps to go of a race (10 or 5), shown for a few seconds once each per session. */
  | { kind: 'lapsToGo'; laps: number }
  /**
   * Fuel for fewer than FUEL_ALERT.lowLaps laps (to 0.1) and not enough to finish
   * (notices/fuel.ts).
   */
  | { kind: 'fuelLow'; laps: number }
  /** The pit window closes on this lap: stop at the end of it or run dry (notices/fuel.ts). */
  | { kind: 'boxThisLap' }

export type NoticeKind = AlertNotice['kind']

export interface AlertsData {
  /** False when nothing is active: the widget fades out. */
  visible: boolean
  /** Flags that apply to you, most important first (see FlagKind order). */
  flags: FlagKind[]
  /** Other alerts, most important first (alerts.ts NOTICE_ORDER), one per kind. */
  notices: AlertNotice[]
  /**
   * On pit road: limiter on / off / off and over the limit / on but over the limit; null when
   * not on pit road.
   */
  pitLimiter: 'on' | 'off' | 'offSpeeding' | 'speeding' | null
  speedKmh: number
  pitLimitKmh: number | null
  /** Your last incident while it is shown, null otherwise. */
  incident: IncidentAlert | null
  /**
   * In your pit box: in the stall, or being towed there (PlayerCarTowTime > 0, whether the tow
   * notice is shown or not). The meatball does not tell you to pit then: you are there.
   */
  inBox: boolean
}

// ---------------------------------------------------------------------------
// Warning lights widget payload (v2.5)
// ---------------------------------------------------------------------------

/** The lights of the strip, in its order (lights.ts LIGHT_ORDER). */
export type LightKind =
  | 'oilPressure'
  | 'fuelPressure'
  | 'stalled'
  /** Mandatory repairs (EngineWarnings 0x80): pit now. */
  | 'repair'
  /** Optional repairs (0x100): fixable at the stop. */
  | 'repairOptional'
  | 'water'
  | 'oilTemp'
  | 'pitLimiter'
  | 'revLimiter'

/**
 * How a light is lit, by severity: `off` dim grey; `alarm` red, act now (pressures, stall,
 * mandatory repairs); `warn` orange (the car's temperature lights, optional repairs); `caution`
 * yellow (a temperature above your own average, before its light); `info` blue, a state (the
 * limiters). Each lit level also has its own shape, so it reads without its colour.
 */
export type LightLevel = 'off' | 'alarm' | 'warn' | 'caution' | 'info'

export interface LightReading {
  kind: LightKind
  level: LightLevel
  /** Water and oil, with lights.showTemps: the reading in whole °C; null otherwise or unknown. */
  tempC: number | null
  /** Water and oil while the trend is up: whole °C above your own average; null otherwise. */
  riseC: number | null
  /** That trend while you spent most of it close behind another car (slipstream heats it). */
  draft: boolean
  /**
   * The repairs, lit, with lights.showRepairTime: whole seconds they take (PitRepairLeft /
   * PitOptRepairLeft, the crew's time); null otherwise or while iRacing says 0.
   */
  seconds: number | null
  /**
   * `seconds` are real ones, estimated in the stall (lights.repairRealTime, repairClock.ts),
   * not the crew's.
   */
  realTime: boolean
}

export interface LightsData {
  /** False out of the car, or with lights.onlyWhenLit while none is lit: the strip fades out. */
  visible: boolean
  /** The lights turned on in the options, in LIGHT_ORDER (with onlyWhenLit, the lit ones). */
  lights: LightReading[]
}

// ---------------------------------------------------------------------------
// Delta widget payload (v2.2)
// ---------------------------------------------------------------------------

/**
 * - `pb`: your all-time best lap with this car on this track layout (stored on disk).
 * - `session`: your best lap of this session.
 * - `optimal`: your best time in each track sector this session (clean laps), joined into a lap.
 * - `class`: the fastest lap of your class in this session, by anyone.
 * - `classOptimal`: the best time in each sector by anyone in your class this session, joined.
 */
export type DeltaReference = 'pb' | 'session' | 'optimal' | 'class' | 'classOptimal'

/**
 * The lap the delta is about:
 * - `valid`: a lap in progress that counts so far;
 * - `invalid`: it touched pit road, went off track, stopped or ran under caution (it won't count);
 * - `out`: your out lap (left pit road on it, a tow included);
 * - `tow`: being towed to the pits;
 * - `none`: no lap in progress (before your first line, on the grid, after your flag).
 */
export type DeltaLapState = 'valid' | 'invalid' | 'out' | 'tow' | 'none'

export interface DeltaData {
  /** False when there is no reference or you are not driving: the widget fades out. */
  visible: boolean
  /** The reference actually used (it can fall back when the preferred one does not exist yet). */
  reference: DeltaReference
  /**
   * For a 'class' reference driven by someone else: '#44 J. Lindqvist'
   * (number and abbreviated name, no words to translate), '#44' alone when the
   * name is unknown (the widget words it: 'Piloto #44'); '' otherwise (an
   * optimal lap is nobody's). The widget names the other kinds itself.
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
  /** The lap in progress (of the lap just finished while its summary shows). */
  lapState: DeltaLapState
  /**
   * The reference chosen for this kind of session (DeltaOptions.reference*, or the cycle
   * shortcut's for this session), before any fallback: `reference` differs from it while falling
   * back.
   */
  preferred: DeltaReference
  /**
   * A reference chosen (in the settings or with the cycle shortcut) that takes over at the start
   * of the next lap; null when none is waiting. The widget names it for a moment.
   */
  pending: DeltaReference | null
  /**
   * The choice (in force, or waiting in `pending`) is the cycle shortcut's: for this session
   * only, never saved. The widget marks the reference as temporary.
   */
  temporary: boolean
  /** The lap times line (DeltaLapId), whatever the reference. */
  laps: DeltaLaps
}

/** Your lap times for the delta's lap times line, seconds; null when there is none yet. */
export interface DeltaLaps {
  /** Your last completed lap (clean or not). */
  last: number | null
  /** Your best clean lap of the session (the 'session' reference). */
  best: number | null
  /** Your optimal lap of the session (the 'optimal' reference). */
  optimal: number | null
  /** Your record with this car on this layout (the 'pb' reference). */
  pb: number | null
}

// ---------------------------------------------------------------------------
// Track conditions: the footer of the relative and the standings (1 Hz)
// ---------------------------------------------------------------------------

/** How the track temperature moved over the last minutes (CONDITIONS in conditions.ts). */
export type TempTrend = 'up' | 'down' | 'steady'

export interface ConditionsData {
  /** False while the sim sends no weather at all: no footer is drawn. */
  visible: boolean
  /** TrackTempCrew in °C, to 0.1; null when missing. */
  trackTempC: number | null
  /** Over the last few minutes; null while there is too little history to tell. */
  trackTempTrend: TempTrend | null
  /** AirTemp in °C, to 0.1; null when missing. */
  airTempC: number | null
  /** WindVel, mean of the last CONDITIONS.windMeanS, in whole km/h; null when missing. */
  windKmh: number | null
  /**
   * Where the wind blows FROM (its mean direction, as `windKmh`), relative to your car's nose:
   * degrees clockwise in (-180, 180] (0 = from straight ahead, a headwind; 90 = from your
   * right), in steps of CONDITIONS.windStepDeg. Null when it means nothing: no wind or heading,
   * not in the car, calm.
   */
  windFromDeg: number | null
  /** irsdk_TrackWetness, 1 (dry) .. 7 (extremely wet); null when unknown (0) or missing. */
  wetness: number | null
  /** Precipitation in whole %, null when missing. */
  precipPct: number | null
  /** WeatherDeclaredWet: the stewards allow rain tyres. */
  declaredWet: boolean
  /** Skies, 0 (clear) .. 3 (overcast); null when missing or out of range. */
  skies: number | null
  /**
   * SessionTrackRubberState of the current session as iRacing writes it; '' when unknown. A
   * 'carry over' is the last real state of an earlier session instead (`rubberCarried`).
   */
  rubberState: string
  /** `rubberState` is carried over from an earlier session ('Media-alta (heredada)'). */
  rubberCarried: boolean
}

// ---------------------------------------------------------------------------
// Fuel widget payload (v2.4, 2 Hz)
// ---------------------------------------------------------------------------

/**
 * To the end of the session (fuel/strategy.ts). Laps are lap numbers as the widgets write them
 * ('V12': the twelfth lap); "stopping on lap n" is entering the pits at the end of it.
 */
export interface FuelFinish {
  /** The lap in progress. */
  lap: number
  /** Laps still to drive, the lap in progress counted from where you are, to 0.1. */
  lapsLeft: number
  /** Litres to take the flag with the margin (none on the last lap), to 0.1. */
  needL: number
  /** needL - the fuel you have: + short, - spare, to 0.1. */
  deficitL: number
  /**
   * The fuel does not reach the flag at the average, margin aside: the fuel alerts' "not enough
   * to finish" (a stop for the margin alone is the plan's, not an alarm).
   */
  short: boolean
  /**
   * Stops still needed: 0 when the fuel reaches the flag with the margin, and on the last lap
   * (no stop is left to make; `short` says whether it reaches the flag).
   */
  stops: number
  /**
   * Litres to add at the next stop, rounded up to 0.1 (0 without one): what is missing when it
   * fits in the tank, else the room the tank has at the window's first lap (a full tank).
   */
  addL: number
  /** The next stop fills the tank (it alone cannot cover the rest). */
  fill: boolean
  /**
   * First and last lap you can stop at the end of and still finish with `stops` stops; null
   * without a stop. `to` is never before the lap in progress, nor after the lap before the last.
   */
  window: { readonly from: number; readonly to: number } | null
  /** Litres per lap that would save one stop, to 0.01; null without a stop or out of reach. */
  saveL: number | null
}

/** The last tyre reading (iRacing only measures the tread in the pit stall). */
export interface TyreReading {
  /** Laps completed when it was taken (the stop's lap, 'V13'). */
  lap: number
  /** Tread left per tyre, whole %: front left, front right, rear left, rear right. */
  wearPct: readonly [number, number, number, number]
}

export interface FuelData {
  /** False while the sim sends no fuel level (not in a car): the widget fades out. */
  visible: boolean
  /** FuelLevel in litres, to 0.1; null when missing. */
  fuelL: number | null
  /** What you may carry (the tank and its BoP cap), litres to 0.1; null when unknown. */
  tankL: number | null
  /** Laps the fuel lasts at avgL, to 0.1; null while measuring. */
  lapsOfFuel: number | null
  /** Litres per lap over your last FuelOptions.avgLaps clean laps, to 0.01; null while measuring. */
  avgL: number | null
  /** Litres of your last lap driven without a refuel, tow or reset (clean or not), to 0.01. */
  lastL: number | null
  /** The most of those clean laps, to 0.01. */
  maxL: number | null
  /** Clean laps behind avgL (0: measuring). */
  samples: number
  /** avgL comes from an earlier session with the same car and track (none of this one's yet). */
  carried: boolean
  /** Null when the laps left are unknown (unlimited session) or while measuring. */
  finish: FuelFinish | null
  /**
   * PitSvFuel: litres the pit menu adds (to 0.1) while its fuel box is ticked, 0 when unticked;
   * null when unknown.
   */
  boxL: number | null
  /** Null until a stop of this session measured the tyres. */
  tyres: TyreReading | null
  /** Fast repairs left when the session limits them, else null. */
  fastRepairs: number | null
  /** Dry tyre sets left when the session limits them, else null. */
  tyreSets: number | null
  /** What its header and footer bars show (InfoFeed); null while no bar item needs data. */
  info: InfoBarData | null
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
  fuel: FuelData
  lights: LightsData
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

/**
 * Why a visibility rule hides a widget: its own rule (not shown in this kind of session, or
 * in the pits), or a global one (VisibilityOptions): the overlay only shows in races and this
 * session is not one ('not-race'), the garage screen is open, the iRacing UI is hidden, a replay
 * of the tape plays with replays set to hide everything ('replay'), you are out of the car and
 * the overlay only shows in it ('out-of-car'), the session screen is shown ('session-screen'),
 * or a replay of the tape plays and the widget only shows live data ('replay-player': pedals,
 * delta, relative...), or the camera follows another car live and the widget only has your own
 * car's data ('camera-other').
 */
export type HiddenReason =
  | 'practice'
  | 'qualify'
  | 'race'
  | 'pits'
  | 'not-race'
  | 'garage'
  | 'ui-hidden'
  | 'out-of-car'
  | 'session-screen'
  | 'replay'
  | 'replay-player'
  | 'camera-other'

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
  /**
   * Opacity of the widget's background panel, 0..1, or 'inherit' (the default since 2.3):
   * appearance.backgroundOpacity. Text and cars stay fully opaque. A file's own number stays.
   */
  backgroundOpacity: number | 'inherit'
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
  /**
   * Shown on iRacing's session screen although VisibilityOptions.hideOnSessionScreen hides the
   * others there, and although you are out of the car with VisibilityOptions.showWhen 'car' or
   * 'race' (default per widget: WidgetDef.defaultOnSessionScreen: the standings, for the
   * results).
   */
  showOnSessionScreen: boolean
}

/**
 * When the overlay is shown at all (VisibilityOptions.showWhen): 'car' only while you are in the
 * car (IsOnTrack), 'race' only while you are in the car in a race session, 'always' whatever you
 * do (the other rules still apply).
 */
export type ShowWhen = 'car' | 'race' | 'always'

/**
 * Global visibility rules, for every widget at once, from what the sim's screen shows
 * (simScreen.ts). Evaluated by the telemetry process like the per-widget ones, except
 * showWhileWaiting (the overlay windows'). Edit mode shows every widget and the user's hiding
 * (the shortcut, the tray) hides them all, whatever these say.
 */
export interface VisibilityOptions {
  /**
   * When to show the overlay. Out of the car ('car', 'race') only the widgets kept on the
   * session screen stay there (WidgetSettings.showOnSessionScreen), and with replays 'follow'
   * the widgets follow the car on camera while the replay system is on (live or the tape).
   */
  showWhen: ShowWhen
  /** Hide every widget while the iRacing UI is hidden (CamCameraState UIHidden). */
  hideWithSimUi: boolean
  /** Hide every widget while the garage screen is open (IsGarageVisible). */
  hideInGarage: boolean
  /**
   * Hide the widgets on iRacing's session screen (CamCameraState IsSessionScreen), except those
   * with WidgetSettings.showOnSessionScreen.
   */
  hideOnSessionScreen: boolean
  /**
   * While a replay of the tape plays (not its live point, which is live): 'hide' = every widget
   * hides; 'follow' = the widgets with live data only hide and the standings keep the live race.
   * At the live point the widgets follow the car on camera (CamCarIdx) and those with only your
   * car's data hide while it is another car. Out of the car with showWhen 'car' or 'race',
   * 'follow' is what shows them while you watch (the replay system on); 'hide' leaves them
   * hidden.
   */
  replays: 'hide' | 'follow'
  /**
   * Standings and relative keep saying "Waiting for iRacing" while there is no connection;
   * otherwise they hide after a few seconds (outside edit mode).
   */
  showWhileWaiting: boolean
}

/** How driver names are written: 'Alejandro Ruiz' / 'A. Ruiz' / 'Ruiz' / 'RUI'. */
export type NameFormat = 'full' | 'abbr' | 'surname' | 'tv'

/** Global look, applied once per window (CSS variables on the document root). */
export interface AppearanceSettings {
  /** Accent colour (#rrggbb): means "you" and nothing else. */
  accent: string
  /** Global text scale in % (80..150). */
  fontScale: number
  /** Background opacity (0..1) of every widget whose own is 'inherit'. */
  backgroundOpacity: number
  density: 'comfortable' | 'compact'
  nameFormat: NameFormat
  licenseStyle: LicenseStyle
  numberStyle: 'chip' | 'stripe'
  /** Car makes in their own colours, or one ink like the text (BrandMark). */
  brandLogos: 'color' | 'mono'
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

// ---------------------------------------------------------------------------
// Element lists: what a widget draws, and in which order (settingsSchema 'elements' specs)
// ---------------------------------------------------------------------------

/** One element of a widget zone: its id and whether it is drawn. */
export interface ElementEntry<Id extends string = string> {
  id: Id
  visible: boolean
}

/**
 * A zone of a widget (its columns, its rows, an info bar...): every id of the zone exactly once,
 * in display order. Normalisation keeps it so (fields.ts normalizeElements); read and change it
 * with shared/elements.ts, edit it with settings/elements/ElementEditor.vue.
 */
export type ElementList<Id extends string = string> = ElementEntry<Id>[]

/**
 * Cells of a relative row, left to right. `driver` (number plate, brand mark, flag, name and its
 * badges) and `gap` always stay.
 */
export type RelativeColumnId = 'pos' | 'driver' | 'lic' | 'ir' | 'tyre' | 'stint' | 'gap'
/** What a class line (and a single-class header) says about the class, in that order. */
export type StandingsClassLineId = 'sof' | 'carCount'
export type BattleLaneId = 'ahead' | 'behind'
/** A lane's rows below its fixed ones (rival, gap and trend). */
export type BattleRowId = 'prediction' | 'sectors' | 'laps'
/** Smaller parts of a lane: the rival's iRating and licence, the trend's words, iR at stake. */
export type BattlePartId = 'rating' | 'license' | 'trendNote' | 'stake'
/** The traffic groups, top to bottom (TrafficKind). */
export type TrafficGroupId = 'hazard' | 'slower' | 'faster'
/** Cells of a traffic line, left to right; `driver` and `value` always stay. */
export type TrafficPartId = 'icon' | 'cls' | 'driver' | 'lead' | 'value' | 'sector'
/** The pedals' blocks, in reading order (the trace hidden is the old 'bars' layout). */
export type InputsSectionId = 'trace' | 'bars' | 'info' | 'car'
export type InputsBarId = 'clutch' | 'brake' | 'throttle'
export type InputsInfoId = 'gear' | 'speed' | 'steering'
/** The car block's readouts: revs, brake bias, traction control, force feedback (clipping). */
export type InputsCarId = 'rpm' | 'bias' | 'tc' | 'ffb'
/** How the steering is drawn: the bar, or one of the wheels. */
export type SteeringStyle = 'bar' | 'minimal' | 'realistic' | 'formula'
export type WheelSize = 'small' | 'medium' | 'large'
/**
 * The delta's rows: the top line (its hero number always stays), the bar, the sectors, and the
 * lap times line (DeltaLapId, off by default).
 */
export type DeltaRowId = 'top' | 'bar' | 'sectors' | 'laps'
/** The top line's parts after the hero number. */
export type DeltaTopId = 'state' | 'predicted' | 'reference'
/**
 * The lap times line, whatever the reference: your last lap, your best of the session, your
 * optimal of the session and your record. The one the delta compares against is marked ('Δ').
 */
export type DeltaLapId = 'last' | 'best' | 'optimal' | 'pb'
/** The radar's layers over the cars: guides, side alerts, distance labels. */
export type RadarPartId = 'guides' | 'sideAlerts' | 'rangeLabels'
/** The alerts band's extras: what to do after each label, the other alerts as chips. */
export type AlertsPartId = 'notes' | 'chips'
/** The fuel widget's lines; `hero` (the fuel and the laps it lasts) always stays. */
export type FuelLineId =
  'hero' | 'gauge' | 'perLap' | 'finish' | 'window' | 'save' | 'tyres' | 'limits'

// ---------------------------------------------------------------------------
// Info bars: the configurable headers and footers (shared/infoBar.ts has the catalog)
// ---------------------------------------------------------------------------

/**
 * A data item of the info bars, the same catalog in every widget that has one (INFO_ITEMS in
 * infoBar.ts: its data source, its priority when the bar is short of room, its width):
 * - `title`: the widget's name (and the SIM tag); `session`: the session type ('CARRERA');
 * - `remaining`: time and/or laps left ('38:19  ≈19 v', 'Quedan 12 v', 'Final');
 * - `clock`: your computer's local time;
 * - `sof`, `carCount`: your class's strength of field and its entries;
 * - `incidents`: yours and the session's next limit ('3x · pen. a 17x');
 * - `iRating`, `safetyRating`: your projected changes (iRating in rated races only);
 * - `fastestLap`: the fastest lap of your class this session ('VR #9 1:01.234');
 * - `fuelLaps`: the laps your fuel lasts at your average;
 * - `trackTemp` (with its trend), `airTemp`, `wind` (its mean, and the dial), `wet` (the
 *   stewards' call, the wetness meter and the rain, only when relevant), `rubber`.
 */
export type InfoItemId =
  | 'title'
  | 'session'
  | 'remaining'
  | 'clock'
  | 'sof'
  | 'carCount'
  | 'incidents'
  | 'iRating'
  | 'safetyRating'
  | 'fastestLap'
  | 'fuelLaps'
  | 'trackTemp'
  | 'airTemp'
  | 'wind'
  | 'wet'
  | 'rubber'

/**
 * An entry of an info bar's list: a catalog item, or `split`, the marker after which the items
 * line up at the bar's far end (always "visible": it is a place, not something drawn).
 */
export type InfoBarEntryId = InfoItemId | 'split'

/** An info bar's text size ('off': no bar at all). Never smaller than the minimum text size. */
export type InfoBarSize = 'off' | 'small' | 'normal' | 'large'

/** The fastest lap of your class this session (the `fastestLap` item). */
export interface FastestLapInfo {
  lapTime: number
  carIdx: number
  carNumber: string
  /** '' when unknown. */
  driverName: string
  isPlayer: boolean
}

/**
 * What the info bars of a widget show, computed by the provider set's InfoFeed for the items its
 * bars draw (INFO_ITEMS[id].source): a field no visible item reads stays null (false), so the
 * payload only changes when something shown does.
 */
export interface InfoBarData {
  /** SessionType ('Race', 'Practice'...), null when unknown. */
  sessionType: string | null
  /** Laps left for you including the current one, whole (ceil); null when unknown. */
  lapsRemaining: number | null
  /** Seconds left in a timed session, whole (floor); null otherwise. */
  timeRemainingS: number | null
  /** The race is over for you (your flag, or no lap left): 'Final' instead of what is left. */
  finished: boolean
  /** Strength of field of your class, null when unknown. */
  sof: number | null
  /** Registered entries of your class, null when unknown. */
  carCount: number | null
  incidents: IncidentCount | null
  /** Rated races only. */
  iRating: PlayerRatingProjection | null
  /** Your class position, for the iRating swing ('P4 +31'); null when unknown. */
  classPosition: number | null
  safetyRating: SafetyRatingProjection | null
  fastestLap: FastestLapInfo | null
  /** The weather readings (ConditionsFeed, ~1 Hz); null while no item shows them. */
  conditions: ConditionsData | null
  /** Laps the fuel lasts at your average (FuelData.lapsOfFuel), null while measuring. */
  fuelLaps: number | null
}

/** How licences are drawn ('outline' is the default since v2.6; 'soft' was before). */
export type LicenseStyle = 'outline' | 'soft' | 'solid' | 'letter'

export interface RelativeOptions {
  carsAhead: number
  carsBehind: number
  /** The row's cells in order (display only; the telemetry process ignores them). */
  columns: ElementList<RelativeColumnId>
  /** The header bar: its items and size ('off': no header band). */
  headerBar: ElementList<InfoBarEntryId>
  headerBarSize: InfoBarSize
  /** The footer bar under the rows (off by default: the rows give it their height). */
  footerBar: ElementList<InfoBarEntryId>
  footerBarSize: InfoBarSize
  /** Arrow after the track temperature (the `trackTemp` item): rising or falling. */
  conditionsTrend: boolean
  /** The `wind` item's dial: where the wind comes from relative to your car. */
  conditionsWindDirection: boolean
  /** A row of column headings ('POS', 'PILOTO', 'iR'...) under the header. */
  columnHeads: boolean
  /** The car's make in the driver cell. */
  brandMarks: BrandMarkMode
  /** The driver's country flag in the driver cell (nothing for none or unknown). */
  countryFlags: boolean
  /** Black flag, meatball and furled black flag badges after the name. */
  showFlags: boolean
  /** 'inherit' (default) = appearance.nameFormat, like every other widget. */
  nameFormat: NameFormat | 'inherit'
  /**
   * Row height for the text ('inherit', default, = appearance.density). The relative fits its
   * rows to its window: 'compact' gives the text more of each row (RELATIVE_ROW_EM).
   */
  density: 'inherit' | 'comfortable' | 'compact'
}

export interface RadarOptions {
  /** Cars further than this (metres, along the track) are not shown. */
  rangeM: number
  /** The layers over the cars (fixed order; the distance labels sit on the guides). */
  parts: ElementList<RadarPartId>
}

/**
 * Right-hand columns of the standings, in display order; the left block
 * (position, number, name) is fixed. 'gap' follows gapMode, 'gapLeader' is the
 * gap to the class leader shown as its own column. 'best' is the best lap in
 * races ('last' shows it elsewhere), 'pitLap' the lap of the last stop, 'stint'
 * the laps since then and 'tyre' the compound.
 */
export type StandingsColumnId =
  | 'gained'
  | 'ir'
  | 'lic'
  | 'delta'
  | 'gap'
  | 'gapLeader'
  | 'last'
  | 'best'
  | 'pit'
  | 'pitLap'
  | 'stint'
  | 'tyre'

/** One standings column (the generic element entry; stored as `{ id, visible }`). */
export type StandingsColumn = ElementEntry<StandingsColumnId>

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
  /** The header's first line: session, your class, incidents, what is left. */
  headerBar: ElementList<InfoBarEntryId>
  headerBarSize: InfoBarSize
  /** The header's second line: your projected iRating and SR, the fastest lap. */
  subheaderBar: ElementList<InfoBarEntryId>
  subheaderBarSize: InfoBarSize
  /** The footer bar under the table (the track conditions by default). */
  footerBar: ElementList<InfoBarEntryId>
  footerBarSize: InfoBarSize
  /** Arrow after the track temperature (the `trackTemp` item). */
  conditionsTrend: boolean
  /** The `wind` item's dial. */
  conditionsWindDirection: boolean
  /** What a class line says, in order. */
  classLine: ElementList<StandingsClassLineId>
  /** A row of column headings under the header ('POS', 'PILOTO', 'INT.'...). */
  columnHeads: boolean
  /** The car's make on each row and leader line. */
  brandMarks: BrandMarkMode
  /** The driver's country flag on each row and leader line. */
  countryFlags: boolean
  /** 'inherit' = appearance.nameFormat. */
  nameFormat: NameFormat | 'inherit'
  /** Projected iRating change on every row (otherwise only on yours and in the header). */
  iRatingDeltaAll: boolean
  /** Black flag, meatball and furled black flag badges after the name (as in the relative). */
  showFlags: boolean
  /** 'inherit' = appearance.density. */
  density: 'inherit' | 'comfortable' | 'compact'
}

export interface BattleOptions {
  /** The header bar (off by default): the widget's name and whatever items you add. */
  headerBar: ElementList<InfoBarEntryId>
  headerBarSize: InfoBarSize
  /** The footer bar under the lanes (off by default). */
  footerBar: ElementList<InfoBarEntryId>
  footerBarSize: InfoBarSize
  /** Arrow after the track temperature (the `trackTemp` item). */
  conditionsTrend: boolean
  /** The `wind` item's dial. */
  conditionsWindDirection: boolean
  /** Show an opponent when the gap is below this (s, 0.3..5). */
  thresholdS: number
  /** The rivals, in order (a hidden one is not computed). */
  lanes: ElementList<BattleLaneId>
  layout: 'stacked' | 'side'
  /** Each lane's rows below the rival and the gap, in order. */
  rows: ElementList<BattleRowId>
  /** Smaller parts of each lane (the iRating at stake is computed only while shown). */
  parts: ElementList<BattlePartId>
  /** Keep an opponent shown this long (s, 0..10) after it leaves the threshold. */
  holdS: number
  /** The car's make in the rival's cell. */
  brandMarks: BrandMarkMode
  /** The rival's country flag (off by default). */
  countryFlags: boolean
  /** 'inherit' = appearance.nameFormat. */
  nameFormat: NameFormat | 'inherit'
}

export interface InputsOptions {
  /** Seconds of trace history (2..10). */
  traceSeconds: number
  /** The blocks in reading order: trace, bars, gear and speed. */
  sections: ElementList<InputsSectionId>
  /** The pedal bars, left to right. */
  bars: ElementList<InputsBarId>
  /** The readouts of the info block, in order. */
  info: ElementList<InputsInfoId>
  /** Clutch line in the trace (the bar is the bars list's). */
  clutchInTrace: boolean
  /** Trace line width in px (1..3). */
  traceWidth: number
  /** Pedal colours (#rrggbb). */
  colors: { throttle: string; brake: string; clutch: string }
  steeringStyle: SteeringStyle
  /** The wheel's size (the bar keeps its own). */
  wheelSize: WheelSize
  /** The wheel's accent: its straight-ahead mark (#rrggbb). */
  wheelColor: string
  /** The wheel's angle in degrees, under the wheel or the bar. */
  steeringDegrees: boolean
  /** The shift-light strip across the top. */
  shiftLights: boolean
  /** The car block's readouts, top to bottom. */
  car: ElementList<InputsCarId>
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
  /** The groups, top to bottom (a hidden one is not looked for). */
  groups: ElementList<TrafficGroupId>
  /** The cells of each line, left to right. */
  parts: ElementList<TrafficPartId>
  /**
   * The header bar: the widget's name and whatever items you add. Shown by default, as the title
   * band it replaced (a file's old `header` list gives its switch: migrate.ts).
   */
  headerBar: ElementList<InfoBarEntryId>
  headerBarSize: InfoBarSize
  /** The footer bar under the lines (off by default). */
  footerBar: ElementList<InfoBarEntryId>
  footerBarSize: InfoBarSize
  /** Arrow after the track temperature (the `trackTemp` item). */
  conditionsTrend: boolean
  /** The `wind` item's dial. */
  conditionsWindDirection: boolean
  /** A caption line over each group ('PELIGRO', 'DELANTE', 'POR DETRÁS'), header or not. */
  captions: boolean
  /** Faster/slower traffic only in multiclass sessions (hazards always). */
  onlyMulticlass: boolean
  /** 'inherit' = appearance.nameFormat. */
  nameFormat: NameFormat | 'inherit'
}

export interface AlertsOptions {
  showFlags: boolean
  /** Blue flag (let a faster car by) as its own toggle: some find it noisy. */
  showBlue: boolean
  /** The furled black flag (a warning), with the flags. */
  showFurled: boolean
  showPitLimiter: boolean
  /** Over the limit with the limiter off says so ('EXCESO 68 / 60 · LIMITADOR OFF'). */
  showPitOverspeed: boolean
  /** 'LIMITADOR' when you head for the pit entry with the limiter off. */
  showPitEntry: boolean
  /** '10 VUELTAS' / '5 VUELTAS' to the end of a race. */
  showLapsToGo: boolean
  /** Tow countdown. */
  showTow: boolean
  showWrongWay: boolean
  /** '+2x Pérdida de control · V5 · S3 · grava' for a few seconds when your count goes up. */
  showIncidents: boolean
  /**
   * The engine's critical lights (the warning lights strip has them all): a stall, the oil
   * pressure, and 'DAÑO · reparación obligatoria en boxes' while mandatory repairs are pending,
   * before the meatball comes out.
   */
  showStalled: boolean
  showOilPressure: boolean
  showDamage: boolean
  /** 'ENTRA ESTA VUELTA': the pit window closes on this lap. */
  showBoxThisLap: boolean
  /** 'COMBUSTIBLE · 1.6 V': under two laps of fuel and not enough to finish. */
  showFuelLow: boolean
  /** Keep an alert shown at least this long (s, 0..10) so a flicker is readable. */
  holdS: number
  /** The band's extras (display only): the note after each label, the other alerts' chips. */
  parts: ElementList<AlertsPartId>
}

export interface DeltaOptions {
  /**
   * The reference of each kind of session (sessionKind: practice also covers warmup and testing,
   * qualifying the time trials). A change, by hand or with the cycle shortcut, is applied at the
   * start of the next lap.
   */
  referencePractice: DeltaReference
  referenceQualify: DeltaReference
  referenceRace: DeltaReference
  /**
   * Use the next available reference while the preferred one does not exist: pb -> session ->
   * class, optimal -> pb -> classOptimal, classOptimal -> pb (see DELTA_FALLBACK).
   */
  fallback: boolean
  /** Full scale of the bar in seconds (0.5..3). */
  rangeS: number
  /** The rows in order: the top line, the bar, the sectors, the lap times. */
  rows: ElementList<DeltaRowId>
  /** The top line's parts after the hero number (fixed order). */
  top: ElementList<DeltaTopId>
  /** The lap times line's items, in order. */
  laps: ElementList<DeltaLapId>
}

/**
 * The fuel widget: the fuel left and the laps it lasts are always drawn, every other line is an
 * element. The average and the margin change what is computed (the alerts band uses the average).
 */
export interface FuelOptions {
  /** The header bar (off by default): the widget's name and whatever items you add. */
  headerBar: ElementList<InfoBarEntryId>
  headerBarSize: InfoBarSize
  /** The footer bar under the lines (off by default). */
  footerBar: ElementList<InfoBarEntryId>
  footerBarSize: InfoBarSize
  /** Arrow after the track temperature (the `trackTemp` item). */
  conditionsTrend: boolean
  /** The `wind` item's dial. */
  conditionsWindDirection: boolean
  /**
   * The lines in order: the hero (fuel and laps), the tank gauge, the litres per lap, what to
   * the flag and what to add, the pit window, the saving, the tyres, the repairs and sets left.
   */
  lines: ElementList<FuelLineId>
  /** The pit menu's fuel next to what to add (on the finish line), flagged when it is short. */
  showBox: boolean
  /** Clean laps averaged for the consumption (2..10). */
  avgLaps: number
  /** Laps of fuel to keep at the flag (0..3). */
  marginLaps: number
}

/**
 * The warning lights strip: which lights, in which order, how they are laid out and what goes
 * next to each icon. The layout, the side and the captions are drawing; the rest changes the
 * payload.
 */
export interface LightsOptions {
  /** A row (it wraps when the window is narrower) or a column. */
  layout: 'row' | 'column'
  /** In a column: the side of the icons where the captions and values go. */
  labelSide: 'right' | 'left'
  /** Only the lit lights; the strip hides while none is (instead of the dim dashboard). */
  onlyWhenLit: boolean
  /** A short word after each icon ('AGUA', 'REPARAR'). */
  showCaptions: boolean
  /** The water and oil temperature after their icons ('98°'). */
  showTemps: boolean
  /** How long the repairs take, while lit ('REPARAR · 42 s', 'OPC. · 38 s'). */
  showRepairTime: boolean
  /** The repair times read as the crew's: '42 s (equipo)' (its time, not a real one). */
  repairCrewTag: boolean
  /**
   * Stopped in the stall being serviced, the real seconds left, estimated from how fast the
   * crew's figure falls ('≈ 30 s'); the crew's figure until it is known.
   */
  repairRealTime: boolean
  /** The lights on the strip, in order (a hidden one is not computed). */
  icons: ElementList<LightKind>
  /** The water and oil lights turn yellow while above your own average ('+6°'). */
  showTrend: boolean
}

/**
 * A widget page's "Personalizar" zone, 'section.field' of its element list: the key of its
 * accordion (SettingsWindowOptions.customizeOpen).
 */
export type CustomizeZoneId =
  | 'relative.columns'
  | 'relative.headerBar'
  | 'relative.footerBar'
  | 'radar.parts'
  | 'standings.columns'
  | 'standings.headerBar'
  | 'standings.subheaderBar'
  | 'standings.footerBar'
  | 'standings.classLine'
  | 'battle.headerBar'
  | 'battle.lanes'
  | 'battle.rows'
  | 'battle.parts'
  | 'battle.footerBar'
  | 'inputs.sections'
  | 'inputs.bars'
  | 'inputs.info'
  | 'inputs.car'
  | 'traffic.headerBar'
  | 'traffic.groups'
  | 'traffic.parts'
  | 'traffic.footerBar'
  | 'alerts.parts'
  | 'delta.rows'
  | 'delta.top'
  | 'delta.laps'
  | 'fuel.headerBar'
  | 'fuel.lines'
  | 'fuel.footerBar'
  | 'lights.icons'

/** The settings window's own preferences (nothing else reads them). */
export interface SettingsWindowOptions {
  /** The scene behind the widget previews: a night track or a bright day one. */
  stageScene: 'dark' | 'light'
  /** Which "Personalizar" accordions are open (visible = open), every zone once. */
  customizeOpen: ElementList<CustomizeZoneId>
  /** The hint above a widget page's preview (editing in it) is shown: until you dismiss it. */
  previewHint: boolean
}

/** How the saved layouts change by themselves (settings.savedLayouts holds the layouts). */
export interface LayoutOptions {
  /**
   * Getting in a car model linked to a layout applies that layout (a car without a link keeps
   * the last one used). Off: only the tray, the shortcut and the settings window switch.
   */
  autoSwitch: boolean
  /**
   * The order the settings window lists them in: yours ('custom', the stored order), by name or
   * the latest used first. Display only: the stored order (the tray's, the shortcut's) stays.
   */
  sort: LayoutSort
}

/** LayoutOptions.sort. */
export type LayoutSort = 'custom' | 'name' | 'recent'

/** What a saved layout keeps of one widget: where it is, its size and scale, shown and locked. */
export type LayoutWidget = Pick<WidgetSettings, 'bounds' | 'scale' | 'visible' | 'locked'>

/**
 * What applying a layout restores: 'full' ("Posición y opciones") the places and its own copy of
 * every widget's options; 'position' ("Solo posición") the places only, the widgets keeping the
 * shared options (LayoutLibrary.shared).
 */
export type LayoutMode = 'full' | 'position'

/** A widget's options outside its option section (WIDGET_OPTION_FIELDS in settingsSchema.ts). */
export type WidgetOptionFields = Pick<WidgetSettings, (typeof WIDGET_OPTION_FIELDS)[number]>

/** Every widget's options, as a layout carries them (LAYOUT_SECTIONS in settingsSchema.ts). */
export interface LayoutOptionSet {
  sections: Pick<OverlaySettings, LayoutSection>
  widgets: Record<WidgetId, WidgetOptionFields>
}

/** A named layout ('Principal', 'Mazda MX-5'): every widget's LayoutWidget, and its options. */
export interface SavedLayout {
  /** Stable id ('layout-1'), never shown. */
  id: string
  name: string
  widgets: Record<WidgetId, LayoutWidget>
  mode: LayoutMode
  /**
   * Mode 'full': its own options (main's copy always has them). Never in what the renderers
   * receive (rendererSettings in layouts.ts): they read the options in effect, at the top level.
   */
  options?: LayoutOptionSet
  /**
   * When it last became the one in use (epoch ms): the tray's recent ones. Absent on a layout
   * not used since (older files, imported or duplicated ones), which counts as 0. Never exported.
   */
  usedAt?: number
}

/** A car model as the session names it (DriverInfo CarID and CarScreenName). */
export interface CarRef {
  carId: number
  carName: string
}

/** Getting in `carId` applies `layoutId` (LayoutOptions.autoSwitch). */
export interface CarLayoutLink extends CarRef {
  layoutId: string
}

/**
 * The saved layouts (src/shared/layouts.ts). The active one always equals the widgets' own
 * bounds, scale, visibility and lock (normalisation copies them in), so moving a widget changes
 * the layout in use; applying another copies its fields into the widgets. The options follow the
 * same rule: the top-level option sections are the ones in effect, copied into the active layout
 * (a 'full' one) or into `shared` (a 'position' one is in use).
 */
export interface LayoutLibrary {
  activeId: string
  /** In the user's order (the tray's, the 'next layout' shortcut's). */
  list: SavedLayout[]
  /** One per car model at most. */
  links: CarLayoutLink[]
  /** The car models you got in lately, the latest first (to link one you are not in now). */
  seenCars: CarRef[]
  /**
   * The shared options ("Opciones comunes"), those of every 'position' layout. Main's copy always
   * has them; the renderers receive none (rendererSettings in layouts.ts).
   */
  shared?: LayoutOptionSet
}

export interface OverlaySettings {
  /**
   * 6 gave the layouts their options (an older version drops them: SETTINGS_VERSION); 5 (v2.6)
   * made the licence 'outline' and the pedals auto height (older files are migrated once,
   * recognised by their version); 4 added appearance and per-widget scale/auto-height/visibility
   * rules; v1..v3 files are migrated.
   */
  version: 6
  appearance: AppearanceSettings
  visibility: VisibilityOptions
  widgets: Record<WidgetId, WidgetSettings>
  relative: RelativeOptions
  radar: RadarOptions
  standings: StandingsOptions
  battle: BattleOptions
  inputs: InputsOptions
  traffic: TrafficOptions
  alerts: AlertsOptions
  delta: DeltaOptions
  fuel: FuelOptions
  lights: LightsOptions
  /**
   * Global shortcuts: the first binding of each action, a key combination or a controller's
   * button (main registers the combinations and listens to the buttons; nothing else acts on
   * them). What a version before 2.2 reads.
   */
  shortcuts: ShortcutSettings
  /**
   * Not an option section: each action's bindings after the first one (at most two), unique
   * across every action and slot (shortcuts.ts settleBindings). Absent in older files.
   */
  shortcutsMore: MoreShortcuts
  settingsWindow: SettingsWindowOptions
  layouts: LayoutOptions
  /** Not an option section: changed by the settings window's layout commands only. */
  savedLayouts: LayoutLibrary
  /**
   * Not an option section: the last name seen of each controller a button shortcut uses
   * (controllers.ts id -> 'G29 Driving Force Racing Wheel'), so the page names it while it is
   * unplugged. Written by main alone; absent in older files ({}).
   */
  buttonDeviceNames: Record<string, string>
}

/**
 * Change requested by the settings window. Untrusted: main validates and
 * clamps it (`applySettingsPatch`). Bounds are not patched here; they only
 * change by dragging in edit mode or with the 'reset-widget-bounds' command.
 */
export interface SettingsPatch {
  appearance?: Partial<AppearanceSettings>
  visibility?: Partial<VisibilityOptions>
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
          | 'showOnSessionScreen'
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
  fuel?: Partial<FuelOptions>
  lights?: Partial<LightsOptions>
  /**
   * The first binding of an action ('' removes it: the next one moves up). A combination
   * another action has is refused (the current one is kept).
   */
  shortcuts?: Partial<ShortcutSettings>
  /**
   * Every binding of an action, in order (at most MAX_BINDINGS, [] for none): replaces its
   * current ones. Refused whole (the current ones kept) when one is not valid or another action
   * has it.
   */
  shortcutBindings?: Partial<Record<ShortcutAction, string[]>>
  settingsWindow?: Partial<SettingsWindowOptions>
  layouts?: Partial<LayoutOptions>
}

/** What main tells the telemetry process. */
export interface TelemetryConfig {
  /** Only these widgets are computed and sent. */
  enabledWidgets: WidgetId[]
  /**
   * Visibility rules per widget, evaluated every tick against the current
   * session type and whether the player is on pit road (and the widget's
   * exception to the session-screen rule). A widget hidden by a rule is not
   * computed and its overlay panel is not drawn (except in edit mode).
   */
  rules: Record<
    WidgetId,
    { showIn: ShowInSessions; hideInPits: boolean; showOnSessionScreen: boolean }
  >
  /** The global rules: they hide every widget, before any per-widget rule. */
  visibility: VisibilityOptions
  relative: RelativeOptions
  radar: RadarOptions
  standings: StandingsOptions
  battle: BattleOptions
  inputs: InputsOptions
  traffic: TrafficOptions
  alerts: AlertsOptions
  delta: DeltaOptions
  fuel: FuelOptions
  lights: LightsOptions
}
