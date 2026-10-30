import { describe, expect, it } from 'vitest'
import { SessionFlag } from '../flags'
import {
  Sim,
  V,
  makeDriver,
  makeSession,
  type Cars,
  type MutableFrame
} from '../race/testing/raceSim'
import type { SessionMeta } from '../types'
import { FuelTracker, tyreBands, tyreWear } from './tracker'

/** Litres per lap of the test car. */
const BURN = 2.5
const START_D = 0.5
const START_L = 60

const WEAR = [
  'LFwearL',
  'LFwearM',
  'LFwearR',
  'RFwearL',
  'RFwearM',
  'RFwearR',
  'LRwearL',
  'LRwearM',
  'LRwearR',
  'RRwearL',
  'RRwearM',
  'RRwearR'
] as const

function setWear(f: MutableFrame, values: readonly number[]): void {
  WEAR.forEach((name, i) => {
    f[name][0] = values[i] ?? 1
  })
}

/** Car 0 laps every 30 s from distance 0.5, burning BURN a lap; `extra` changes the frame. */
class FuelSim {
  readonly sim: Sim
  readonly tracker: FuelTracker
  fuel = START_L
  /** Litres per lap at a distance. */
  burnAt: (d: number) => number = () => BURN
  /** Added to the distance from now on (a tow or reset). */
  shift = 0
  pit = false
  private lastD = START_D

  constructor(
    session: SessionMeta = makeSession(1),
    tracker = new FuelTracker(),
    private readonly extra: (f: MutableFrame, d: number, t: number) => void = () => {}
  ) {
    this.sim = new Sim(session)
    this.tracker = tracker
    setWear(this.sim.frame, [])
  }

  get frame(): MutableFrame {
    return this.sim.frame
  }

  private cars = (t: number): Cars => {
    const d = START_D + V * t + this.shift
    const moved = Math.max(0, d - this.lastD)
    this.lastD = d
    this.fuel -= moved * this.burnAt(d)
    this.frame.FuelLevel[0] = this.fuel
    this.frame.CarIdxOnPitRoad[0] = this.pit
    this.frame.OnPitRoad[0] = this.pit
    this.extra(this.frame, d, t)
    return { 0: { d, pit: this.pit } }
  }

  run(seconds: number): void {
    this.sim.run(seconds, 60, this.cars, () =>
      this.tracker.observe(this.sim.frame, this.sim.session, this.sim.view)
    )
  }
}

