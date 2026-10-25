/**
 * Proximity radar: cars alongside the player (per CarLeftRight) in side lanes, other cars within
 * range ahead/behind in the player's lane, except cars that were alongside within the last
 * RADAR.sideHoldS, which keep their side lane. Pure function of one tick plus the previous
 * payload, which is only used as side-lane memory and for visibility hysteresis. Runs at 60 Hz.
 */
import { isValidPct, wrapPctDelta } from './lapDist'
import { clamp01 } from './num'
import { resolvePlayerCarIdx } from './sessionInfo'
import { OPTION_SCHEMA, clampOption } from './settingsSchema'
import { CarLeftRight, MAX_CARS, TrackLocation } from './telemetry'
import type { TelemetryFrame } from './telemetry'
import type { RadarCar, RadarData, RadarLane, RadarOptions, SessionMeta } from './types'

export const RADAR = {
  /** Cars this close (m, along the track) can be the ones CarLeftRight reports alongside. */
  overlapM: 5.5,
  /**
   * Cars this close are candidates for the side lanes CarLeftRight reports. Nearest-first, this
   * is an overlapM pool widened when it holds fewer cars than reported.
   */
  overlapSearchM: 8,
  carLengthM: 4.6,
  minRangeM: OPTION_SCHEMA.radar.rangeM.min,
  maxRangeM: OPTION_SCHEMA.radar.rangeM.max,
  /**
   * Lane-0 cars between (1 - edgeFadeFrac) * rangeM and rangeM fade out linearly in the widget.
   * The panel shows once a car is halfway through that band (~50% opacity) and hides once one is
   * three quarters through it (~25%), so it neither shows for an almost invisible car nor blinks
   * as a car hovers around the edge.
   */
  edgeFadeFrac: 0.2,
  /**
   * A car that was alongside keeps its side lane, as a car no longer overlapping, for this long
   * (s of SessionTime) after CarLeftRight stops counting it: iRacing gives no lateral data then,
   * and the car is usually still beside the player, just ahead or behind (irDashies' memory).
   */
  sideHoldS: 3,
  /** ... while it is this close (m, along the track): further away its side no longer matters. */
  sideHoldMaxM: 12
} as const

/** Float slack when checking that a hold does not end more than RADAR.sideHoldS ahead. */
const HOLD_EPS_S = 1e-3
const PHANTOM_CLASS_COLOR = '#ffffff'
/** Phantom fill order: inner lane first on each side. */
const SIDE_LANES: readonly RadarLane[] = [-1, -2, 1, 2]

type SideCount = 0 | 1 | 2

/** Cars alongside on each side for a raw CarLeftRight value. Off, Clear and unknown are 0/0. */
export function sideCounts(carLeftRight: number): { left: SideCount; right: SideCount } {
  switch (carLeftRight) {
    case CarLeftRight.CarLeft:
      return { left: 1, right: 0 }
    case CarLeftRight.CarRight:
      return { left: 0, right: 1 }
    case CarLeftRight.CarLeftRight:
      return { left: 1, right: 1 }
    case CarLeftRight.Cars2Left:
      return { left: 2, right: 0 }
    case CarLeftRight.Cars2Right:
      return { left: 0, right: 2 }
    default:
      return { left: 0, right: 0 }
  }
}

// One string per integer hue, so the 60 Hz loop does not build colour strings.
const HUE_COLORS: readonly string[] = Array.from({ length: 121 }, (_, h) => `hsl(${h} 90% 55%)`)

/** Green (0, edge of range) -> yellow -> red (1, touching). Input is clamped to [0, 1]. */
export function proximityColor(proximity: number): string {
  const hue = Math.round(120 * (1 - clamp01(proximity)))
  return HUE_COLORS[hue] ?? `hsl(${hue} 90% 55%)`
}

function laneBit(lane: RadarLane): number {
  return lane === 0 ? 0 : 1 << (lane + 2)
}

