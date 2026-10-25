/**
 * Session YAML (WeekendInfo, DriverInfo, SessionInfo, ...) to SessionMeta.
 * Per-tick facts derived from it (player, session type) live in sessionInfo.ts.
 */
import { classColorToCss, licenseColor } from './colors'
import { NO_INCIDENT_LIMITS, parseIncidentLimits } from './incidents/limits'
import { finiteOr } from './num'
import { MAX_CARS } from './telemetry'
import { parseTrackLength } from './trackLength'
import type { DriverEntry, GridEntry, SessionDetails, SessionMeta } from './types'

type Obj = Record<string, unknown>

export const EMPTY_SESSION: SessionMeta = Object.freeze({
  playerCarIdx: -1,
  paceCarIdx: -1,
  driverCarEstLapTime: 0,
  trackLengthM: null,
  trackName: '',
  drivers: new Map<number, DriverEntry>(),
  sessionTypes: new Map<number, string>(),
  sessions: new Map<number, SessionDetails>(),
  subSessionId: 0,
  eventType: '',
  official: false,
  trackNumTurns: 0,
  sectorStarts: Object.freeze([]),
  grid: new Map<number, GridEntry>(),
  teamRacing: false,
  pitSpeedLimitKmh: null,
  trackId: 0,
  trackConfig: '',
  incidentLimits: NO_INCIDENT_LIMITS
})

/** Sector starts closer than this (lap fraction, ~7 mm on a 7 km track) are the same line. */
const SECTOR_EPSILON = 1e-6

const KMH_PER_MPH = 1.609344
/** No pit lane is faster than this (km/h): anything above is a corrupt value. */
const MAX_PIT_LIMIT_KMH = 300
/** Number with an optional comma or dot decimal, then an optional speed unit (km/h by default). */
const PIT_LIMIT_RE = /^(\d+(?:[.,]\d+)?)\s*(kph|km\/h|kmh|mph)?$/i

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function objAt(o: Obj | null, key: string): Obj | null {
  const v = o?.[key]
  return isObj(v) ? v : null
}

function arrAt(o: Obj | null, key: string): readonly unknown[] {
  const v = o?.[key]
  return Array.isArray(v) ? v : []
}

function carIdxOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < MAX_CARS ? v : fallback
}

function positiveOr0(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0
}

function isNonNegInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0
}

function nonNegIntOr0(v: unknown): number {
  return isNonNegInt(v) ? v : 0
}

/** Scalars as text: YAML may turn a name into a number or boolean. Objects -> ''. */
function text(v: unknown): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v)
  // A name like "2024-01-01" becomes a Date with js-yaml's default schema.
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const iso = v.toISOString()
    return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso
  }
  return ''
}

/** irsdk 0/1 int flags (be lenient with true and "1"). */
function flag(v: unknown): boolean {
  return v === 1 || v === true || v === '1'
}

/** SessionLaps: 20 or "20" -> 20; "unlimited", 0 and anything else -> null. */
function parseLaps(v: unknown): number | null {
  const n = typeof v === 'string' && /^\s*\d+\s*$/.test(v) ? Number(v) : v
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 ? n : null
}

/** SessionTime: "3600.0000 sec" (or a bare number) -> 3600; "unlimited" and anything else -> null. */
function parseTimeS(v: unknown): number | null {
  let n: unknown = v
  if (typeof v === 'string') {
    const m = /^\s*(\d+(?:\.\d+)?)\s*(?:s|secs?|seconds?)?\s*$/i.exec(v)
    n = m ? Number(m[1]) : null
  }
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null
}

/**
 * iRacing fills AI cars, and every driver of an offline session (AI races,
 * offline testing), with placeholder ratings: iRating 0 or 1 and licence
 * R 0.00 / R 0.01. No real driver has those (a new member starts at 1350 and
 * R 2.50), so they read as unknown and the widgets hide them, like any
 * missing rating, instead of showing "R 0.0" and a field of strength 1.
 */