describe('FuelTracker laps', () => {
  it('measures each clean lap at the line, from the first one it saw start', () => {
    const s = new FuelSim()
    s.run(14) // d 0.97: joined mid-lap
    expect(s.tracker.samples.laps).toEqual([])
    s.run(2) // crosses 1.0: the lap it joined in is not measured
    expect(s.tracker.lastLapL).toBeNull()
    s.run(30) // crosses 2.0
    expect(s.tracker.lastLapL).toBeCloseTo(BURN, 2)
    expect(s.tracker.samples).toEqual({ laps: [expect.closeTo(BURN, 2)], carried: false })
    s.run(60) // crosses 3.0 and 4.0
    expect(s.tracker.samples.laps).toHaveLength(3)
  })

  it('keeps the last laps only, newest first', () => {
    const s = new FuelSim()
    // Lap n (distance n - 1 to n) burns 2 + (n - 1) / 10 litres.
    s.burnAt = (d) => 2 + Math.floor(d) / 10
    s.fuel = 100
    s.run(16 + 30 * 13) // crosses 14.0: laps 2 to 14 measured
    const laps = s.tracker.samples.laps
    expect(laps).toHaveLength(10)
    expect(laps[0]).toBeCloseTo(3.3, 2)
    expect(laps[9]).toBeCloseTo(2.4, 2)
  })

  it('leaves out a lap on pit road, but it is still the last lap', () => {
    const s = new FuelSim()
    s.run(46) // two crossings: one sample
    s.pit = true
    s.run(10)
    s.pit = false
    s.run(20) // crosses 3.0
    expect(s.tracker.samples.laps).toHaveLength(1)
    expect(s.tracker.lastLapL).toBeCloseTo(BURN, 2)
    // Burnt as much as a clean lap, but it is not one: the sparkline draws it apart.
    expect(s.tracker.lastLapClean).toBe(false)
    s.run(30) // a clean lap again
    expect(s.tracker.samples.laps).toHaveLength(2)
    expect(s.tracker.lastLapClean).toBe(true)
  })

  it('leaves out a lap with a refuel, also as the last lap', () => {
    const s = new FuelSim()
    s.run(46)
    s.pit = true
    s.run(5)
    s.fuel += 30
    s.run(5)
    s.pit = false
    s.run(20)
    expect(s.tracker.samples.laps).toHaveLength(1)
    expect(s.tracker.lastLapL).toBeNull()
    s.run(30) // the next lap starts at the line again
    expect(s.tracker.lastLapL).toBeCloseTo(BURN, 2)
  })

  it('leaves out caution laps but shows them as the last lap', () => {
    let caution = false
    const s = new FuelSim(undefined, undefined, (f) => {
      f.SessionFlags[0] = caution ? SessionFlag.Caution : 0
    })
    s.run(46)
    caution = true
    s.run(30)
    caution = false
    expect(s.tracker.samples.laps).toHaveLength(1)
    expect(s.tracker.lastLapL).toBeCloseTo(BURN, 2)
    expect(s.tracker.lastLapClean).toBe(false)
  })

  it('leaves out a lap you did not drive all of, a tow and a jump', () => {
    let inCar = true
    let tow = 0
    const s = new FuelSim(undefined, undefined, (f) => {
      f.IsOnTrack[0] = inCar
      f.PlayerCarTowTime[0] = tow
    })
    s.run(46)
    inCar = false
    s.run(3)
    inCar = true
    s.run(27) // crosses 3.0
    expect(s.tracker.lastLapL).toBeNull()
    tow = 12
    s.run(2)
    tow = 0
    s.run(28) // crosses 4.0
    expect(s.tracker.lastLapL).toBeNull()
    s.run(10)
    s.shift = 0.3
    s.run(12) // crosses 5.0 sooner
    expect(s.tracker.lastLapL).toBeNull()
    expect(s.tracker.samples.laps).toHaveLength(1)
  })

  it('does not measure across a replay', () => {
    let replay = false
    const s = new FuelSim(undefined, undefined, (f) => {
      f.IsReplayPlaying[0] = replay
    })
    s.run(46)
    replay = true
    s.run(1)
    replay = false
    s.run(29)
    expect(s.tracker.lastLapL).toBeNull()
    expect(s.tracker.samples.laps).toHaveLength(1)
  })

  it('carries the laps into the next session of the same car and track, until it has its own', () => {
    const first = new FuelSim()
    first.run(76)
    expect(first.tracker.samples.laps).toHaveLength(2)
    const next = new FuelSim(makeSession(1, { subSessionId: 1001 }), first.tracker)
    next.run(1)
    expect(next.tracker.samples).toMatchObject({ carried: true })
    expect(next.tracker.samples.laps).toHaveLength(2)
    expect(next.tracker.lastLapL).toBeNull()
    next.run(45)
    expect(next.tracker.samples).toMatchObject({ carried: false })
    expect(next.tracker.samples.laps).toHaveLength(1)
  })

  it('forgets them with another car', () => {
    const first = new FuelSim()
    first.run(76)
    const other = makeSession(1, { subSessionId: 1001 }, [makeDriver(0, { carId: 99 })])
    const next = new FuelSim(other, first.tracker)
    next.run(1)
    expect(next.tracker.samples.laps).toEqual([])
  })

  it('keeps them through a reset (a reconnect)', () => {
    const s = new FuelSim()
    s.run(46)
    s.tracker.reset()
    s.run(1)
    expect(s.tracker.samples).toMatchObject({ carried: false })
    expect(s.tracker.samples.laps).toHaveLength(1)
    // The lap in progress was not measured.
    s.run(29)
    expect(s.tracker.lastLapL).toBeNull()
  })
})

