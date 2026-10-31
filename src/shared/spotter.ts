/**
 * Spotter (2.4): the cars at your sides as two pillars. Each side carries what both bar styles
 * draw: how close the nearest car on that side is (`close`, the radar's own rule: «Cercanía», the
 * default) and, for «Dónde te cubre», the pillar as your car from its front (top) to its rear
 * (bottom). iRacing's own spotter (CarLeftRight) decides the sides and
 * how many cars: the radar's matching (radar.ts computeRadar) puts real cars on them, and their
 * distance along the track (CarIdxLapDistPct x the track length, the start/finish line wrapped)
 * says how much of your car each one covers, pinned to the end it is at. There is no lateral
 * distance in the SDK: a full pillar is a car completely beside you, not contact.
 *
 * The spotter runs its own radar pass with its own memory (the radar widget may be hidden, or set
 * to another range), so a car keeps its side for RADAR.sideHoldS after the overlap ends: that is
 * the cap of a car about to come alongside again. Pure but for that memory; runs at 60 Hz.
 */
import { clamp01 } from './num'
import { RADAR, computeRadar } from './radar'
import { OPTION_SCHEMA } from './settingsSchema'
import { CarLeftRight } from './telemetry'
import type { TelemetryFrame } from './telemetry'
import type {
  RadarData,
  RadarOptions,
  SessionMeta,
  SpotterData,
  SpotterSegment,
  SpotterSide
} from './types'

export const SPOTTER = {
  /** Fill steps over a car length: the payload changes at most this often in a whole pass. */
  steps: 50,
  /** Steps of the near caps (tenths). */
  nearSteps: 10,
  /**
   * The least of your car a car iRacing counts alongside covers, so a touch of overlap (or a car
   * iRacing counts a little beyond a car length) still shows on its end of the pillar.
   */
  minCover: 0.08,
  /** Your car's length and the other cars' (m): the radar's. */
  carLengthM: RADAR.carLengthM,
  /** The near cap reaches this far (m, along the track): the radar's side memory. */
  nearM: RADAR.sideHoldMaxM
} as const

/** The radar pass the spotter asks for: the side memory's reach (its layers are not read). */
const RADAR_OPTS: RadarOptions = {
  rangeM: SPOTTER.nearM,
  parts: OPTION_SCHEMA.radar.parts.default.map((e) => ({ ...e }))
}

function quantise(v: number, steps: number): number {
  return Math.round(clamp01(v) * steps) / steps
}

/**
 * The stretch of your car (0 front .. 1 rear) a car `distM` metres ahead (negative: behind)
 * covers, at least SPOTTER.minCover, pinned to the end it is at. Quantised.
 */
export function overlapSegment(distM: number): SpotterSegment {
  const d = distM / SPOTTER.carLengthM
  let from = clamp01(-d)
  let to = clamp01(1 - d)
  if (to - from < SPOTTER.minCover) {
    if (d >= 0) {
      from = 0
      to = Math.max(to, SPOTTER.minCover)
    } else {
      to = 1
      from = Math.min(from, 1 - SPOTTER.minCover)
    }
  }
  return { from: quantise(from, SPOTTER.steps), to: quantise(to, SPOTTER.steps) }
}

/** Segments sorted front first, the ones that touch or overlap merged. */
function mergeSegments(segs: SpotterSegment[]): SpotterSegment[] {
  if (segs.length < 2) return segs
  segs.sort((a, b) => a.from - b.from)
  const out: SpotterSegment[] = []
  for (const s of segs) {
    const last = out[out.length - 1]
    if (last !== undefined && s.from <= last.to) last.to = Math.max(last.to, s.to)
    else out.push({ ...s })
  }
  return out
}

/** 0 (SPOTTER.nearM away) .. 1 (a car length or closer), unquantised: the radar's proximity. */
function proximity(absM: number): number {
  const span = SPOTTER.nearM - SPOTTER.carLengthM
  return clamp01(1 - (absM - SPOTTER.carLengthM) / span)
}

/** The near caps' step (tenths). */
function nearness(absM: number): number {
  return quantise(proximity(absM), SPOTTER.nearSteps)
}

/**
 * How close a car held on its side is (`close`): the radar's proximity over the spotter's reach,
 * quantised to SPOTTER.steps.
 */
export function closeness(absM: number): number {
  return quantise(proximity(absM), SPOTTER.steps)
}

