import { describe, expect, it } from 'vitest'
import {
  ALERTS,
  AlertsProvider,
  FLAG_BITS,
  FLAG_ORDER,
  alertsEqual,
  pitLimiterState
} from './alerts'
import { EngineWarning, SessionFlag } from './flags'
import { EMPTY_RACE_VIEW } from './race/emptyRaceView'
import { makeFrame, makeSession } from './race/testing/raceSim'
import type { MutableFrame } from './race/testing/raceSim'
import type { AlertsData, AlertsOptions, FlagKind, IncidentAlert, SessionMeta } from './types'

const OPTS: AlertsOptions = {
  showFlags: true,
  showBlue: true,
  showPitLimiter: true,
  holdS: 0,
  showIncidents: true
}

/** The player is CarIdx 0 of a 3-car session with a 60 km/h pit limit. */
class Tick {
  readonly frame: MutableFrame = makeFrame()
  session: SessionMeta = makeSession(3, { pitSpeedLimitKmh: 60 })
  readonly p = new AlertsProvider()
  /** 10 Hz ticks since SessionTime 100 s (an integer count, so times do not drift). */
  private n = 0

  /** The tick `ticks` later (default the next one at 10 Hz; negative: the clock went back). */
  run(o: Partial<AlertsOptions> = {}, ticks = 1): AlertsData {
    this.n += ticks
    this.frame.SessionTime[0] = (1000 + this.n) / 10
    return this.p.compute(this.frame, this.session, EMPTY_RACE_VIEW, { ...OPTS, ...o })
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
}

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
      [SessionFlag.Blue, 'blue'],
      [SessionFlag.White, 'white'],
      [SessionFlag.Checkered, 'checkered']
    ]
    for (const [bit, kind] of cases) {
      expect(new Tick().flags(bit).run().flags, kind).toEqual([kind])
      expect(new Tick().flags(0, bit).run().flags, kind).toEqual([kind])
    }
  })

  it("other cars' flags do not apply to you; bits nobody shows are ignored", () => {
    const k = new Tick().flags(SessionFlag.Servicible | SessionFlag.TenToGo)
    k.frame.CarIdxSessionFlags[1] = SessionFlag.Black | SessionFlag.Blue
    expect(k.run()).toMatchObject({ visible: false, flags: [] })
    // PlayerCarIdx says which car is yours.
    k.frame.PlayerCarIdx[0] = 1
    expect(k.run().flags).toEqual(['black', 'blue'])
  })

  it('the blue flag has its own toggle; showFlags hides them all', () => {
    const k = new Tick().flags(SessionFlag.Yellow, SessionFlag.Blue)
    expect(k.run().flags).toEqual(['yellow', 'blue'])
    expect(k.run({ showBlue: false }).flags).toEqual(['yellow'])
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
      pitLimiter: null,
      speedKmh: 0,
      pitLimitKmh: 60,
      incident: null
    })
    expect(k.pit(true, false).run()).toEqual({
      visible: true,
      flags: [],
      pitLimiter: 'off',
      speedKmh: 58,
      pitLimitKmh: 60,
      incident: null
    })
    expect(k.pit(true, true).run()).toMatchObject({ visible: true, pitLimiter: 'on' })
  })

  it('speeding over the known limit by more than 1 km/h, limiter on', () => {
    const k = new Tick()
    // 17 m/s = 61.2 -> 61 km/h: not more than 1 over 60.
    expect(k.pit(true, true, 17).run()).toMatchObject({ pitLimiter: 'on', speedKmh: 61 })
    // 17.1 m/s = 61.56 -> 62 km/h.
    expect(k.pit(true, true, 17.1).run()).toMatchObject({ pitLimiter: 'speeding', speedKmh: 62 })
    // The limiter off wins: switch it on first.
    expect(k.pit(true, false, 25).run()).toMatchObject({ pitLimiter: 'off', speedKmh: 90 })
    // Unknown limit: never "speeding".
    k.session = makeSession(3, { pitSpeedLimitKmh: null })
    expect(k.pit(true, true, 40).run()).toMatchObject({ pitLimiter: 'on', pitLimitKmh: null })
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
    expect(pitLimiterState(true, on, 61, 60)).toBe('on')
    expect(pitLimiterState(true, on, 62, 60)).toBe('speeding')
    expect(pitLimiterState(true, on, 200, null)).toBe('on')
  })

  it('flags and the limiter together', () => {
    const k = new Tick().pit(true, true).flags(0, SessionFlag.Black)
    expect(k.run()).toMatchObject({ visible: true, flags: ['black'], pitLimiter: 'on' })
  })
})

describe('alertsEqual', () => {
  const base: AlertsData = {
    visible: true,
    flags: ['caution', 'blue'],
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
      { pitLimiter: 'speeding' },
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