describe('FuelTracker lap start', () => {
  it('keeps the fuel each lap started with at the line, not where it was first seen', () => {
    const s = new FuelSim()
    s.run(14) // d 0.97: joined mid-lap
    expect(s.tracker.lapStart).toBeNull()
    s.run(2) // crosses 1.0 with 60 - 0.5 x 2.5 L
    expect(s.tracker.lapStart).toEqual({ lap: 1, fuelL: expect.closeTo(58.75, 1) })
    const first = s.tracker.lapStart
    s.run(10)
    // The same object through the lap.
    expect(s.tracker.lapStart).toBe(first)
    s.run(20) // crosses 2.0
    expect(s.tracker.lapStart).toEqual({ lap: 2, fuelL: expect.closeTo(56.25, 1) })
  })

  it('drops it on a refuel, a tow or out of the car, until the next line', () => {
    let tow = 0
    let inCar = true
    const s = new FuelSim(undefined, undefined, (f) => {
      f.PlayerCarTowTime[0] = tow
      f.IsOnTrack[0] = inCar
    })
    s.run(16)
    expect(s.tracker.lapStart).not.toBeNull()
    s.fuel += 20
    s.run(1)
    expect(s.tracker.lapStart).toBeNull()
    s.run(30) // crosses 2.0
    expect(s.tracker.lapStart).toMatchObject({ lap: 2 })
    tow = 10
    s.run(1)
    expect(s.tracker.lapStart).toBeNull()
    tow = 0
    s.run(30) // crosses 3.0
    expect(s.tracker.lapStart).toMatchObject({ lap: 3 })
    inCar = false
    s.run(1)
    expect(s.tracker.lapStart).toBeNull()
    s.run(30) // crosses 4.0 out of the car
    expect(s.tracker.lapStart).toBeNull()
  })
})

describe('FuelTracker tyres', () => {
  it('keeps the most worn reading of a stay in the stall, with its lap', () => {
    let stall = false
    let wear: number[] = []
    const s = new FuelSim(undefined, undefined, (f) => {
      f.PlayerCarInPitStall[0] = stall
      setWear(f, wear)
    })
    s.run(100) // d 3.83
    expect(s.tracker.tyres).toBeNull()
    stall = true
    s.run(1) // arrival: still the old (new set) values
    expect(s.tracker.tyres).toBeNull()
    wear = [0.84, 0.81, 0.78, 0.79, 0.76, 0.74, 0.89, 0.88, 0.86, 0.86, 0.84, 0.82]
    s.run(1)
    expect(s.tracker.tyres).toEqual({
      lap: 3,
      wearPct: [78, 74, 86, 82],
      bands: [
        [84, 81, 78],
        [79, 76, 74],
        [89, 88, 86],
        [86, 84, 82]
      ]
    })
    // New tyres go on: the reading stays.
    wear = []
    s.run(1)
    stall = false
    s.run(1)
    expect(s.tracker.tyres).toMatchObject({ lap: 3, wearPct: [78, 74, 86, 82] })
  })

  it('takes nothing from a stay that changes nothing or shows a new set', () => {
    let stall = false
    const s = new FuelSim(undefined, undefined, (f) => {
      f.PlayerCarInPitStall[0] = stall
    })
    setWear(s.frame, Array(12).fill(0.9))
    s.run(50)
    stall = true
    s.run(3)
    expect(s.tracker.tyres).toBeNull()
    setWear(s.frame, Array(12).fill(0.998))
    s.run(1)
    expect(s.tracker.tyres).toBeNull()
  })

  it('reads every band of every tyre, left to right as iRacing names them', () => {
    const s = new FuelSim()
    setWear(s.frame, [0.9, 0.8, 0.85, 1, 1, 1, 0.5, 0.6, 0.7, 0.95, 0.94, 0.93])
    expect(tyreBands(s.frame)).toEqual([
      [0.9, 0.8, 0.85],
      [1, 1, 1],
      [0.5, 0.6, 0.7],
      [0.95, 0.94, 0.93]
    ])
    // Over 1 is already a percentage; a value past 100 % is new tread.
    setWear(s.frame, [90, 80, 85, 100, 101, 100, 50, 60, 70, 95, 94, 93])
    expect(tyreBands(s.frame)?.[1]).toEqual([1, 1, 1])
    s.frame.RRwearR[0] = -1
    expect(tyreBands(s.frame)).toBeNull()
  })

  it('reads the tread per tyre as its most worn band, 0..1 or already in percent', () => {
    const s = new FuelSim()
    setWear(s.frame, [0.9, 0.8, 0.85, 1, 1, 1, 0.5, 0.6, 0.7, 0.95, 0.94, 0.93])
    expect(tyreWear(s.frame)).toEqual([0.8, 1, 0.5, 0.93])
    setWear(s.frame, [90, 80, 85, 100, 100, 100, 50, 60, 70, 95, 94, 93])
    expect(tyreWear(s.frame)?.[0]).toBeCloseTo(0.8)
    s.frame.LFwearM[0] = Number.NaN
    expect(tyreWear(s.frame)).toBeNull()
  })
})