/** A side with nothing on it: one shared object, so a quiet pass allocates none. */
const EMPTY_SIDE: SpotterSide = Object.freeze({
  count: 0,
  segs: Object.freeze([]) as unknown as SpotterSegment[],
  cover: 0,
  unknown: false,
  nearFront: 0,
  nearRear: 0,
  close: 0
}) as SpotterSide

/** The payload out of the car or with iRacing's spotter off: shared, never changed. */
const INACTIVE: SpotterData = Object.freeze({
  active: false,
  visible: false,
  left: EMPTY_SIDE,
  right: EMPTY_SIDE
}) as SpotterData

/** One side (`left`: lanes < 0) of a radar pass; EMPTY_SIDE with nobody there. */
function sideOf(radar: RadarData, left: boolean): SpotterSide {
  const count = left ? radar.leftCount : radar.rightCount
  let side: SpotterSide | null = null
  let segs: SpotterSegment[] | null = null
  for (const car of radar.cars) {
    if (car.lane === 0 || car.lane < 0 !== left) continue
    if (car.overlapping) {
      if (count === 0) continue
      side ??= { ...EMPTY_SIDE, count, segs: [] }
      if (car.carIdx < 0 || !radar.trackLengthKnown) side.unknown = true
      else (segs ??= []).push(overlapSegment(car.distM))
    } else {
      // A car that was alongside, held on its side: about to come alongside again (or leaving).
      const abs = Math.abs(car.distM)
      const c = closeness(abs)
      if (c <= 0) continue
      side ??= { ...EMPTY_SIDE, count, segs: [] }
      side.close = Math.max(side.close, c)
      const n = nearness(abs)
      if (car.distM >= 0) side.nearFront = Math.max(side.nearFront, n)
      else side.nearRear = Math.max(side.nearRear, n)
    }
  }
  if (count > 0) side ??= { ...EMPTY_SIDE, count, segs: [] }
  if (side === null) return EMPTY_SIDE
  // Alongside is as close as it gets, whether or not a car could be placed: the radar's 1.
  if (count > 0) side.close = 1
  if (segs !== null) side.segs = mergeSegments(segs)
  let cover = 0
  for (const s of side.segs) cover += s.to - s.from
  side.cover = side.unknown ? 1 : quantise(cover, SPOTTER.steps)
  return side
}

/** The spotter's payload from a radar pass; `onTrack`: IsOnTrack (you are driving). */
export function spotterFromRadar(radar: RadarData, onTrack: boolean): SpotterData {
  const active = onTrack && radar.carLeftRight !== CarLeftRight.Off
  if (!active) return INACTIVE
  const left = sideOf(radar, true)
  const right = sideOf(radar, false)
  const busy = (s: SpotterSide): boolean => s.count > 0 || s.close > 0
  return { active, visible: busy(left) || busy(right), left, right }
}

/**
 * The spotter's provider: its own radar pass and memory. A `prev` of null (a new session, a
 * reconnect, a rule that hid it) starts the memory over, as the radar's does.
 */
export class SpotterProvider {
  private radar: RadarData | null = null

  compute(frame: TelemetryFrame, session: SessionMeta, prev: SpotterData | null): SpotterData {
    if (prev === null) this.radar = null
    const radar = computeRadar(frame, session, RADAR_OPTS, this.radar)
    this.radar = radar
    return spotterFromRadar(radar, frame.IsOnTrack[0] === true)
  }

  reset(): void {
    this.radar = null
  }
}

/** Two sides that draw the same. */
export function spotterSideEqual(a: SpotterSide, b: SpotterSide): boolean {
  if (
    a.count !== b.count ||
    a.cover !== b.cover ||
    a.unknown !== b.unknown ||
    a.nearFront !== b.nearFront ||
    a.nearRear !== b.nearRear ||
    a.close !== b.close ||
    a.segs.length !== b.segs.length
  ) {
    return false
  }
  for (let i = 0; i < a.segs.length; i++) {
    const x = a.segs[i]
    const y = b.segs[i]
    if (x === undefined || y === undefined || x.from !== y.from || x.to !== y.to) return false
  }
  return true
}

/** Two payloads that draw the same (quantised): the loop does not re-send it. */
export function spotterEqual(a: SpotterData, b: SpotterData): boolean {
  return (
    a.active === b.active &&
    a.visible === b.visible &&
    spotterSideEqual(a.left, b.left) &&
    spotterSideEqual(a.right, b.right)
  )
}