/** Mask of the side lanes CarLeftRight demands. */
function demandedLanes(left: SideCount, right: SideCount): number {
  let lanes = 0
  if (left > 0) lanes |= laneBit(-1)
  if (left > 1) lanes |= laneBit(-2)
  if (right > 0) lanes |= laneBit(1)
  if (right > 1) lanes |= laneBit(2)
  return lanes
}

/** Inner-most free lane of a side in the `free` mask, 0 when that side has none. */
function firstFreeLane(free: number, left: boolean): RadarLane {
  if (left) return free & laneBit(-1) ? -1 : free & laneBit(-2) ? -2 : 0
  return free & laneBit(1) ? 1 : free & laneBit(2) ? 2 : 0
}

/** `lane` when free, else the other free lane of its side, else 0. Never the opposite side. */
function sameSideLane(free: number, lane: RadarLane): RadarLane {
  return free & laneBit(lane) ? lane : firstFreeLane(free, lane < 0)
}

/**
 * The car's entry in `prev` when it had a side lane there: alongside (overlapping) or held after
 * the overlap ended (not overlapping).
 */
function prevSideCar(prev: RadarData | null, carIdx: number): RadarCar | undefined {
  if (prev === null) return undefined
  for (const car of prev.cars) if (car.carIdx === carIdx && car.lane !== 0) return car
  return undefined
}

/**
 * The car's side-lane entry in `prev` while its hold runs at `now`. A hold ending more than
 * RADAR.sideHoldS after `now` means SessionTime went back (new session, replay): no hold.
 */
function heldPrevCar(prev: RadarData, carIdx: number, now: number): RadarCar | undefined {
  const p = prevSideCar(prev, carIdx)
  const until = p?.sideHoldUntil
  return until !== undefined && now < until && until - now <= RADAR.sideHoldS + HOLD_EPS_S
    ? p
    : undefined
}

/**
 * Lane of a car without history when CarLeftRight reports one car on each side and both lanes
 * (`l`, `r`) are free: iRacing does not say which car is where. The next candidate decides: a
 * held car keeps its side, so this one takes the other; else, an arbitrary rule that is stable
 * while their order holds, the car further ahead goes left.
 */
function splitLane(
  cars: readonly RadarCar[],
  from: number,
  n: number,
  prev: RadarData | null,
  car: RadarCar,
  l: RadarLane,
  r: RadarLane
): RadarLane {
  for (let i = from; i < n; i++) {
    const other = cars[i]
    if (other === undefined || other.lane !== 0) continue
    const p = prevSideCar(prev, other.carIdx)
    if (p === undefined) return other.distM > car.distM ? r : l
    if (!p.overlapping) return p.lane < 0 ? r : l
    // Alongside last tick but no lane on its side now: it cannot take either lane.
  }
  return l
}

/**
 * Puts candidates `cars[0..n)` (sorted nearest first) in the `demanded` side lanes, at most one
 * per lane, marks them overlapping and returns the mask of demanded lanes left empty.
 * Pass 1: a car alongside in `prev` keeps its lane (or the other lane of that side) while that
 * side is demanded, so a nearer drafting car cannot steal its slot. It never moves to the opposite
 * side: with its side not demanded or full it stays in lane 0. Pass 2 fills the rest nearest first:
 * cars without history inner lanes first, held cars (side lane in `prev` but no longer alongside)
 * only on their own side. A held car is a weaker claim than a car alongside last tick: when
 * CarLeftRight counts a side again it may be the held car back or a new one, so the nearer wins.
 */
