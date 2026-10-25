/**
 * Estimated Safety Rating projection (unofficial: iRacing does not publish the
 * formula; show it as an estimate).
 *
 * Port of Nishizumi SR (MIT, (c) 2026 Maho Nishizumi,
 * https://github.com/nishizumi-maho/Nishizumi-SR): docs/MODEL.md and
 * docs/integration/nishizumi-sr.js, kept literal where it matters. The hidden
 * state is CPI (corners per incident); SR is a rendering of it:
 *   S = b + a ln(P / Φ),  Φ = Φ0 r^(κ + b)
 * and a session blends its incident rate into 1/P with α = 1 - e^(-c/W).
 *
 * Deliberate differences from the JS port (see the functions):
 * - "Lone" practice/qualify sessions get their 0.35 weight (the JS classifier
 *   maps them to the open 0.5 although its own weight table has 0.35).
 * - No corners driven means no change (the JS would re-render a 3.00 read on
 *   band 2 into band 3 before a single corner).
 * - The start band comes from LicLevel unless the SR is outside it (LicLevel
 *   cannot express band 0, SR < 1.00).
 * - Fast-track promotion (not in the JS) is projected; see projectSafetyRating.
 */
import type { SafetyRatingProjection } from '../types'

export interface SafetyRatingInput {
  /** DriverInfo LicLevel (1..24). */
  licLevel: number
  /** LicSubLevel (SR x 100). */
  licSubLevel: number
  /** Incidents this session (PlayerCarMyIncidentCount). */
  incidents: number
  /** Corners completed this session (TrackNumTurns x laps driven). */
  corners: number
  /** SessionType of the current session ("Race", "Practice", ...). */
  sessionType: string
}

// Fitted constants (MODEL.md section 8). Not tuning knobs.
const A_SLOPE = 1.5236
const R_RATIO = 1.4562
const F0_CPI = 3.4949
const WINDOW_BAND1 = 1060
/** sqrt(2) to the precision that was fitted (the JS uses this, not Math.SQRT2). */
const WINDOW_BAND_RATIO = 1.4142
const WINDOW_FACTOR_ROOKIE = 0.69
const WINDOW_FACTOR_CLASS_D = 0.83
const MAX_ABS_SESSION_DELTA = 3
const BAND_MIN = 0
const BAND_MAX = 4
const SR_DISPLAY_MAX = 4.99 // Sporting Code 3.7.2
const PROJECTED_MAX = 5

/** Licence class index: 0 R, 1 D, 2 C, 3 B, 4 A, 5 Pro. */
export const LICENSE_CLASS_LETTERS = ['R', 'D', 'C', 'B', 'A', 'P'] as const

const EPS = 1e-9
const MAX_BUDGET_STEPS = 10_000

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value))
}

/** LicLevel (1..24) -> class index and whole-number SR band (1..4), null when out of range. */
export function licenseFromLevel(licLevel: number): { licClass: number; band: number } | null {
  if (!Number.isFinite(licLevel)) return null
  const level = Math.trunc(licLevel)
  if (level < 1 || level > 24) return null
  return { licClass: Math.floor((level - 1) / 4), band: ((level - 1) % 4) + 1 }
}

/** CPI at the floor of a band: the exact CPI of e.g. "3.00". */
function bandFloorCpi(licClass: number, band: number): number {
  return F0_CPI * Math.pow(R_RATIO, licClass + band)
}

/** Displayed SR of a CPI inside a specific band (no remapping). */
function srFromCpi(cpi: number, licClass: number, band: number): number {
  if (cpi <= 0) return band
  return band + A_SLOPE * Math.log(cpi / bandFloorCpi(licClass, band))
}

/** The CPI behind a displayed SR (step 1 of the model). */
export function cpiFromSr(sr: number, licClass: number, band: number = Math.floor(sr)): number {
  const b = clamp(band, BAND_MIN, BAND_MAX)
  return bandFloorCpi(licClass, b) * Math.exp((sr - b) / A_SLOPE)
}

