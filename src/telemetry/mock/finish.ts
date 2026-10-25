/**
 * End of a timed mock race: white flag on the overall leader's last lap,
 * chequered flag at its first crossing with the clock at 0, every other car
 * at its next crossing, cool-down laps (some finishers leave the car), then
 * CoolDown once everybody is in and `done` COOL_DOWN_S later.
 */
import { SessionState } from '@shared/telemetry'
import type { SimCar } from './car'
import { COOL_DOWN_PACE } from './inputs'
import type { MockEventKind } from './scenarios'

/** Cool-down starts when everybody is in, or this long after the flag. */
const MAX_CHECKERED_S = 300
const COOL_DOWN_S = 60
/** Lap-rate scale per second while slowing for the cool-down lap. */
const COOL_DOWN_RATE = 0.08
/** The winner leaves the car this long after the flag; so does every LEAVER_EVERY-th finisher. */
const WINNER_LEAVES_S = 20
const LEAVER_EVERY = 5
const LEAVER_AFTER_S = 30

export const SESSION_STATE_OF = {
  racing: SessionState.Racing,
  checkered: SessionState.Checkered,
  'cool-down': SessionState.CoolDown
} as const satisfies Record<string, SessionState>

export type MockRacePhase = keyof typeof SESSION_STATE_OF

export interface FinishHooks {
  log(kind: MockEventKind, carIdx: number): void
  /** The chequered flag is out: scripted events stop, the cast races on its own. */
  onFlag(): void
  /**
   * SessionTime of `car`'s next S/F crossing at its current pace, NaN when it
   * cannot be told (scripted, in the pits, having an incident).
   */
  nextCrossingS(car: SimCar): number
}

export class RaceFinish {
  private current: MockRacePhase = 'racing'
  private over = false
  private whiteFlag = false
  private flagElapsedS = Number.NaN
  private coolDownEndS = Infinity
  private finishers = 0

  /** `clockEndS`: SessionTime at which the race clock reaches 0. */
  constructor(
    private readonly hooks: FinishHooks,
    private readonly clockEndS: number
  ) {}

  get phase(): MockRacePhase {
    return this.current
  }

  /** The cool-down is over. */
  get done(): boolean {
    return this.over
  }

  /** The leader is on its last lap. */
  get white(): boolean {
    return this.whiteFlag
  }

  /** After every car moved and was timed this step (crossAtS set). */
  update(cars: readonly SimCar[], player: SimCar, elapsedS: number): void {
    switch (this.current) {
      case 'racing': {
        const leader = leaderOf(cars, player)
        const t = leader.crossAtS
        if (Number.isNaN(t)) return
        if (t >= this.clockEndS) {
          this.flag(cars, leader, t, player, elapsedS)
        } else if (!this.whiteFlag && this.lastLap(leader, t)) {
          this.whiteFlag = true
          this.hooks.log('white-flag', leader.idx)
        }
        return
      }
      case 'checkered':
        if (elapsedS - this.flagElapsedS >= MAX_CHECKERED_S || everyoneIn(cars)) {
          this.current = 'cool-down'
          this.coolDownEndS = elapsedS + COOL_DOWN_S
          this.hooks.log('cool-down', -1)
        }
        return
      case 'cool-down':
        if (!this.over && elapsedS >= this.coolDownEndS) {
          this.over = true
          this.hooks.log('session-end', -1)
        }
    }
  }

  /** `car` crossed the line at SessionTime `atS` after the flag, completing `lap`. */
  finish(car: SimCar, atS: number, lap: number, player: SimCar, elapsedS: number): void {
    car.finished = true
    car.finishLap = lap
    car.finishAtS = atS
    car.incident = null
    car.latOverride = Number.NaN
    car.speedTarget = COOL_DOWN_PACE
    car.speedRate = COOL_DOWN_RATE
    this.finishers++
    if (car !== player) {
      if (this.finishers === 1) car.leaveAtS = elapsedS + WINNER_LEAVES_S
      else if (this.finishers % LEAVER_EVERY === 0) car.leaveAtS = elapsedS + LEAVER_AFTER_S
    }
    this.hooks.log('finish', car.idx)
  }

  /**
   * Finishers whose time has come leave the world (NotInWorld; positions kept).
   * Returns how many of them were on pit road.
   */
  departures(cars: readonly SimCar[], elapsedS: number): number {
    if (this.current === 'racing') return 0
    let fromPits = 0
    for (const car of cars) {
      if (!car.inWorld || elapsedS < car.leaveAtS) continue
      car.inWorld = false
      if (car.pit !== 'none') {
        car.pit = 'none'
        fromPits++
      }
      this.hooks.log('left-world', car.idx)
    }
    return fromPits
  }

  /**
   * The leader, crossing at `t`, starts its last lap: the clock runs out before
   * its next crossing. Predicted at its pace (exact on the lap-rate model, so
   * the white flag is never skipped), else from its last lap time.
   */
  private lastLap(leader: SimCar, t: number): boolean {
    const next = this.hooks.nextCrossingS(leader)
    return Number.isNaN(next) ? this.clockEndS - t < leader.lastLapS : next >= this.clockEndS
  }

  /** The leader crossed the line at `t` with the clock at 0: it and everyone crossing after it finish. */
  private flag(
    cars: readonly SimCar[],
    leader: SimCar,
    t: number,
    player: SimCar,
    elapsedS: number
  ): void {
    this.current = 'checkered'
    this.whiteFlag = false
    this.flagElapsedS = elapsedS
    this.hooks.onFlag()
    this.hooks.log('checkered', leader.idx)
    this.finish(leader, t, Math.floor(leader.dist), player, elapsedS)
    for (const car of cars) {
      if (car !== leader && !car.finished && car.crossAtS >= t) {
        this.finish(car, car.crossAtS, Math.floor(car.dist), player, elapsedS)
      }
    }
  }
}

/** Overall leader by race distance among the cars in the world. */
function leaderOf(cars: readonly SimCar[], player: SimCar): SimCar {
  let best = player
  for (const car of cars) if (car.inWorld && car.dist > best.dist) best = car
  return best
}

function everyoneIn(cars: readonly SimCar[]): boolean {
  for (const car of cars) if (car.inWorld && !car.finished) return false
  return true
}
