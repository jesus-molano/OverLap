import { describe, expect, it } from 'vitest'
import {
  ALERTS,
  ALERT_ORDER,
  AlertsProvider,
  ENGINE_WARNING_BITS,
  FLAG_BITS,
  FLAG_ORDER,
  NOTICE_OPTION,
  NOTICE_ORDER,
  alertsEqual,
  pitLimiterState
} from './alerts'
import { EngineWarning, SessionFlag } from './flags'
import { DAMAGE } from './notices/damage'
import { ENGINE_TREND } from './notices/engineTrend'
import { LAPS_TO_GO } from './notices/lapsToGo'
import { EMPTY_RACE_VIEW } from './race/emptyRaceView'
import { makeFrame, makeSession } from './race/testing/raceSim'
import type { MutableFrame } from './race/testing/raceSim'
import type { LapRecord, RaceCarState, RaceView } from './race/raceView'
import { defaultOptions } from './settings'
import { TrackLocation } from './telemetry'
import type {
  AlertNotice,
  AlertsData,
  AlertsOptions,
  FlagKind,
  IncidentAlert,
  NoticeKind,
  SessionMeta
} from './types'

const OPTS: AlertsOptions = { ...defaultOptions('alerts'), holdS: 0 }

/** The player is CarIdx 0 of a 3-car session with a 60 km/h pit limit. */
class Tick {
  readonly frame: MutableFrame = makeFrame()
  session: SessionMeta = makeSession(3, { pitSpeedLimitKmh: 60 })
  race: RaceView = EMPTY_RACE_VIEW
  readonly p = new AlertsProvider()
  /** 10 Hz ticks since SessionTime 100 s (an integer count, so times do not drift). */
  private n = 0

  /**
   * The tick `ticks` later (default the next one at 10 Hz; negative: the clock went back), seen
   * by observe() then computed, as the telemetry loop does.
   */
  run(o: Partial<AlertsOptions> = {}, ticks = 1): AlertsData {
    this.n += ticks
    this.frame.SessionTime[0] = (1000 + this.n) / 10
    this.p.observe(this.frame, this.session, this.race)
    return this.p.compute(this.frame, this.session, this.race, { ...OPTS, ...o })
  }

  /** Every 10 Hz tick for `seconds`; the last payload. */
  runFor(seconds: number, o: Partial<AlertsOptions> = {}): AlertsData {
    let last = this.run(o)
    for (let k = 1; k < Math.round(seconds * 10); k++) last = this.run(o)
    return last
  }

  flags(session: number, mine = 0): this {
    this.frame.SessionFlags[0] = session
    this.frame.CarIdxSessionFlags[0] = mine
    return this
  }

  pit(onPitRoad: boolean, limiter: boolean, speedMs = 16): this {
    this.frame.OnPitRoad[0] = onPitRoad
    this.frame.EngineWarnings[0] = limiter ? EngineWarning.PitSpeedLimiter : 0
    this.frame.Speed[0] = speedMs
    return this
  }

  warnings(bits: number): this {
    this.frame.EngineWarnings[0] = bits
    return this
  }
}

const kinds = (d: AlertsData): NoticeKind[] => d.notices.map((n) => n.kind)