/** CPI needed to hold `sr` (3.00 by default) in a licence class. */
export function cpiToHold(licClass: number, sr = 3): number {
  return cpiFromSr(sr, licClass, Math.floor(sr))
}

/**
 * Overlapping-band rule (Sporting Code 3.7.4, step 3): while the SR falls
 * outside [band, band + 1) the same CPI is re-rendered in the neighbouring
 * band. The documented "+0.40" on crossing a whole number falls out of this
 * (0.427); never add it on top.
 */
function remapBand(cpi: number, licClass: number, band: number): { sr: number; band: number } {
  let b = clamp(Math.trunc(band), BAND_MIN, BAND_MAX)
  for (let i = 0; i < 8; i++) {
    const sr = srFromCpi(cpi, licClass, b)
    if (sr >= b + 1 && b < BAND_MAX) {
      b++
      continue
    }
    if (sr < b && b > BAND_MIN) {
      b--
      continue
    }
    return { sr: clamp(sr, 0, SR_DISPLAY_MAX), band: b }
  }
  return { sr: clamp(srFromCpi(cpi, licClass, b), 0, SR_DISPLAY_MAX), band: b }
}

/** EMA decay constant in corners: longer memory at higher bands, shorter for R and D. */
function windowCorners(band: number, licClass: number): number {
  let factor = 1
  if (licClass <= 0) factor = WINDOW_FACTOR_ROOKIE
  else if (licClass === 1) factor = WINDOW_FACTOR_CLASS_D
  return WINDOW_BAND1 * Math.pow(WINDOW_BAND_RATIO, Math.max(0, Math.trunc(band) - 1)) * factor
}

/** Applies one session to the CPI; corners and incidents already carry the session weight. */
function updateCpi(
  cpiOld: number,
  corners: number,
  incidents: number,
  band: number,
  licClass: number
): number {
  if (corners <= 0 || cpiOld <= 0) return cpiOld
  const alpha = 1 - Math.exp(-corners / Math.max(1, windowCorners(band, licClass)))
  const rate = (1 - alpha) / cpiOld + (alpha * incidents) / corners
  if (rate <= 1e-9) return 1e9
  return 1 / rate
}

/** Result of one session in the driver's current class. */
export interface SrProjection {
  sr: number
  delta: number
  cpi: number
  band: number
}

/**
 * Full estimate for a session in the current class (the JS `projectSr`).
 * `corners` and `incidents` must already carry the session weight.
 */
export function projectSr(
  srBefore: number,
  licClass: number,
  corners: number,
  incidents: number,
  band: number = Math.floor(srBefore)
): SrProjection {
  const cpiOld = cpiFromSr(srBefore, licClass, band)
  const cpi = updateCpi(cpiOld, corners, incidents, band, licClass)
  const remapped = remapBand(cpi, licClass, band)
  let sr = remapped.sr
  let delta = sr - srBefore
  if (Math.abs(delta) > MAX_ABS_SESSION_DELTA) {
    delta = clamp(delta, -MAX_ABS_SESSION_DELTA, MAX_ABS_SESSION_DELTA)
    sr = srBefore + delta
  }
  return { sr, delta, cpi, band: remapped.band }
}

/**
 * Sporting Code 3.6.1.1 corner AND incident multiplier for a raw SessionType;
 * 0 for types that do not count. Substring matching on purpose (no closed list).
 * "Testing" counts as open practice, as in the JS port.
 */
export function sessionWeight(sessionType: string): number {
  const s = sessionType.toLowerCase()
  const lone = s.includes('lone')
  if (s.includes('time trial')) return 0.35
  if (s.includes('practice') || s.includes('testing')) return lone ? 0.35 : 0.5
  if (s.includes('qualify')) return lone ? 0.35 : 0.5
  if (s.includes('warmup') || s.includes('warm up') || s.includes('warm-up')) return 0.5
  if (s.includes('race') || s.includes('heat')) return 1
  return 0
}

