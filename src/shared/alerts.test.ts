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

  /** The tick `ticks` later (default the next one at 10 Hz; negative: the clock went back). */
  run(o: Partial<AlertsOptions> = {}, ticks = 1): AlertsData {
    this.n += ticks
    this.frame.SessionTime[0] = (1000 + this.n) / 10
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
    for (const [bit, kind] of cases) {
      expect(new Tick().flags(bit).run().flags, kind).toEqual([kind])
      expect(new Tick().flags(0, bit).run().flags, kind).toEqual([kind])
    }
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
      incident: null
    })
    expect(k.pit(true, false).run()).toEqual({
      visible: true,
      flags: [],
      notices: [],
      pitLimiter: 'off',
      speedKmh: 58,
      pitLimitKmh: 60,
      incident: null
    })
    expect(k.pit(true, true).run()).toMatchObject({ visible: true, pitLimiter: 'on' })
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
    // The limiter and the repairs bits are not warning lights.
    const other = EngineWarning.PitSpeedLimiter | EngineWarning.MandatoryRepairs
    expect(k.warnings(other).run().notices).toEqual([])
  })

  it('holds a flickering light holdS, like a flag', () => {
    const k = new Tick().warnings(EngineWarning.OilPressure)
    k.run({ holdS: 2 })
    k.warnings(0)
    expect(kinds(k.runFor(1.9, { holdS: 2 }))).toEqual(['oilPressure'])
    expect(k.runFor(0.2, { holdS: 2 }).notices).toEqual([])
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

    run(seconds: number, water: number, o: Partial<AlertsOptions> = {}): AlertsData {
      const f = this.k.frame
      let last = this.k.run(o)
      for (let i = 0; i < Math.round(seconds * 10); i++) {
        const pct = ((this.k.frame.SessionTime[0] ?? 0) / 30) % 1
        f.WaterTemp[0] = water
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

  it('says when the water stays well above your clean-lap average', () => {
    const s = new Session()
    expect(s.run(120, 88).notices).toEqual([])
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
    expect(s.run(60, 96).notices).toMatchObject([{ kind: 'engineTrend', draft: true }])
    // The pace car is never "close behind" (RaceView.cars leaves it out), nor a car further.
    const far = new Session()
    far.gapS = ALERTS.draftGapS * 1.5
    far.run(120, 88)
    expect(far.run(60, 96).notices).toMatchObject([{ kind: 'engineTrend', draft: false }])
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
    incident: { points: 2, kind: 'loss-of-control', lap: 5, sector: 3, surface: 'gravel' }
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