const PLACEHOLDER_LICENCE = /^R\s*0\.0[01]$/i

function hasPlaceholderLicence(d: Obj, iRating: number): boolean {
  if (flag(d.CarIsAI)) return true
  return iRating <= 1 && PLACEHOLDER_LICENCE.test(text(d.LicString).trim())
}

function parseDriver(d: Obj, carIdx: number): DriverEntry {
  const rawIRating = finiteOr(d.IRating, 0)
  const placeholder = hasPlaceholderLicence(d, rawIRating)
  const licString = !placeholder && typeof d.LicString === 'string' ? d.LicString : ''
  return {
    carIdx,
    userName: text(d.UserName),
    teamName: text(d.TeamName),
    carNumber: text(d.CarNumber),
    // No real driver has an iRating of 0 or 1 (new members start at 1350).
    iRating: flag(d.CarIsAI) || rawIRating <= 1 ? 0 : rawIRating,
    licString,
    licColor: placeholder ? null : licenseColor(licString, d.LicColor),
    classId: typeof d.CarClassID === 'number' && Number.isInteger(d.CarClassID) ? d.CarClassID : -1,
    classShortName: text(d.CarClassShortName) || text(d.CarScreenNameShort),
    classColor: classColorToCss(d.CarClassColor),
    classEstLapTime: positiveOr0(d.CarClassEstLapTime),
    isPaceCar: flag(d.CarIsPaceCar),
    isSpectator: flag(d.IsSpectator),
    licLevel: placeholder ? 0 : nonNegIntOr0(d.LicLevel),
    licSubLevel: placeholder ? 0 : nonNegIntOr0(d.LicSubLevel),
    classRelSpeed: positiveOr0(d.CarClassRelSpeed),
    userId: nonNegIntOr0(d.UserID),
    teamId: nonNegIntOr0(d.TeamID),
    carId: nonNegIntOr0(d.CarID),
    carName: text(d.CarScreenName) || text(d.CarScreenNameShort),
    isAI: flag(d.CarIsAI)
  }
}

/**
 * WeekendInfo.TrackPitSpeedLimit ('72.00 kph', '45.00 mph'; a bare number is
 * km/h) in km/h rounded to 0.01; null when missing, unparseable, 0 or above
 * MAX_PIT_LIMIT_KMH.
 */
function parsePitSpeedLimit(v: unknown): number | null {
  let kmh: number
  if (typeof v === 'number') {
    kmh = v
  } else if (typeof v === 'string') {
    const m = PIT_LIMIT_RE.exec(v.trim())
    if (!m || m[1] === undefined) return null
    const value = Number(m[1].replace(',', '.'))
    kmh = m[2]?.toLowerCase() === 'mph' ? value * KMH_PER_MPH : value
  } else {
    return null
  }
  if (!Number.isFinite(kmh) || kmh <= 0 || kmh > MAX_PIT_LIMIT_KMH) return null
  return Math.round(kmh * 100) / 100
}

/**
 * Ascending, deduplicated SectorStartPct values in [0, 1), starting at 0
 * (1 is the start/finish line, i.e. 0). Empty when there is no valid one.
 */
function parseSectorStarts(splitTimeInfo: Obj | null): number[] {
  const pcts: number[] = []
  for (const s of arrAt(splitTimeInfo, 'Sectors')) {
    if (!isObj(s)) continue
    const p = s.SectorStartPct
    if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) continue
    pcts.push(p === 1 ? 0 : p)
  }
  if (pcts.length === 0) return []
  pcts.sort((a, b) => a - b)
  const out = [0]
  let last = 0
  for (const p of pcts) {
    if (p - last > SECTOR_EPSILON) {
      out.push(p)
      last = p
    }
  }
  return out
}

