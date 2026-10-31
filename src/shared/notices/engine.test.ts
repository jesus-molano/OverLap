import { describe, expect, it } from 'vitest'
import { EngineWarning } from '../flags'
import { EMPTY_RACE_VIEW } from '../race/emptyRaceView'
import { makeFrame, makeSession } from '../race/testing/raceSim'
import type { MutableFrame } from '../race/testing/raceSim'
import type { LapRecord, RaceCarState, RaceView } from '../race/raceView'
import { TrackLocation } from '../telemetry'
import type { SessionMeta } from '../types'
import { ENGINE, EngineMonitor, type EngineState } from './engine'
import { ENGINE_TREND } from './engineTrend'

const IDLE_RPM = 900

/** The player is CarIdx 0 of a 3-car session, its car idling at IDLE_RPM. */
class Car {
  readonly frame: MutableFrame = makeFrame()
  session: SessionMeta = makeSession(3, { driverCarIdleRpm: IDLE_RPM })
  race: RaceView = EMPTY_RACE_VIEW
  readonly e = new EngineMonitor()
  /** 10 Hz ticks since SessionTime 100 s (an integer count, so times do not drift). */
  private n = 0

  constructor() {
    this.frame.Speed[0] = 30
  }

  /** The tick `ticks` later, observed then read, as the telemetry loop and a widget do. */
  tick(ticks = 1): EngineState {
    this.n += ticks
    this.frame.SessionTime[0] = (1000 + this.n) / 10
    this.e.observe(this.frame)
    return this.e.read(this.frame, this.session, this.race)
  }

  /** Every 10 Hz tick for `seconds`; the last state. */
  ticks(seconds: number): EngineState {
    let last = this.tick()
    for (let k = 1; k < Math.round(seconds * 10); k++) last = this.tick()
    return last
  }

  bits(b: number): this {
    this.frame.EngineWarnings[0] = b
    return this
  }
}

/** The lights on in a state, by name. */
const lit = (s: EngineState): string[] =>
  (
    [
      'stalled',
      'oilPressure',
      'fuelPressure',
      'water',
      'oilTemp',
      'repair',
      'repairOptional',
      'pitLimiter',
      'revLimiter'
    ] as const
  ).filter((k) => s[k])

const ALL_BITS =
  EngineWarning.OilPressure |
  EngineWarning.FuelPressure |
  EngineWarning.WaterTemp |
  EngineWarning.OilTemp |
  EngineWarning.MandatoryRepairs |
  EngineWarning.OptionalRepairs |
  EngineWarning.PitSpeedLimiter |
  EngineWarning.RevLimiter