describe('flags', () => {
  it('maps every flag to its bits, most important first', () => {
    expect(FLAG_ORDER).toHaveLength(Object.keys(FLAG_BITS).length)
    const k = new Tick()
    k.run()
    // Everything at once (but green, which needs its start): yellow and white are covered by
    // the caution and the chequered flag.
    let all = 0
    for (const kind of FLAG_ORDER) if (kind !== 'green') all |= FLAG_BITS[kind]
    expect(k.flags(all).run().flags).toEqual([
      'disqualified',
      'black',
      'meatball',
      'red',
      'caution',
      'debris',
      'furled',
      'blue',
      'checkered'
    ])
  })

  it('each flag alone, from the session or from your own car', () => {
    const cases: [number, FlagKind][] = [
      [SessionFlag.Disqualify, 'disqualified'],
      [SessionFlag.Black, 'black'],
      [SessionFlag.Repair, 'meatball'],
      [SessionFlag.Red, 'red'],
      [SessionFlag.Caution, 'caution'],
      [SessionFlag.CautionWaving, 'caution'],
      [SessionFlag.Yellow, 'yellow'],
      [SessionFlag.YellowWaving, 'yellow'],
      [SessionFlag.Debris, 'debris'],
      [SessionFlag.Furled, 'furled'],
      [SessionFlag.Blue, 'blue'],
      [SessionFlag.White, 'white'],
      [SessionFlag.Checkered, 'checkered']
    ]
    // A tick without any first: the chequered flag counts from its edge, like the green one.
    const fresh = (): Tick => {
      const k = new Tick()
      k.run()
      return k
    }
    for (const [bit, kind] of cases) {
      expect(fresh().flags(bit).run().flags, kind).toEqual([kind])
      expect(fresh().flags(0, bit).run().flags, kind).toEqual([kind])
    }
  })

  it('none out of the car: the replay, the session screen, the garage (B07)', () => {
    const k = new Tick()
    k.run()
    expect(k.flags(SessionFlag.Debris | SessionFlag.Checkered).run().flags).toEqual([
      'debris',
      'checkered'
    ])
    k.frame.IsOnTrack[0] = false
    expect(k.run({ holdS: 5 })).toMatchObject({ visible: false, flags: [] })
    // Back in the car the chequered flag is long gone (it counts from its edge).
    k.frame.IsOnTrack[0] = true
    expect(k.runFor(ALERTS.checkeredMinS).flags).toEqual(['debris'])
  })

  it('ignores the furled flag once you took the chequered flag (Q3); 0x40000 is no flag', () => {
    const k = new Tick().flags(SessionFlag.Servicible, SessionFlag.Furled | SessionFlag.Servicible)
    expect(k.run().flags).toEqual(['furled'])
    k.race = {
      ...EMPTY_RACE_VIEW,
      car: (i) => (i === 0 ? carState({ finished: true }) : undefined)
    }
    expect(k.run()).toMatchObject({ visible: false, flags: [] })
    // The black flag still applies.
    expect(k.flags(0, SessionFlag.Furled | SessionFlag.Black).run().flags).toEqual(['black'])
    // Servicible alone (in almost every sample online) is nothing.
    expect(new Tick().flags(SessionFlag.Servicible, SessionFlag.Servicible).run().flags).toEqual([])
  })

  it('reads the bit fields as unsigned (the start-light bit makes them negative)', () => {
    const start = 0x80000000 | 0
    expect(start).toBeLessThan(0)
    expect(new Tick().flags(start | SessionFlag.Yellow, start).run().flags).toEqual(['yellow'])
    expect(new Tick().flags(0, start | SessionFlag.Furled).run().flags).toEqual(['furled'])
  })

  it("other cars' flags do not apply to you; bits nobody shows are ignored", () => {
    const k = new Tick().flags(SessionFlag.Servicible | SessionFlag.TenToGo)
    k.frame.CarIdxSessionFlags[1] = SessionFlag.Black | SessionFlag.Blue | SessionFlag.Furled
    expect(k.run()).toMatchObject({ visible: false, flags: [] })
    // PlayerCarIdx says which car is yours.
    k.frame.PlayerCarIdx[0] = 1
    expect(k.run().flags).toEqual(['black', 'furled', 'blue'])
  })

  it('the blue and the furled flag have their own toggles; showFlags hides them all', () => {
    const k = new Tick().flags(SessionFlag.Yellow, SessionFlag.Blue | SessionFlag.Furled)
    expect(k.run().flags).toEqual(['yellow', 'furled', 'blue'])
    expect(k.run({ showBlue: false }).flags).toEqual(['yellow', 'furled'])
    expect(k.run({ showFurled: false }).flags).toEqual(['yellow', 'blue'])
    expect(k.run({ showFlags: false })).toMatchObject({ visible: false, flags: [] })
  })

  it('a flag stays holdS seconds of SessionTime after it was last seen', () => {
    const k = new Tick()
    expect(k.flags(SessionFlag.Debris).run({ holdS: 2 }).flags).toEqual(['debris'])
    k.flags(0)
    expect(k.runFor(1, { holdS: 2 }).flags).toEqual(['debris'])
    expect(k.runFor(0.9, { holdS: 2 }).flags).toEqual(['debris'])
    expect(k.runFor(0.2, { holdS: 2 }).flags).toEqual([])
    // Seen again: the hold starts over.
    k.flags(SessionFlag.Debris).run({ holdS: 2 })
    k.flags(0)
    expect(k.runFor(0.5, { holdS: 2 }).flags).toEqual(['debris'])
    // holdS 0: only while it is out.
    expect(k.run({ holdS: 0 }).flags).toEqual([])
  })

  it('holds keep the priority order and a covered flag stays covered', () => {
    const k = new Tick()
    k.flags(SessionFlag.Yellow).run({ holdS: 3 })
    // The caution comes out as the local yellow goes.
    expect(k.flags(SessionFlag.Caution).run({ holdS: 3 }).flags).toEqual(['caution'])
    expect(k.flags(SessionFlag.Blue).run({ holdS: 3 }).flags).toEqual(['caution', 'blue'])
  })
})

describe('the green flag (a start signal)', () => {
  it('shows for max(holdS, ALERTS.greenMinS) from the tick its bit appears', () => {
    const k = new Tick()
    k.run()
    k.flags(SessionFlag.Green)
    expect(k.run().flags).toEqual(['green'])
    expect(k.runFor(ALERTS.greenMinS - 0.2).flags).toEqual(['green'])
    // The bit stays on all race: the flag does not.
    expect(k.runFor(0.3).flags).toEqual([])
    expect(k.runFor(10).flags).toEqual([])
    // A longer hold makes it last longer.
    const h = new Tick()
    h.run({ holdS: 5 })
    h.flags(SessionFlag.Green).run({ holdS: 5 })
    expect(h.runFor(4.8, { holdS: 5 }).flags).toEqual(['green'])
    expect(h.runFor(0.3, { holdS: 5 }).flags).toEqual([])
  })

  it('a pulse is shown in full; a restart after a caution shows it again', () => {
    const k = new Tick()
    k.run()
    k.flags(SessionFlag.Green).run()
    k.flags(0)
    expect(k.run().flags).toEqual(['green'])
    expect(k.runFor(2.5).flags).toEqual(['green'])
    // A caution ends it at once (holdS 0).
    k.flags(SessionFlag.Green | SessionFlag.Caution)
    expect(k.run().flags).toEqual(['caution'])
    k.flags(SessionFlag.Caution)
    k.run()
    // Green again: the restart.
    expect(k.flags(SessionFlag.Green).run().flags).toEqual(['green'])
  })

  it('the green of the restart ends a held caution or red flag; a held debris flag stays', () => {
    const k = new Tick()
    k.flags(SessionFlag.Caution | SessionFlag.Debris).run({ holdS: 3 })
    k.flags(0)
    expect(k.run({ holdS: 3 }).flags).toEqual(['caution', 'debris'])
    expect(k.flags(SessionFlag.Green).run({ holdS: 3 }).flags).toEqual(['debris', 'green'])
    const r = new Tick()
    r.flags(SessionFlag.Red).run({ holdS: 3 })
    expect(r.flags(SessionFlag.Green).run({ holdS: 3 }).flags).toEqual(['green'])
  })

  it('not when it was already out when the provider started (joining mid-race)', () => {
    const k = new Tick().flags(SessionFlag.Green)
    expect(k.run().flags).toEqual([])
    expect(k.run().flags).toEqual([])
    // Nor after a gap in the computes (the widget was hidden while it came out).
    const g = new Tick()
    g.run()
    g.flags(SessionFlag.Green)
    expect(g.run({}, (ALERTS.staleS + 0.5) * 10).flags).toEqual([])
  })

  it('reset() and a clock going back forget the holds and the green start', () => {
    const k = new Tick()
    k.run()
    k.flags(SessionFlag.Green | SessionFlag.Debris).run({ holdS: 5 })
    k.flags(0)
    expect(k.run({ holdS: 5 }).flags).toEqual(['debris', 'green'])
    k.p.reset()
    expect(k.run({ holdS: 5 }).flags).toEqual([])

    const b = new Tick()
    b.flags(SessionFlag.Debris).run({ holdS: 5 })
    b.flags(0)
    expect(b.run({ holdS: 5 }, -10).flags).toEqual([])
  })
})

