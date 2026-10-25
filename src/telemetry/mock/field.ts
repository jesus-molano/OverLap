/**
 * The field at the start of a mock session: who plays which part around the
 * player, and where every car is, ~40 min before the end.
 */
import { frac } from '@shared/num'
import type { Role, SimCar } from './car'
import { START_SESSION_TIME_S } from './constants'
import { MOCK_CLASSES, isRaceDriver } from './drivers'
import type { MockDriver } from './drivers'
import { PIT_EVERY_LAPS, stallPctOf } from './pitLane'
import type { Rng } from './rng'
import {
  BATTLE_AHEAD,
  BATTLE_BEHIND,
  FASTER_SLOTS,
  SAME_SLOTS,
  SCRIPT_A,
  SCRIPT_B,
  SLOWER_SLOTS,
  battleGapS,
  sampleEscort
} from './scripts'
import type { Slot } from './scripts'
import { TRACK_LENGTH_M } from './track'

const START_LAPS = 14
const START_PCT = 0.93
/** Player lap time = class est lap * this, plus the same slow noise as everybody. */
const PLAYER_PACE = 1.005
const PACE_SPREAD = 0.02
/**
 * Lapped classmates (backmarkers) lap at class est * 1.035..1.04: over 2 % slower than the
 * player (the traffic widget's margin for "slower" within a class), so it gains ~4.5 s a lap.
 */
const BACKMARKER_PACE = 1.035
const BACKMARKER_PACE_SPAN = 0.005
/** Backmarkers make their first stop after this many laps (+0..2), once the player is past. */
const BACKMARKER_STINT_LAPS = 12
/** Track offset of the classmate that pits right away, so the relative shows a car in the pits. */
const PIT_CAR_OFFSET = 0.022

/** CarIdx of the scripted cars, for tests and screenshots. */
export interface MockCast {
  /** Other-class cars orbiting the player (radar encounters). */
  escorts: readonly [number, number]
  battleAhead: number
  battleBehind: number
  /** Classmate that pits right away. */
  pitter: number
  /** Classmate that goes off, gets a meatball and pits for repairs. */
  meatball: number
  /** Other-class car that gets a black flag. */
  blackFlag: number
}

export interface Field {
  /** Race cars in CarIdx order. */
  readonly cars: SimCar[]
  readonly player: SimCar
  readonly cast: MockCast
  /** The player's race distance at the start. */
  readonly playerStartDist: number
}

/**
 * Casts and places the race cars of `roster` around the player at `playerIdx`.
 * `rng` draws paces, noise and pit stops, `rng2` the lap times already run
 * (the same number of draws per car, so a seed always gives the same field).
 */