/**
 * Start band: LicLevel's, which is right on rounding boundaries (an SR of 3.00
 * still on band 2), unless the SR is clearly outside it.
 */
function startBand(sr: number, levelBand: number): number {
  if (sr >= levelBand && sr < levelBand + 1.005) return levelBand
  return clamp(Math.floor(sr), BAND_MIN, BAND_MAX)
}

/** Fast-track threshold for the next class: R at 3.00, D/C/B at 4.00; none for A and Pro. */
function fastTrackThreshold(licClass: number): number | null {
  if (licClass === 0) return 3
  if (licClass >= 1 && licClass <= 3) return 4
  return null
}

function round2(x: number): number {
  return Math.round(x * 100) / 100
}

/**
 * Projected SR if the session ended now, null when the inputs are unknown.
 *
 * A fast-track crossing this session (R reaching 3.00, D/C/B reaching 4.00)
 * projects the promotion, assuming the participation requirement (not in the
 * SDK) is met: the class letter goes up and the same CPI is rendered in the
 * new class (about 1.00 lower, MODEL.md 4.2). `projected` is rounded to 0.01;
 * `corners` is reported in whole corners. `incidentBudget` is measured in the
 * current class: the session's own CPI must stay at or above the current CPI.
 */
export function projectSafetyRating(input: SafetyRatingInput): SafetyRatingProjection | null {
  const license = licenseFromLevel(input.licLevel)
  if (license === null) return null
  if (!Number.isFinite(input.licSubLevel) || input.licSubLevel <= 0) return null
  const weight = sessionWeight(input.sessionType)
  if (weight <= 0) return null

  const { licClass } = license
  const current = input.licSubLevel / 100
  const band = startBand(current, license.band)
  const corners = Number.isFinite(input.corners) && input.corners > 0 ? input.corners : 0
  const incidents = Number.isFinite(input.incidents) && input.incidents > 0 ? input.incidents : 0
  const weightedCorners = corners * weight
  const cpiNow = cpiFromSr(current, licClass, band)

  const project = (inc: number): SrProjection =>
    weightedCorners > 0
      ? projectSr(current, licClass, weightedCorners, inc * weight, band)
      : { sr: current, delta: 0, cpi: cpiNow, band }
  const result = project(incidents)

  let projected = clamp(result.sr, 0, PROJECTED_MAX)
  let projectedClass = licClass
  const threshold = fastTrackThreshold(licClass)
  if (threshold !== null && current < threshold && projected >= threshold - EPS) {
    projectedClass = licClass + 1
    projected = remapBand(result.cpi, projectedClass, result.band).sr
  }

  return {
    current,
    projected: round2(projected),
    licClass: LICENSE_CLASS_LETTERS[licClass] ?? '',
    projectedLicClass: LICENSE_CLASS_LETTERS[projectedClass] ?? '',
    incidents,
    corners: Math.floor(corners),
    incidentBudget: incidentBudget(current, cpiNow, incidents, corners, project)
  }
}

function incidentBudget(
  current: number,
  cpiNow: number,
  incidents: number,
  corners: number,
  project: (inc: number) => SrProjection
): number {
  if (corners <= 0) return 0
  const holds = (inc: number): boolean => project(inc).sr >= current - EPS
  if (!holds(incidents)) return 0
  // Holding SR <=> session CPI >= current CPI (the weight cancels out); the
  // closed form is then nudged against the real projection for float edges.
  let k = Math.max(0, Math.floor(corners / cpiNow) - incidents)
  let steps = 0
  while (k > 0 && !holds(incidents + k) && steps++ < MAX_BUDGET_STEPS) k--
  while (holds(incidents + k + 1) && steps++ < MAX_BUDGET_STEPS) k++
  return k
}