describe('the chequered flag (B07)', () => {
  it('shows for max(holdS, ALERTS.checkeredMinS) from its edge, though the bit stays on', () => {
    const k = new Tick()
    k.run()
    k.flags(SessionFlag.Checkered)
    expect(k.run().flags).toEqual(['checkered'])
    expect(k.runFor(ALERTS.checkeredMinS - 0.2).flags).toEqual(['checkered'])
    // Online the bit stayed on for minutes, until the session changed: the flag does not.
    expect(k.runFor(0.3)).toMatchObject({ visible: false, flags: [] })
    expect(k.runFor(120).flags).toEqual([])
    // A longer hold makes it last longer.
    const h = new Tick()
    h.run({ holdS: 10 })
    h.flags(SessionFlag.Checkered).run({ holdS: 10 })
    expect(h.runFor(9.8, { holdS: 10 }).flags).toEqual(['checkered'])
    expect(h.runFor(0.3, { holdS: 10 }).flags).toEqual([])
  })

  it('not when it was already out (joining, a gap in the computes)', () => {
    const k = new Tick().flags(SessionFlag.Checkered)
    expect(k.run().flags).toEqual([])
    const g = new Tick()
    g.run()
    g.flags(SessionFlag.Checkered)
    expect(g.run({}, (ALERTS.staleS + 0.5) * 10).flags).toEqual([])
  })

  it('the last lap is over with it, also once it is no longer shown', () => {
    const k = new Tick()
    k.flags(SessionFlag.White).run({ holdS: 3 })
    expect(k.flags(SessionFlag.White | SessionFlag.Checkered).run({ holdS: 3 }).flags).toEqual([
      'checkered'
    ])
    expect(k.runFor(ALERTS.checkeredMinS + 1, { holdS: 3 }).flags).toEqual([])
  })
})