function assignSideLanes(
  cars: readonly RadarCar[],
  n: number,
  demanded: number,
  prev: RadarData | null
): number {
  let free = demanded

  if (prev !== null && prev.cars.length > 0) {
    for (let i = 0; i < n && free !== 0; i++) {
      const car = cars[i]
      if (car === undefined) continue
      const p = prevSideCar(prev, car.carIdx)
      if (p === undefined || !p.overlapping) continue
      const lane = sameSideLane(free, p.lane)
      if (lane === 0) continue
      car.lane = lane
      car.overlapping = true
      free &= ~laneBit(lane)
    }
  }

  for (let i = 0; i < n && free !== 0; i++) {
    const car = cars[i]
    if (car === undefined || car.lane !== 0) continue
    const p = prevSideCar(prev, car.carIdx)
    let lane: RadarLane
    if (p === undefined) {
      const l = firstFreeLane(free, true)
      const r = firstFreeLane(free, false)
      lane = l !== 0 && r !== 0 ? splitLane(cars, i + 1, n, prev, car, l, r) : l !== 0 ? l : r
    } else {
      // Alongside last tick: pass 1 found no lane on its side, and none can free up.
      if (p.overlapping) continue
      lane = sameSideLane(free, p.lane)
      if (lane === 0) continue
    }
    car.lane = lane
    car.overlapping = true
    free &= ~laneBit(lane)
  }
  return free
}

/**
 * Side-lane hold for candidates not assigned a demanded lane (still lane 0, not overlapping)
 * within `maxM`: a car with a running hold in `prev` keeps its side lane, not overlapping. Held
 * cars never take a demanded lane (`demanded`), which belongs to a car alongside or a phantom.
 * Pass 1: held cars keep their lane when it is free. Pass 2: the others take the outer lane of
 * their side when free, else stay in lane 0, which ends their hold. Never the opposite side.
 */
function holdSideLanes(
  cars: readonly RadarCar[],
  maxM: number,
  demanded: number,
  prev: RadarData,
  now: number
): void {
  let taken = demanded
  let displaced = false
  for (const car of cars) {
    if (Math.abs(car.distM) > maxM) break
    if (car.overlapping) continue
    const p = heldPrevCar(prev, car.carIdx, now)
    if (p === undefined) continue
    if (taken & laneBit(p.lane)) {
      displaced = true
      continue
    }
    car.lane = p.lane
    car.sideHoldUntil = p.sideHoldUntil
    taken |= laneBit(p.lane)
  }
  if (!displaced) return
  for (const car of cars) {
    if (Math.abs(car.distM) > maxM) break
    if (car.overlapping || car.lane !== 0) continue
    const p = heldPrevCar(prev, car.carIdx, now)
    if (p === undefined) continue
    const outer: RadarLane = p.lane < 0 ? -2 : 2
    if (taken & laneBit(outer)) continue
    car.lane = outer
    car.sideHoldUntil = p.sideHoldUntil
    taken |= laneBit(outer)
  }
}

function byAbsDist(a: RadarCar, b: RadarCar): number {
  return Math.abs(a.distM) - Math.abs(b.distM)
}

function hidden(carLeftRight: number, rangeM: number, trackLengthKnown: boolean): RadarData {
  return {
    visible: false,
    rangeM,
    carLeftRight,
    leftCount: 0,
    rightCount: 0,
    cars: [],
    trackLengthKnown
  }
}