export function buildField(
  roster: readonly MockDriver[],
  playerIdx: number,
  rng: Rng,
  rng2: Rng
): Field {
  const racers = roster.filter(isRaceDriver)
  const me = racers.find((d) => d.carIdx === playerIdx)
  if (!me) throw new RangeError(`playerCarIdx ${playerIdx} is not a race car`)
  const myEst = MOCK_CLASSES[me.classKey].estLapTimeS
  const playerLapS = myEst * PLAYER_PACE

  // Nearest classmates by CarIdx: the battle, the early pitter; the farthest gets the meatball.
  const mates = racers
    .filter((d) => d.classKey === me.classKey && d !== me)
    .sort((a, b) => dIdx(a, playerIdx) - dIdx(b, playerIdx) || a.carIdx - b.carIdx)
  const [aheadD, behindD, pitter] = mates
  const meatballD = mates.at(-1)
  // Escorts: the lowest-rated cars of the other class(es); the third one gets the black flag.
  const others = racers
    .filter((d) => d.classKey !== me.classKey)
    .sort((a, b) => a.iRating - b.iRating || a.carIdx - b.carIdx)
  const [escortA, escortB, blackD] = others
  if (!aheadD || !behindD || !pitter || !meatballD || mates.length < 4) {
    throw new Error('mock roster: class too small')
  }
  if (!escortA || !escortB || !blackD) throw new Error('mock roster: needs another class')

  const playerDist = START_LAPS + START_PCT
  const counters = { faster: 0, same: 0, slower: 0 }
  const hasFaster = racers.some((d) => MOCK_CLASSES[d.classKey].estLapTimeS < myEst)

  const cars = racers.map((d): SimCar => {
    const cls = MOCK_CLASSES[d.classKey]
    const role: Role =
      d === me
        ? 'player'
        : d === escortA || d === escortB
          ? 'escort'
          : d === aheadD || d === behindD
            ? 'battle'
            : 'free'
    const script = d === escortA ? SCRIPT_A : d === escortB ? SCRIPT_B : null
    const battle = d === aheadD ? BATTLE_AHEAD : d === behindD ? BATTLE_BEHIND : null
    const battleSide = d === behindD ? -1 : 1
    // Same number of draws for every car keeps the sequence stable.
    let pace = 1 + (rng() * 2 - 1) * PACE_SPREAD
    const slowPace = BACKMARKER_PACE + BACKMARKER_PACE_SPAN * rng()
    const noise = [rng(), rng(), rng(), rng()] as const
    let lapsToPit = 1 + Math.floor(rng() * PIT_EVERY_LAPS)

    const noiseW1 = (2 * Math.PI) / (40 + noise[0] * 50)
    const noisePh1 = noise[1] * 2 * Math.PI
    const noiseW2 = (2 * Math.PI) / (12 + noise[2] * 18)
    const noisePh2 = noise[3] * 2 * Math.PI

    let dist = playerDist
    let latM = 0
    let backmarker = false
    if (script) {
      dist = playerDist + sampleEscort(script, 0, 1) / TRACK_LENGTH_M
      latM = sampleEscort(script, 0, 2)
    } else if (battle) {
      const gap = battleGapS(battle, 0, 0, noiseW1, noisePh1, noiseW2, noisePh2)
      dist = playerDist + (battleSide * gap) / playerLapS
    } else if (d === pitter) {
      dist = playerDist + PIT_CAR_OFFSET
      lapsToPit = 0
    } else if (role === 'free') {
      const est = cls.estLapTimeS
      const group = est < myEst ? 'faster' : est > myEst ? 'slower' : 'same'
      const k = counters[group]++
      const slots =
        group === 'faster' ? FASTER_SLOTS : group === 'slower' ? SLOWER_SLOTS : SAME_SLOTS
      const fallback: Slot = [
        0.05 + ((k * 0.37) % 0.9),
        group === 'faster' ? 1 : group === 'slower' ? -1 : 0
      ]
      const [offset, laps0] = slots[k] ?? fallback
      // Without a faster class someone must still be lapping the player.
      const laps = group === 'same' && k === 0 && !hasFaster ? 1 : laps0
      dist = playerDist + laps + offset
      // Lapped classmates are the slow ones; they stay out until the player has caught them.
      if (group === 'same' && laps < 0) {
        backmarker = true
        pace = slowPace
        lapsToPit = BACKMARKER_STINT_LAPS + (k % 3)
      }
    }

    // Scripted cars lap at the player's pace, whatever their class.
    const baseLapS = role === 'free' ? cls.estLapTimeS * pace : playerLapS
    // The race is under way: every car already has a last and a best lap.
    const lastLapS = baseLapS * (1 + 0.003 * (rng2() * 2 - 1))
    const bestLapS = Math.min(lastLapS, baseLapS * (0.993 + 0.004 * rng2()))
    return {
      idx: d.carIdx,
      classId: cls.id,
      classEstS: cls.estLapTimeS,
      role,
      script,
      battle,
      battleSide,
      baseLapS,
      noiseAmp1: 0.004,
      noiseW1,
      noisePh1,
      noiseAmp2: 0.002,
      noiseW2,
      noisePh2,
      stallPct: stallPctOf(d.carIdx),
      backmarker,
      dist,
      prevDist: dist,
      latM,
      side: 0,
      pit: 'none',
      pitStallDist: 0,
      pitExitDist: 0,
      stallLeftS: 0,
      lapsToPit,
      lapStartS: START_SESSION_TIME_S - frac(dist) * baseLapS,
      lapPace: 1,
      lastLapS,
      bestLapS,
      flags: 0,
      offTrackUntilS: 0,
      speedScale: 1,
      speedTarget: 1,
      speedRate: 0,
      incident: null,
      latOverride: Number.NaN,
      crossAtS: Number.NaN,
      finished: false,
      finishLap: 0,
      finishAtS: Infinity,
      inWorld: true,
      leaveAtS: Infinity,
      orderKey: dist
    }
  })
  const player = cars.find((c) => c.idx === playerIdx)
  if (!player) throw new Error('unreachable: player missing')
  return {
    cars,
    player,
    cast: {
      escorts: [escortA.carIdx, escortB.carIdx],
      battleAhead: aheadD.carIdx,
      battleBehind: behindD.carIdx,
      pitter: pitter.carIdx,
      meatball: meatballD.carIdx,
      blackFlag: blackD.carIdx
    },
    playerStartDist: playerDist
  }
}

function dIdx(d: MockDriver, playerIdx: number): number {
  return Math.abs(d.carIdx - playerIdx)
}