describe('pit limiter', () => {
  it('null off pit road, on / OFF on it', () => {
    const k = new Tick().pit(false, true)
    expect(k.run()).toEqual({
      visible: false,
      flags: [],
      notices: [],
      pitLimiter: null,
      speedKmh: 0,
      pitLimitKmh: 60,
      incident: null,
      inBox: false
    })
    expect(k.pit(true, false).run()).toEqual({
      visible: true,
      flags: [],
      notices: [],
      pitLimiter: 'off',
      speedKmh: 58,
      pitLimitKmh: 60,
      incident: null,
      inBox: false
    })
    expect(k.pit(true, true).run()).toMatchObject({ visible: true, pitLimiter: 'on' })
  })

  it('not read while towed, nor for teleportS after the car appears in its box (B10)', () => {
    // Online: the tow puts the car in its stall on pit road (surface -1 -> 1), and the limiter
    // bit comes 0.95 s later; the tow countdown starts in between.
    const k = new Tick()
    k.frame.PlayerTrackSurface[0] = TrackLocation.NotInWorld
    k.pit(false, false, 0).run()
    k.frame.PlayerTrackSurface[0] = TrackLocation.InPitStall
    expect(k.pit(true, false, 0).run().pitLimiter).toBeNull()
    expect(k.runFor(ALERTS.teleportS - 0.2).pitLimiter).toBeNull()
    k.frame.PlayerCarTowTime[0] = 60
    expect(k.pit(true, true, 0).runFor(1)).toMatchObject({ pitLimiter: null, inBox: true })
    // The tow over: the limiter line is back (on), and so is OFF; still in the box.
    k.frame.PlayerCarTowTime[0] = 0
    expect(k.run()).toMatchObject({ pitLimiter: 'on', inBox: true })
    expect(k.pit(true, false, 0).run().pitLimiter).toBe('off')
    // Out of the stall onto pit road: the meatball would say "pit" again.
    k.frame.PlayerTrackSurface[0] = TrackLocation.ApproachingPits
    expect(k.run().inBox).toBe(false)
    // Getting in the car in the box is the same jump: OFF waits teleportS too.
    const g = new Tick()
    g.frame.PlayerTrackSurface[0] = TrackLocation.NotInWorld
    g.run()
    g.frame.PlayerTrackSurface[0] = TrackLocation.InPitStall
    g.pit(true, false, 0)
    expect(g.runFor(ALERTS.teleportS - 0.2).pitLimiter).toBeNull()
    expect(g.runFor(0.4).pitLimiter).toBe('off')
  })

  it('over the known limit by more than 1 km/h, with the limiter on or off', () => {
    const k = new Tick()
    // 17 m/s = 61.2 -> 61 km/h: not more than 1 over 60.
    expect(k.pit(true, true, 17).run()).toMatchObject({ pitLimiter: 'on', speedKmh: 61 })
    expect(k.pit(true, false, 17).run()).toMatchObject({ pitLimiter: 'off', speedKmh: 61 })
    // 17.1 m/s = 61.56 -> 62 km/h.
    expect(k.pit(true, true, 17.1).run()).toMatchObject({ pitLimiter: 'speeding', speedKmh: 62 })
    // Today's "OFF even at 80" says how much over too ('EXCESO 90/60 · LIMITADOR OFF')...
    expect(k.pit(true, false, 25).run()).toMatchObject({ pitLimiter: 'offSpeeding', speedKmh: 90 })
    // ...unless its option is off.
    expect(k.run({ showPitOverspeed: false })).toMatchObject({ pitLimiter: 'off', speedKmh: 90 })
    // Unknown limit: never over it.
    k.session = makeSession(3, { pitSpeedLimitKmh: null })
    expect(k.pit(true, true, 40).run()).toMatchObject({ pitLimiter: 'on', pitLimitKmh: null })
    expect(k.pit(true, false, 40).run()).toMatchObject({ pitLimiter: 'off', pitLimitKmh: null })
  })

  it('no false OFF without EngineWarnings; the option hides it', () => {
    const k = new Tick().pit(true, false)
    expect(k.run({ showPitLimiter: false })).toMatchObject({ visible: false, pitLimiter: null })
    const frame = { ...k.frame, EngineWarnings: [] }
    const p = new AlertsProvider()
    expect(p.compute(frame, k.session, EMPTY_RACE_VIEW, OPTS).pitLimiter).toBeNull()
  })

  it('without OnPitRoad, falls back to CarIdxOnPitRoad of your car', () => {
    const k = new Tick().pit(false, true)
    k.frame.CarIdxOnPitRoad[0] = true
    const frame = { ...k.frame, OnPitRoad: [] }
    const p = new AlertsProvider()
    expect(p.compute(frame, k.session, EMPTY_RACE_VIEW, OPTS).pitLimiter).toBe('on')
  })

  it('pitLimiterState', () => {
    const on = EngineWarning.PitSpeedLimiter | EngineWarning.WaterTemp
    expect(pitLimiterState(false, on, 50, 60)).toBeNull()
    expect(pitLimiterState(true, undefined, 50, 60)).toBeNull()
    expect(pitLimiterState(true, Number.NaN, 50, 60)).toBeNull()
    expect(pitLimiterState(true, EngineWarning.Stalled, 0, 60)).toBe('off')
    expect(pitLimiterState(true, EngineWarning.Stalled, 68, 60)).toBe('offSpeeding')
    expect(pitLimiterState(true, 0, 68, 60, false)).toBe('off')
    expect(pitLimiterState(true, on, 61, 60)).toBe('on')
    expect(pitLimiterState(true, on, 62, 60)).toBe('speeding')
    expect(pitLimiterState(true, on, 200, null)).toBe('on')
    // Signed Int32 bit fields.
    expect(pitLimiterState(true, on | 0x80000000 | 0, 50, 60)).toBe('on')
  })

  it('flags and the limiter together', () => {
    const k = new Tick().pit(true, true).flags(0, SessionFlag.Black)
    expect(k.run()).toMatchObject({ visible: true, flags: ['black'], pitLimiter: 'on' })
  })
})

describe('order of the alerts', () => {
  it('lists every flag and every notice once, each list in its own order', () => {
    const all = [...FLAG_ORDER, ...NOTICE_ORDER]
    expect([...ALERT_ORDER].sort()).toEqual([...all].sort())
    expect(new Set(ALERT_ORDER).size).toBe(ALERT_ORDER.length)
    const flags = new Set<string>(FLAG_ORDER)
    expect(ALERT_ORDER.filter((k) => flags.has(k))).toEqual(FLAG_ORDER)
    expect(ALERT_ORDER.filter((k) => !flags.has(k))).toEqual(NOTICE_ORDER)
    expect(Object.keys(NOTICE_OPTION).sort()).toEqual([...NOTICE_ORDER].sort())
  })

  it('puts the wrong way and the pit entry above the caution, the trend last', () => {
    const rank = (k: (typeof ALERT_ORDER)[number]): number => ALERT_ORDER.indexOf(k)
    expect(rank('wrongWay')).toBeLessThan(rank('black'))
    expect(rank('pitEntry')).toBeLessThan(rank('caution'))
    expect(rank('stalled')).toBeLessThan(rank('caution'))
    expect(rank('lapsToGo')).toBeGreaterThan(rank('white'))
    expect(ALERT_ORDER.at(-1)).toBe('engineTrend')
  })

  it('puts the tow above the meatball, the stall and the pressures; damage before them (Q2)', () => {
    const rank = (k: (typeof ALERT_ORDER)[number]): number => ALERT_ORDER.indexOf(k)
    for (const k of ['meatball', 'stalled', 'oilPressure', 'fuelPressure', 'damage'] as const) {
      expect(rank('tow'), k).toBeLessThan(rank(k))
    }
    expect(rank('damage')).toBeGreaterThan(rank('meatball'))
    expect(rank('damage')).toBeLessThan(rank('stalled'))
  })
})