describe('EngineMonitor: the lights', () => {
  it('lights each one from its bit, in the car with the engine running', () => {
    const c = new Car()
    expect(lit(c.tick())).toEqual([])
    const each: [number, string][] = [
      [EngineWarning.OilPressure, 'oilPressure'],
      [EngineWarning.FuelPressure, 'fuelPressure'],
      [EngineWarning.WaterTemp, 'water'],
      [EngineWarning.OilTemp, 'oilTemp'],
      [EngineWarning.MandatoryRepairs, 'repair'],
      [EngineWarning.OptionalRepairs, 'repairOptional'],
      [EngineWarning.PitSpeedLimiter, 'pitLimiter'],
      [EngineWarning.RevLimiter, 'revLimiter']
    ]
    for (const [bit, name] of each) expect(lit(c.bits(bit).tick()), name).toEqual([name])
    expect(lit(c.bits(ALL_BITS).tick())).toHaveLength(8)
    // Both repairs at once: two lights (online the optional bit came 20 ms before the other).
    expect(
      c.bits(EngineWarning.MandatoryRepairs | EngineWarning.OptionalRepairs).tick()
    ).toMatchObject({ repair: true, repairOptional: true })
    // Signed Int32 bit fields.
    expect(lit(c.bits(EngineWarning.WaterTemp | 0x80000000 | 0).tick())).toEqual(['water'])
    expect(c.tick()).toMatchObject({ inCar: true, quiet: false, limiterRead: true })
  })

  it('without EngineWarnings, nothing is on (an absent var is an empty array)', () => {
    const c = new Car()
    c.frame.EngineWarnings.length = 0
    expect(lit(c.tick())).toEqual([])
  })

  it('the pressures need the engine running, moving or at 80 % of its idle, and no stall (Q2)', () => {
    const c = new Car().bits(EngineWarning.OilPressure | EngineWarning.FuelPressure)
    c.frame.Speed[0] = 0
    c.frame.RPM[0] = 300
    // Online: stopped after a crash, the engine hunting at 300..600 rpm with the lights on.
    expect(lit(c.tick())).toEqual([])
    c.frame.RPM[0] = ENGINE.idleRpmShare * IDLE_RPM - 1
    expect(lit(c.tick())).toEqual([])
    c.frame.RPM[0] = ENGINE.idleRpmShare * IDLE_RPM
    expect(lit(c.tick())).toEqual(['oilPressure', 'fuelPressure'])
    c.frame.RPM[0] = 0
    c.frame.Speed[0] = ENGINE.movingMs + 0.5
    expect(lit(c.tick())).toEqual(['oilPressure', 'fuelPressure'])
    // Stalled: the stall says it all; the temperatures need neither.
    c.bits(EngineWarning.OilPressure | EngineWarning.Stalled | EngineWarning.WaterTemp)
    expect(lit(c.tick())).toEqual(['stalled', 'water'])
    // Without the car's idle only moving counts.
    c.session = makeSession(3)
    c.bits(EngineWarning.OilPressure)
    c.frame.Speed[0] = 1
    c.frame.RPM[0] = 2000
    expect(lit(c.tick())).toEqual([])
  })

  it('quiet while towed, in the box, out of the world and as you get in the car (Q2)', () => {
    const engine = EngineWarning.OilPressure | EngineWarning.Stalled | EngineWarning.WaterTemp
    const t = new Car().bits(engine)
    t.frame.PlayerCarTowTime[0] = 50
    expect(t.tick()).toMatchObject({ quiet: true, stalled: false, water: false })
    t.frame.PlayerCarTowTime[0] = 0
    t.frame.PlayerTrackSurface[0] = TrackLocation.InPitStall
    expect(t.tick()).toMatchObject({ quiet: true, stalled: false })
    t.frame.PlayerTrackSurface[0] = TrackLocation.OnTrack
    expect(lit(t.tick())).toEqual(['stalled', 'water'])

    // Getting in the car: the engine starts (online: 12 -> 4 -> 0 in 1.6 s at the grid).
    const g = new Car().bits(engine)
    g.frame.IsOnTrack[0] = false
    expect(g.tick()).toMatchObject({ inCar: false, quiet: true })
    g.frame.IsOnTrack[0] = true
    expect(lit(g.ticks(ENGINE.inCarSettleS - 0.2))).toEqual([])
    expect(lit(g.ticks(0.4))).toEqual(['stalled', 'water'])

    // Out of the world (a tow lifting the car), and teleportS after it reappears.
    const w = new Car().bits(engine)
    w.frame.PlayerTrackSurface[0] = TrackLocation.NotInWorld
    expect(lit(w.tick())).toEqual([])
    w.frame.PlayerTrackSurface[0] = TrackLocation.OnTrack
    expect(lit(w.ticks(ENGINE.teleportS - 0.2))).toEqual([])
    expect(lit(w.ticks(0.4))).toEqual(['stalled', 'water'])
  })

  it('keeps the repairs on through the stop and the tow: that is where they are made', () => {
    const c = new Car().bits(EngineWarning.MandatoryRepairs | EngineWarning.OptionalRepairs)
    c.frame.PitRepairLeft[0] = 41.2
    c.frame.PitOptRepairLeft[0] = 38
    c.frame.PlayerCarTowTime[0] = 30
    expect(c.tick()).toMatchObject({ quiet: true, repair: true, repairOptional: true })
    c.frame.PlayerCarTowTime[0] = 0
    c.frame.PlayerTrackSurface[0] = TrackLocation.InPitStall
    expect(c.tick()).toMatchObject({ repair: true, repairS: 41.2, optRepairS: 38 })
    // Not out of the world, nor just after the car reappears, nor out of the car.
    c.frame.PlayerTrackSurface[0] = TrackLocation.NotInWorld
    expect(c.tick()).toMatchObject({ repair: false, repairOptional: false })
    c.frame.PlayerTrackSurface[0] = TrackLocation.InPitStall
    expect(c.tick()).toMatchObject({ repair: false })
    expect(c.ticks(ENGINE.teleportS)).toMatchObject({ repair: true })
    c.frame.IsOnTrack[0] = false
    expect(c.tick()).toMatchObject({ inCar: false, quiet: true, repairS: null, optRepairS: null })
    expect(lit(c.tick())).toEqual([])
  })

  it('reads no limiter while towed or just after the car appears (B10)', () => {
    const c = new Car().bits(EngineWarning.PitSpeedLimiter | EngineWarning.RevLimiter)
    c.frame.PlayerTrackSurface[0] = TrackLocation.NotInWorld
    c.tick()
    c.frame.PlayerTrackSurface[0] = TrackLocation.InPitStall
    expect(c.tick()).toMatchObject({ limiterRead: false, pitLimiter: false, revLimiter: false })
    expect(c.ticks(ENGINE.teleportS)).toMatchObject({ limiterRead: true, pitLimiter: true })
    c.frame.PlayerCarTowTime[0] = 12
    expect(c.tick()).toMatchObject({ limiterRead: false, pitLimiter: false })
    expect(c.e.justAppeared(c.frame.SessionTime[0] ?? 0)).toBe(false)
  })

  it('reads the temperatures and the repair times in the car only, unknown when absent', () => {
    const c = new Car()
    c.frame.WaterTemp[0] = 88.6
    c.frame.OilTemp[0] = 101.2
    c.frame.PitRepairLeft[0] = 0
    expect(c.tick()).toMatchObject({ waterC: 88.6, oilC: 101.2, repairS: null, optRepairS: null })
    c.frame.PitRepairLeft[0] = 12
    c.frame.PitOptRepairLeft[0] = Number.NaN
    expect(c.tick()).toMatchObject({ repairS: 12, optRepairS: null })
    const absent = {
      ...c.frame,
      WaterTemp: [],
      OilTemp: [],
      PitRepairLeft: [],
      PitOptRepairLeft: []
    }
    absent.SessionTime = [999]
    expect(c.e.read(absent, c.session, c.race)).toMatchObject({
      waterC: null,
      oilC: null,
      repairS: null,
      optRepairS: null
    })
    c.frame.IsOnTrack[0] = false
    expect(c.tick()).toMatchObject({ waterC: null, repairS: null })
  })

  it('is computed once a tick: the band and the strip read the same object', () => {
    const c = new Car().bits(EngineWarning.WaterTemp)
    const first = c.tick()
    expect(c.e.read(c.frame, c.session, c.race)).toBe(first)
    // Another frame, or another time, is another state.
    expect(c.e.read({ ...c.frame }, c.session, c.race)).not.toBe(first)
    expect(c.tick()).not.toBe(first)
    expect(c.tick()).toEqual(first)
  })
})