/** Results with 0-based Position/ClassPosition (as iRacing writes them) -> 1-based grid by CarIdx. */
function parseGridEntries(results: readonly unknown[]): Map<number, GridEntry> {
  const grid = new Map<number, GridEntry>()
  for (const r of results) {
    if (!isObj(r)) continue
    const carIdx = carIdxOr(r.CarIdx, -1)
    if (carIdx < 0 || grid.has(carIdx)) continue
    if (!isNonNegInt(r.Position) || !isNonNegInt(r.ClassPosition)) continue
    grid.set(carIdx, { position: r.Position + 1, classPosition: r.ClassPosition + 1 })
  }
  return grid
}

/**
 * QualifyResultsInfo.Results; when that gives nothing, the QualifyPositions
 * of the last Race session that has any (assumed 0-based as well).
 */
function parseGrid(root: Obj | null, rawSessions: readonly unknown[]): Map<number, GridEntry> {
  const grid = parseGridEntries(arrAt(objAt(root, 'QualifyResultsInfo'), 'Results'))
  if (grid.size > 0) return grid
  for (let i = rawSessions.length - 1; i >= 0; i--) {
    const s = rawSessions[i]
    if (!isObj(s) || text(s.SessionType) !== 'Race') continue
    const fallback = parseGridEntries(arrAt(s, 'QualifyPositions'))
    if (fallback.size > 0) return fallback
  }
  return grid
}

/**
 * Session YAML object (irsdk-node getSessionData() or parseSessionYaml())
 * to SessionMeta. Never throws: missing or mistyped fields get defaults.
 * DriverEntry.classId is -1 when CarClassID is missing.
 */
export function parseSessionMeta(raw: unknown): SessionMeta {
  const root = isObj(raw) ? raw : null
  const weekend = objAt(root, 'WeekendInfo')
  const driverInfo = objAt(root, 'DriverInfo')
  const sessionInfo = objAt(root, 'SessionInfo')

  const drivers = new Map<number, DriverEntry>()
  for (const d of arrAt(driverInfo, 'Drivers')) {
    if (!isObj(d)) continue
    const carIdx = carIdxOr(d.CarIdx, -1)
    if (carIdx >= 0) drivers.set(carIdx, parseDriver(d, carIdx))
  }

  const rawSessions = arrAt(sessionInfo, 'Sessions')
  const sessionTypes = new Map<number, string>()
  const sessions = new Map<number, SessionDetails>()
  for (const s of rawSessions) {
    if (!isObj(s)) continue
    const num = s.SessionNum
    if (!isNonNegInt(num)) continue
    const type = text(s.SessionType)
    if (type !== '') sessionTypes.set(num, type)
    sessions.set(num, {
      type,
      name: text(s.SessionName),
      laps: parseLaps(s.SessionLaps),
      timeS: parseTimeS(s.SessionTime)
    })
  }

  return {
    playerCarIdx: carIdxOr(driverInfo?.DriverCarIdx, -1),
    paceCarIdx: carIdxOr(driverInfo?.PaceCarIdx, -1),
    driverCarEstLapTime: positiveOr0(driverInfo?.DriverCarEstLapTime),
    trackLengthM: parseTrackLength(weekend?.TrackLength),
    trackName: text(weekend?.TrackDisplayName) || text(weekend?.TrackName),
    drivers,
    sessionTypes,
    sessions,
    subSessionId: nonNegIntOr0(weekend?.SubSessionID),
    eventType: text(weekend?.EventType),
    official: flag(weekend?.Official),
    trackNumTurns: nonNegIntOr0(weekend?.TrackNumTurns),
    sectorStarts: parseSectorStarts(objAt(root, 'SplitTimeInfo')),
    grid: parseGrid(root, rawSessions),
    teamRacing: flag(weekend?.TeamRacing),
    pitSpeedLimitKmh: parsePitSpeedLimit(weekend?.TrackPitSpeedLimit),
    trackId: nonNegIntOr0(weekend?.TrackID),
    // A track without layouts writes `TrackConfigName:` (null): ''.
    trackConfig: text(weekend?.TrackConfigName).trim(),
    incidentLimits: parseIncidentLimits(weekend?.WeekendOptions)
  }
}