describe('engine', () => {
  it('a stall, only while in the car', () => {
    const k = new Tick().warnings(EngineWarning.Stalled)
    expect(k.run()).toMatchObject({ visible: true, notices: [{ kind: 'stalled' }] })
    k.frame.IsOnTrack[0] = false
    expect(k.run().notices).toEqual([])
    k.frame.IsOnTrack[0] = true
    expect(k.run({ showStalled: false })).toMatchObject({ visible: false, notices: [] })
  })

  it('each warning light, most harmful first; the pressures not while stalled', () => {
    const k = new Tick()
    k.frame.Speed[0] = 20
    for (const [kind, bit] of Object.entries(ENGINE_WARNING_BITS)) {
      expect(k.warnings(bit).run().notices, kind).toEqual([{ kind }])
    }
    const all = Object.values(ENGINE_WARNING_BITS).reduce((a, b) => a | b, 0)
    expect(kinds(k.warnings(all).run())).toEqual([
      'oilPressure',
      'fuelPressure',
      'water',
      'oilTemp'
    ])
    // No engine running, no pressure: the stall says it all.
    expect(kinds(k.warnings(all | EngineWarning.Stalled).run())).toEqual([
      'stalled',
      'water',
      'oilTemp'
    ])
    expect(k.run({ showEngineWarnings: false }).notices).toEqual([{ kind: 'stalled' }])
    // Signed Int32.
    expect(kinds(k.warnings(EngineWarning.WaterTemp | 0x80000000 | 0).run())).toEqual(['water'])
    // The limiter and the repairs bits are not warning lights (the repairs are damage).
    const other = EngineWarning.PitSpeedLimiter | EngineWarning.MandatoryRepairs
    expect(kinds(k.warnings(other).run())).toEqual(['damage'])
    expect(k.run({ showDamage: false }).notices).toEqual([])
  })

  it('holds a flickering light holdS, like a flag', () => {
    const k = new Tick().warnings(EngineWarning.OilPressure)
    k.frame.Speed[0] = 20
    k.run({ holdS: 2 })
    k.warnings(0)
    expect(kinds(k.runFor(1.9, { holdS: 2 }))).toEqual(['oilPressure'])
    expect(k.runFor(0.2, { holdS: 2 }).notices).toEqual([])
  })

  it('the pressures need the engine running: moving, or stopped at 80 % of its idle (Q2)', () => {
    const k = new Tick().warnings(EngineWarning.OilPressure | EngineWarning.FuelPressure)
    k.session = makeSession(3, { driverCarIdleRpm: 875 })
    k.frame.Speed[0] = 0
    k.frame.RPM[0] = 300
    // Online: stopped after a crash, the engine hunting at 300..600 rpm with the light on.
    expect(k.run().notices).toEqual([])
    k.frame.RPM[0] = 0.8 * 875 - 1
    expect(k.run().notices).toEqual([])
    k.frame.RPM[0] = 0.8 * 875
    expect(kinds(k.run())).toEqual(['oilPressure', 'fuelPressure'])
    // Moving: whatever the revs say.
    k.frame.RPM[0] = 0
    k.frame.Speed[0] = ALERTS.movingMs + 0.5
    expect(kinds(k.run())).toEqual(['oilPressure', 'fuelPressure'])
    // Without the car's idle (or the revs) only moving counts; the temperatures need neither.
    k.session = makeSession(3)
    k.frame.Speed[0] = 1
    k.frame.RPM[0] = 2000
    expect(k.run().notices).toEqual([])
    expect(kinds(k.warnings(EngineWarning.WaterTemp).run())).toEqual(['water'])
  })

  it('quiet while towed, in the box and as you get in the car (Q2)', () => {
    const lights = EngineWarning.OilPressure | EngineWarning.Stalled | EngineWarning.WaterTemp
    // Towed (online: EngineWarnings alternating 400/404/412 all the tow long).
    const t = new Tick().warnings(lights)
    t.frame.PlayerCarTowTime[0] = 50
    expect(kinds(t.run())).toEqual(['tow'])
    // In the box after it, the engine starting.
    t.frame.PlayerCarTowTime[0] = 0
    t.frame.PlayerTrackSurface[0] = TrackLocation.InPitStall
    expect(t.run().notices).toEqual([])
    t.frame.PlayerTrackSurface[0] = TrackLocation.OnTrack
    expect(kinds(t.run())).toEqual(['stalled', 'water'])

    // Getting in the car: the engine starts (online: 12 -> 4 -> 0 in 1.6 s at the grid).
    const g = new Tick().warnings(lights)
    g.frame.IsOnTrack[0] = false
    g.run()
    g.frame.IsOnTrack[0] = true
    expect(g.runFor(ALERTS.inCarSettleS - 0.2).notices).toEqual([])
    expect(kinds(g.runFor(0.4))).toEqual(['stalled', 'water'])
    // Already in the car when the provider starts: nothing to wait for.
    expect(kinds(new Tick().warnings(lights).run())).toEqual(['stalled', 'water'])
  })

  it('quiet out of the world and as the car reappears; nothing held carries into it (Q2)', () => {
    // Online: stalled after the crash, the tow lifts the car (surface -1) with the stall light
    // on, puts it in its stall 20 ms later and only then starts counting down.
    const lights = EngineWarning.OilPressure | EngineWarning.Stalled
    const k = new Tick().warnings(lights)
    expect(kinds(k.run({ holdS: 3 }))).toEqual(['stalled'])
    k.frame.PlayerTrackSurface[0] = TrackLocation.NotInWorld
    expect(k.run({ holdS: 3 }).notices).toEqual([])
    // Back in the world, still before the countdown: not for teleportS, and the hold is gone.
    k.frame.PlayerTrackSurface[0] = TrackLocation.OnTrack
    k.warnings(0)
    expect(k.runFor(ALERTS.teleportS - 0.2, { holdS: 3 }).notices).toEqual([])
    k.warnings(lights)
    expect(k.run({ holdS: 3 }).notices).toEqual([])
    expect(kinds(k.runFor(0.4, { holdS: 3 }))).toEqual(['stalled'])
  })
})