/** A RaceCarState with every field, for a fake RaceView. */
function carState(o: Partial<RaceCarState> = {}): RaceCarState {
  return {
    carIdx: 0,
    distance: 10,
    classPosition: 1,
    overallPosition: 1,
    inWorld: true,
    inPits: false,
    offTrack: false,
    disconnected: false,
    finished: false,
    pitStops: 0,
    towStops: 0,
    towed: false,
    towedAt: NaN,
    lastPitLap: null,
    outLap: false,
    stintLaps: 10,
    lastLapTime: 100,
    bestLapTime: 100,
    laps: [],
    pace: 100,
    speed: 0.01,
    stoppedForS: 0,
    lapInvalid: false,
    sessionFlags: 0,
    ...o
  }
}

describe('EngineMonitor: the temperature trend', () => {
  /**
   * Laps of 30 s at 10 Hz with the RaceModel's clean verdict, WaterTemp `water`, OilTemp `oil`
   * and a car `gapS` ahead on track (null: nobody near).
   */
  class Session {
    readonly c = new Car()
    private laps: LapRecord[] = []
    lap = 0
    gapS: number | null = null

    constructor() {
      this.c.session = makeSession(3, { trackLengthM: 4000 })
      this.c.race = {
        ...EMPTY_RACE_VIEW,
        car: (i) => (i === 0 ? carState({ laps: this.laps }) : carState({ carIdx: i })),
        cars: () => [carState(), carState({ carIdx: 1 })]
      }
      const f = this.c.frame
      f.Speed[0] = 40
      f.Gear[0] = 4
      f.CarIdxTrackSurface[0] = TrackLocation.OnTrack
      f.CarIdxTrackSurface[1] = TrackLocation.OnTrack
    }

    /** `water`: °C, or °C at each SessionTime; the oil at 100 °C unless given. */
    run(
      seconds: number,
      water: number | ((t: number) => number),
      oil: number | ((t: number) => number) = 100
    ): EngineState {
      const f = this.c.frame
      let last = this.c.tick()
      const at = (v: number | ((t: number) => number)): number =>
        typeof v === 'number' ? v : v(f.SessionTime[0] ?? 0)
      for (let i = 0; i < Math.round(seconds * 10); i++) {
        const pct = ((f.SessionTime[0] ?? 0) / 30) % 1
        f.WaterTemp[0] = at(water)
        f.OilTemp[0] = at(oil)
        f.LapDistPct[0] = pct
        f.CarIdxLapDistPct[0] = pct
        f.CarIdxLapDistPct[1] = this.gapS === null ? (pct + 0.5) % 1 : (pct + this.gapS / 100) % 1
        // A lap every 30 s, clean.
        const lap = Math.floor((f.SessionTime[0] ?? 0) / 30)
        if (lap !== this.lap) {
          this.lap = lap
          this.laps = [{ lap, time: 30, clean: true }, ...this.laps].slice(0, 10)
        }
        f.CarIdxLapCompleted[0] = lap
        last = this.c.tick()
      }
      return last
    }
  }

  // Readings move a few degrees a second at most: a step of more than jumpC is a repair.
  const rise = (s: Session, water: number, oil = 100): void => {
    s.run(1, water - 4, oil > 100 ? oil - 4 : oil)
  }

  it('says when the water stays well above your clean-lap average', () => {
    const s = new Session()
    expect(s.run(120, 88).waterTrend).toBeNull()
    rise(s, 96)
    expect(s.run(15, 96).waterTrend).toBeNull()
    expect(s.run(ENGINE_TREND.sustainS, 96)).toMatchObject({
      waterTrend: { kind: 'engineTrend', fluid: 'water', tempC: 96, deltaC: 8, draft: false },
      oilTrend: null
    })
  })

  it('both fluids at once, each on its own light', () => {
    const s = new Session()
    s.run(120, 88, 100)
    rise(s, 96, 108)
    expect(s.run(40, 96, 108)).toMatchObject({
      waterTrend: { fluid: 'water', deltaC: 8 },
      oilTrend: { fluid: 'oil', deltaC: 8 }
    })
  })

  it('suggests slipstreaming while close behind another car', () => {
    const s = new Session()
    s.gapS = 0.6
    s.run(120, 88)
    rise(s, 96)
    expect(s.run(60, 96).waterTrend).toMatchObject({ draft: true })
    // The pace car is never "close behind" (RaceView.cars leaves it out), nor a car further.
    const far = new Session()
    far.gapS = ENGINE.draftGapS * 1.5
    far.run(120, 88)
    rise(far, 96)
    expect(far.run(60, 96).waterTrend).toMatchObject({ draft: false })
  })

  it('a warm-up is no reference: only a lap within stableC of the one before (Q6)', () => {
    const s = new Session()
    // Online: after a repair the oil climbed ~1.5 °C a lap; laps taken then made a reference
    // below the engine's normal, and the climb went on towards a false notice.
    s.run(150, (t) => 80 + (1.5 * t) / 30)
    expect(s.run(40, 95).waterTrend).toBeNull()
    s.run(100, 95)
    rise(s, 101)
    expect(s.run(40, 101).waterTrend).toMatchObject({ fluid: 'water', tempC: 101, deltaC: 6 })
  })

  it('a tow or a reading jumping more than jumpC starts the reference over (Q6)', () => {
    for (const reset of ['tow', 'jump'] as const) {
      const s = new Session()
      s.run(120, 88)
      if (reset === 'tow') {
        s.c.frame.PlayerCarTowTime[0] = 30
        s.run(1, 88)
        s.c.frame.PlayerCarTowTime[0] = 0
      } else {
        // Online: the repair at the end of the tow, the oil from 73.4 to 61.4 °C at once.
        s.run(1, 88 - ENGINE_TREND.jumpC - 0.5)
        s.run(1, 88)
      }
      rise(s, 96)
      expect(s.run(40, 96).waterTrend, reset).toBeNull()
    }
  })

  it('a new session (reset) forgets the reference', () => {
    const s = new Session()
    s.run(120, 88)
    s.c.e.reset()
    rise(s, 96)
    expect(s.run(40, 96).waterTrend).toBeNull()
  })

  it('skips a car without the reading', () => {
    const s = new Session()
    s.run(120, 88)
    const frame = { ...s.c.frame, WaterTemp: [], OilTemp: [] }
    frame.SessionTime = [(s.c.frame.SessionTime[0] ?? 0) + 0.1]
    expect(s.c.e.read(frame, s.c.session, s.c.race)).toMatchObject({
      waterTrend: null,
      oilTrend: null
    })
  })
})