export function computeRadar(
  frame: TelemetryFrame,
  session: SessionMeta,
  opts: RadarOptions,
  prev: RadarData | null
): RadarData {
  const rangeM = clampOption(OPTION_SCHEMA.radar.rangeM, opts.rangeM)
  const len = session.trackLengthM
  const trackM = len !== null && Number.isFinite(len) && len > 0 ? len : null
  const trackLengthKnown = trackM !== null
  const clr = frame.CarLeftRight[0] ?? CarLeftRight.Off

  // Same player as every other widget (a PlayerCarIdx without a driver entry is not trusted).
  const focus = resolvePlayerCarIdx(frame, session)
  const focusPct = frame.CarIdxLapDistPct[focus]
  if (
    frame.IsOnTrack[0] !== true ||
    clr === CarLeftRight.Off ||
    focus < 0 ||
    !isValidPct(focusPct) ||
    frame.CarIdxTrackSurface[focus] === TrackLocation.NotInWorld
  ) {
    return hidden(clr, rangeM, trackLengthKnown)
  }

  // Every car that could be shown, as lane 0 for now. Without a track length there are no
  // distances, so only phantom side cars can be shown.
  const cars: RadarCar[] = []
  if (trackM !== null) {
    const keepM = Math.max(rangeM, RADAR.overlapSearchM)
    const focusPit = frame.CarIdxOnPitRoad[focus] === true
    for (let i = 0; i < MAX_CARS; i++) {
      if (i === focus || i === session.paceCarIdx) continue
      const pct = frame.CarIdxLapDistPct[i]
      if (!isValidPct(pct) || frame.CarIdxTrackSurface[i] === TrackLocation.NotInWorld) continue
      // Pit-lane cars next to the main straight must not trigger the radar (and vice versa).
      if ((frame.CarIdxOnPitRoad[i] === true) !== focusPit) continue
      const distM = wrapPctDelta(pct, focusPct) * trackM
      if (Math.abs(distM) > keepM) continue
      const driver = session.drivers.get(i)
      if (driver === undefined || driver.isPaceCar || driver.isSpectator) continue
      cars.push({
        carIdx: i,
        distM,
        lane: 0,
        overlapping: false,
        proximity: 0,
        color: '',
        classColor: driver.classColor
      })
    }
    cars.sort(byAbsDist)
  }

  // Side-lane candidates: the prefix of `cars` within overlapSearchM.
  const { left, right } = sideCounts(clr)
  const demanded = demandedLanes(left, right)
  let free = 0
  if (demanded !== 0) {
    let n = 0
    for (const car of cars) {
      if (Math.abs(car.distM) > RADAR.overlapSearchM) break
      n++
    }
    free = assignSideLanes(cars, n, demanded, prev)
  }

  // Clock of the side-lane hold. Without a valid SessionTime nothing is held.
  const t = frame.SessionTime[0]
  const now = t !== undefined && Number.isFinite(t) ? t : null
  if (now !== null && prev !== null && prev.cars.length > 0 && cars.length > 0) {
    // Beyond rangeM a held car is dropped like any lane-0 car (its hold ends), so stop there.
    holdSideLanes(cars, Math.min(RADAR.sideHoldMaxM, rangeM), demanded, prev, now)
  }

  // Lane-0 and held cars in the fade band stay in `cars` so the widget can fade them in, but they
  // show the panel only within showM: nearer while hidden (~50% opacity) than while shown (~25%).
  const showM = rangeM * (1 - RADAR.edgeFadeFrac / (prev?.visible === true ? 4 : 2))
  let visible = free !== 0

  // Finish cars alongside, drop the others out of range. `cars` stays sorted by |distM|.
  let w = 0
  for (const car of cars) {
    if (car.overlapping) {
      car.proximity = 1
      car.color = proximityColor(1)
      if (now !== null) car.sideHoldUntil = now + RADAR.sideHoldS
      visible = true
    } else {
      // Lane 0, or a side lane held after the overlap ended: by distance, like lane 0.
      const abs = Math.abs(car.distM)
      if (abs > rangeM) continue
      car.proximity = 1 - clamp01((abs - RADAR.carLengthM) / (rangeM - RADAR.carLengthM))
      car.color = proximityColor(car.proximity)
      if (abs <= showM) visible = true
    }
    cars[w++] = car
  }
  cars.length = w

  // Lanes CarLeftRight demands but no car matched (unknown track length or data mismatch).
  if (free !== 0) {
    const phantoms: RadarCar[] = []
    for (const lane of SIDE_LANES) {
      if (!(free & laneBit(lane))) continue
      phantoms.push({
        carIdx: -1,
        distM: 0,
        lane,
        overlapping: true,
        proximity: 1,
        color: proximityColor(1),
        classColor: PHANTOM_CLASS_COLOR
      })
    }
    cars.unshift(...phantoms)
  }

  return {
    visible,
    rangeM,
    carLeftRight: clr,
    leftCount: left,
    rightCount: right,
    cars,
    trackLengthKnown
  }
}
