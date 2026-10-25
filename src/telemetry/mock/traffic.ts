/** Lanes and the spotter: how cars move off each other's line, and CarLeftRight. */
import { wrapPctDelta } from '@shared/lapDist'
import { CarLeftRight } from '@shared/telemetry'
import { frac } from '@shared/num'
import type { SimCar } from './car'
import { LANE_M } from './scripts'
import { TRACK_LENGTH_M } from './track'

/** A battle car steps aside while an escort passes through its line this close. */
const BATTLE_CLEAR_M = 25
/** Free cars near the player take the outer lane when the inner one is busy this close. */
const CAR_CLEAR_M = 7

/** Metres along the track between two race distances (wrapped, >= 0). */
export function trackGapM(a: number, b: number): number {
  return Math.abs(wrapPctDelta(frac(a), frac(b))) * TRACK_LENGTH_M
}

/** True when an escort is within BATTLE_CLEAR_M of `car` in the lane at `latM`. */
export function escortNear(car: SimCar, latM: number, escorts: readonly SimCar[]): boolean {
  for (const e of escorts) {
    if (e.role !== 'escort' || Math.abs(e.latM - latM) >= LANE_M / 2) continue
    if (trackGapM(e.dist, car.dist) < BATTLE_CLEAR_M) return true
  }
  return false
}

/** Metres along the track to the player (unless `playerDist` is NaN) or the nearest battle car. */
export function nearestLineCarM(
  car: SimCar,
  playerDist: number,
  battleCars: readonly SimCar[]
): number {
  let best = Number.isNaN(playerDist) ? Infinity : trackGapM(car.dist, playerDist)
  for (const b of battleCars) {
    if (b.role === 'battle') best = Math.min(best, trackGapM(car.dist, b.dist))
  }
  return best
}

/**
 * True when a scripted car, or a free car with a lower CarIdx (so exactly
 * one of two yields), is alongside `car` in the lane at `latM`.
 */
export function laneTaken(car: SimCar, latM: number, cars: readonly SimCar[]): boolean {
  for (const other of cars) {
    if (other === car || other.role === 'player' || other.pit !== 'none' || !other.inWorld) {
      continue
    }
    if (other.role === 'free' && other.idx > car.idx) continue
    if (Math.abs(other.latM - latM) >= LANE_M / 2) continue
    if (trackGapM(other.dist, car.dist) < CAR_CLEAR_M) return true
  }
  return false
}

/** Side of the player with fewer escorts on it right now (ties by CarIdx parity). */
export function freerSide(carIdx: number, escorts: readonly SimCar[]): -1 | 1 {
  let balance = 0
  for (const e of escorts) if (e.role === 'escort') balance += Math.sign(e.latM)
  if (balance !== 0) return balance > 0 ? -1 : 1
  return carIdx % 2 === 0 ? -1 : 1
}

/** Maps spotter counts to irsdk_CarLeftRight. */
export function spotterState(left: number, right: number): CarLeftRight {
  if (left > 0 && right > 0) return CarLeftRight.CarLeftRight
  if (left >= 2) return CarLeftRight.Cars2Left
  if (right >= 2) return CarLeftRight.Cars2Right
  if (left === 1) return CarLeftRight.CarLeft
  if (right === 1) return CarLeftRight.CarRight
  return CarLeftRight.Clear
}