describe('damage (Q12)', () => {
  it('mandatory repairs while pending, before the meatball comes out; then the meatball', () => {
    const k = new Tick()
    k.run()
    // Online: optional at 370.25, mandatory 20 ms later, the meatball 10 s after.
    k.warnings(EngineWarning.OptionalRepairs | EngineWarning.MandatoryRepairs)
    expect(k.run().notices).toEqual([{ kind: 'damage', mandatory: true }])
    expect(k.runFor(10).notices).toEqual([{ kind: 'damage', mandatory: true }])
    expect(k.flags(SessionFlag.Repair).run()).toMatchObject({ flags: ['meatball'], notices: [] })
    // Without the flags shown, the damage still says it.
    expect(k.run({ showFlags: false }).notices).toEqual([{ kind: 'damage', mandatory: true }])
    expect(k.run({ showFlags: false, showDamage: false })).toMatchObject({ visible: false })
    // Repaired.
    k.flags(0).warnings(EngineWarning.PitSpeedLimiter)
    expect(k.run().notices).toEqual([])
  })

  it('optional repairs for a few seconds after they appear, once', () => {
    const k = new Tick()
    k.run()
    k.warnings(EngineWarning.OptionalRepairs)
    expect(k.run().notices).toEqual([{ kind: 'damage', mandatory: false }])
    expect(k.runFor(DAMAGE.optionalS - 0.3).notices).toEqual([{ kind: 'damage', mandatory: false }])
    expect(k.runFor(0.4).notices).toEqual([])
    expect(k.runFor(60).notices).toEqual([])
    // A longer hold makes it last longer.
    const h = new Tick()
    h.run({ holdS: 9 })
    h.warnings(EngineWarning.OptionalRepairs)
    expect(h.runFor(8.5, { holdS: 9 }).notices).toEqual([{ kind: 'damage', mandatory: false }])
    // Already damaged when the provider starts: not new.
    expect(new Tick().warnings(EngineWarning.OptionalRepairs).run().notices).toEqual([])
  })

  it('not out of the car, towed or in the box', () => {
    const k = new Tick()
    k.run()
    k.warnings(EngineWarning.MandatoryRepairs)
    k.frame.PlayerCarTowTime[0] = 30
    expect(kinds(k.run())).toEqual(['tow'])
    k.frame.PlayerCarTowTime[0] = 0
    k.frame.PlayerTrackSurface[0] = TrackLocation.InPitStall
    expect(k.run().notices).toEqual([])
    k.frame.PlayerTrackSurface[0] = TrackLocation.OnTrack
    k.frame.IsOnTrack[0] = false
    expect(k.run().notices).toEqual([])
  })
})

describe('pit entry reminder', () => {
  it('from the track onto the lead-in with the limiter off, until pit road', () => {
    const k = new Tick().pit(false, false, 40)
    k.frame.PlayerTrackSurface[0] = TrackLocation.OnTrack
    expect(k.run().notices).toEqual([])
    k.frame.PlayerTrackSurface[0] = TrackLocation.ApproachingPits
    expect(k.run()).toMatchObject({ visible: true, notices: [{ kind: 'pitEntry' }] })
    // Not held: the limiter goes on, the reminder goes at once.
    expect(k.pit(false, true, 30).run({ holdS: 5 }).notices).toEqual([])
    expect(kinds(k.pit(false, false, 30).run())).toEqual(['pitEntry'])
    // On pit road the limiter line speaks; on the way out (same surface) nothing.
    expect(k.pit(true, false, 16).run()).toMatchObject({ notices: [], pitLimiter: 'off' })
    expect(k.pit(false, false, 20).run().notices).toEqual([])
    expect(k.run({ showPitEntry: false }).notices).toEqual([])
  })

  it('has its own toggle', () => {
    const k = new Tick().pit(false, false, 40)
    k.run()
    k.frame.PlayerTrackSurface[0] = TrackLocation.ApproachingPits
    expect(k.run({ showPitEntry: false })).toMatchObject({ visible: false, notices: [] })
  })
})

describe('tow', () => {
  it('counts down in whole seconds while towed', () => {
    const k = new Tick()
    k.frame.PlayerCarTowTime[0] = 41.2
    expect(k.run().notices).toEqual([{ kind: 'tow', seconds: 42 }])
    k.frame.PlayerCarTowTime[0] = 0
    expect(k.run().notices).toEqual([])
    k.frame.PlayerCarTowTime[0] = 12
    expect(k.run({ showTow: false }).notices).toEqual([])
    const frame = { ...k.frame, PlayerCarTowTime: [] }
    expect(new AlertsProvider().compute(frame, k.session, EMPTY_RACE_VIEW, OPTS).notices).toEqual(
      []
    )
  })

  it('first, over the meatball it takes you in for, which then says no "pit" (B10)', () => {
    const k = new Tick().flags(SessionFlag.Repair)
    k.warnings(EngineWarning.PitSpeedLimiter | EngineWarning.MandatoryRepairs)
    k.frame.OnPitRoad[0] = true
    k.frame.PlayerCarTowTime[0] = 42.8
    const d = k.run({ showTow: false })
    expect(d).toMatchObject({ flags: ['meatball'], notices: [], pitLimiter: null, inBox: true })
    expect(k.run()).toMatchObject({
      flags: ['meatball'],
      notices: [{ kind: 'tow', seconds: 43 }],
      inBox: true
    })
  })
})

describe('wrong way', () => {
  /** Driving at 30 m/s in third gear, LapDistPct moving `stepM` per tick of a 4 km lap. */
  function drive(k: Tick, from: number, stepM: number, ticks: number): AlertsData {
    k.frame.Speed[0] = 30
    k.frame.Gear[0] = 3
    let last = k.run()
    for (let i = 0; i < ticks; i++) {
      k.frame.LapDistPct[0] = from + (i * stepM) / 4000
      last = k.run()
    }
    return last
  }

  it('from your LapDistPct going backwards while driving forwards', () => {
    const k = new Tick()
    k.session = makeSession(3, { trackLengthM: 4000 })
    expect(drive(k, 0.5, 3, 10).notices).toEqual([])
    expect(kinds(drive(k, 0.6, -3, 10))).toEqual(['wrongWay'])
    expect(kinds(k.run({ showWrongWay: false }))).toEqual([])
    // Reversing on purpose is not.
    k.frame.Gear[0] = -1
    expect(k.run().notices).toEqual([])
  })

  it('falls back to CarIdxLapDistPct without LapDistPct', () => {
    const k = new Tick()
    const frame = (pct: number): MutableFrame => {
      k.frame.CarIdxLapDistPct[0] = pct
      k.frame.Speed[0] = 30
      k.frame.Gear[0] = 2
      return { ...k.frame, LapDistPct: [] }
    }
    let d: AlertsData | null = null
    for (let i = 0; i < 12; i++) {
      k.frame.SessionTime[0] = 200 + i / 10
      d = k.p.compute(frame(0.5 - i * 0.001), k.session, EMPTY_RACE_VIEW, OPTS)
    }
    expect(d && kinds(d)).toEqual(['wrongWay'])
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
    sessionFlags: 0,
    ...o
  }
}

describe('laps to go', () => {
  /** A race whose laps to go for the player are `left.value`. */
  function race(left: { value: number | null }): RaceView {
    return { ...EMPTY_RACE_VIEW, racing: true, lapsRemaining: () => left.value }
  }

  it('10 and 5 laps to go, a few seconds each, once per session', () => {
    const left = { value: 10.5 as number | null }
    const k = new Tick()
    k.race = race(left)
    expect(k.run().notices).toEqual([])
    left.value = 9.9
    expect(k.run().notices).toEqual([{ kind: 'lapsToGo', laps: 10 }])
    expect(k.runFor(LAPS_TO_GO.showS - 0.2).notices).toEqual([{ kind: 'lapsToGo', laps: 10 }])
    expect(k.runFor(0.3).notices).toEqual([])
    // A gap in the computes (the widget hidden on pit road) does not show it again.
    left.value = 10.2
    k.run({}, 30)
    left.value = 9.8
    expect(k.run().notices).toEqual([])
    left.value = 5.5
    k.run()
    left.value = 4.9
    expect(kinds(k.run())).toEqual(['lapsToGo'])
    expect(k.run({ showLapsToGo: false }).notices).toEqual([])
    // A new session (reset) starts over.
    k.p.reset()
    left.value = 10.1
    k.run()
    left.value = 10
    expect(k.run().notices).toEqual([{ kind: 'lapsToGo', laps: 10 }])
  })

  it('only racing, before the chequered flag', () => {
    const left = { value: 10.5 as number | null }
    const k = new Tick()
    k.race = { ...race(left), racing: false }
    k.run()
    left.value = 9.5
    expect(k.run().notices).toEqual([])
    const c = new Tick()
    c.race = race(left)
    c.frame.SessionState[0] = 5
    left.value = 10.5
    c.run()
    left.value = 9.5
    expect(c.run().notices).toEqual([])
  })
})

describe('engine temperature trend', () => {
  /**
   * Laps of 30 s at 10 Hz with the RaceModel's clean verdict, WaterTemp `water` and a car `gapS`
   * ahead on track (null: nobody near).
   */
  class Session {
    readonly k = new Tick()
    private laps: LapRecord[] = []
    lap = 0
    gapS: number | null = null

    constructor() {
      this.k.session = makeSession(3, { trackLengthM: 4000 })
      const race: RaceView = {
        ...EMPTY_RACE_VIEW,
        car: (i) => (i === 0 ? carState({ laps: this.laps }) : carState({ carIdx: i })),
        cars: () => [carState(), carState({ carIdx: 1 })]
      }
      this.k.race = race
      const f = this.k.frame
      f.Speed[0] = 40
      f.Gear[0] = 4
      f.CarIdxTrackSurface[0] = TrackLocation.OnTrack
      f.CarIdxTrackSurface[1] = TrackLocation.OnTrack
    }

    /** `water`: °C, or °C at each SessionTime. */
    run(
      seconds: number,
      water: number | ((t: number) => number),
      o: Partial<AlertsOptions> = {}
    ): AlertsData {
      const f = this.k.frame
      let last = this.k.run(o)
      for (let i = 0; i < Math.round(seconds * 10); i++) {
        const pct = ((this.k.frame.SessionTime[0] ?? 0) / 30) % 1
        f.WaterTemp[0] = typeof water === 'number' ? water : water(f.SessionTime[0] ?? 0)
        f.OilTemp[0] = 100
        f.LapDistPct[0] = pct
        f.CarIdxLapDistPct[0] = pct
        f.CarIdxLapDistPct[1] = this.gapS === null ? (pct + 0.5) % 1 : (pct + this.gapS / 100) % 1
        // A lap every 30 s, clean.
        const lap = Math.floor((this.k.frame.SessionTime[0] ?? 0) / 30)
        if (lap !== this.lap) {
          this.lap = lap
          this.laps = [{ lap, time: 30, clean: true }, ...this.laps].slice(0, 10)
        }
        f.CarIdxLapCompleted[0] = lap
        last = this.k.run(o)
      }
      return last
    }
  }

  // Readings move a few degrees a second at most: a step of more than jumpC is a repair.
  const rise = (s: Session, to: number): void => {
    s.run(1, to - 4)
  }

  it('says when the water stays well above your clean-lap average', () => {
    const s = new Session()
    expect(s.run(120, 88).notices).toEqual([])
    rise(s, 96)
    expect(s.run(15, 96).notices).toEqual([])
    const n = s.run(ENGINE_TREND.sustainS, 96).notices
    expect(n).toEqual([
      { kind: 'engineTrend', fluid: 'water', tempC: 96, deltaC: 8, draft: false }
    ] satisfies AlertNotice[])
    expect(s.run(1, 96, { showEngineTrend: false }).notices).toEqual([])
  })

  it('suggests slipstreaming while close behind another car', () => {
    const s = new Session()
    s.gapS = 0.6
    s.run(120, 88)
    rise(s, 96)
    expect(s.run(60, 96).notices).toMatchObject([{ kind: 'engineTrend', draft: true }])
    // The pace car is never "close behind" (RaceView.cars leaves it out), nor a car further.
    const far = new Session()
    far.gapS = ALERTS.draftGapS * 1.5
    far.run(120, 88)
    rise(far, 96)
    expect(far.run(60, 96).notices).toMatchObject([{ kind: 'engineTrend', draft: false }])
  })

  const trend = (d: AlertsData): AlertNotice[] => d.notices.filter((n) => n.kind === 'engineTrend')

  it('a warm-up is no reference: only a lap within stableC of the one before (Q6)', () => {
    const s = new Session()
    // Online: after a repair the oil climbed ~1.5 °C a lap; laps taken then made a reference
    // below the engine's normal, and the climb went on towards a false notice.
    s.run(150, (t) => 80 + (1.5 * t) / 30)
    expect(trend(s.run(40, 95))).toEqual([])
    // Settled: laps alike make the reference, and a rise above it is said.
    s.run(100, 95)
    rise(s, 101)
    expect(trend(s.run(40, 101))).toMatchObject([{ fluid: 'water', tempC: 101, deltaC: 6 }])
  })

  it('a tow or a reading jumping more than jumpC starts the reference over (Q6)', () => {
    for (const reset of ['tow', 'jump'] as const) {
      const s = new Session()
      s.run(120, 88)
      if (reset === 'tow') {
        s.k.frame.PlayerCarTowTime[0] = 30
        s.run(1, 88)
        s.k.frame.PlayerCarTowTime[0] = 0
      } else {
        // Online: the repair at the end of the tow, the oil from 73.4 to 61.4 °C at once.
        s.run(1, 88 - ENGINE_TREND.jumpC - 0.5)
        s.run(1, 88)
      }
      rise(s, 96)
      expect(trend(s.run(40, 96)), reset).toEqual([])
    }
  })

  it('skips a car without the reading', () => {
    const s = new Session()
    s.run(120, 88)
    const frame = { ...s.k.frame, WaterTemp: [], OilTemp: [] }
    const d = s.k.p.compute(frame, s.k.session, s.k.race, OPTS)
    expect(d.notices).toEqual([])
  })
})

describe('alertsEqual', () => {
  const base: AlertsData = {
    visible: true,
    flags: ['caution', 'blue'],
    notices: [{ kind: 'tow', seconds: 12 }],
    pitLimiter: 'on',
    speedKmh: 58,
    pitLimitKmh: 60,
    incident: { points: 2, kind: 'loss-of-control', lap: 5, sector: 3, surface: 'gravel' },
    inBox: false
  }

  it('is structural and sees every field', () => {
    expect(alertsEqual(base, structuredClone(base))).toBe(true)
    const changed: Partial<AlertsData>[] = [
      { visible: false },
      { flags: ['caution'] },
      { flags: ['blue', 'caution'] },
      { notices: [] },
      { notices: [{ kind: 'tow', seconds: 11 }] },
      { notices: [{ kind: 'stalled' }] },
      { notices: [{ kind: 'damage', mandatory: true }] },
      { inBox: true },
      { pitLimiter: 'speeding' },
      { pitLimiter: 'offSpeeding' },
      { pitLimiter: null },
      { speedKmh: 59 },
      { pitLimitKmh: null },
      { pitLimitKmh: 72 },
      { incident: null },
      ...(['points', 'kind', 'lap', 'sector', 'surface'] as const).map((f) => ({
        incident: { ...(base.incident as IncidentAlert), [f]: f === 'kind' ? 'off-track' : null }
      }))
    ]
    for (const c of changed)
      expect(alertsEqual(base, { ...base, ...c }), JSON.stringify(c)).toBe(false)
  })

  it('an idle payload does not change while you drive (the speed is 0 off pit road)', () => {
    const k = new Tick().pit(false, false, 50)
    const a = k.run()
    k.frame.Speed[0] = 60
    expect(alertsEqual(a, k.run())).toBe(true)
  })
})
