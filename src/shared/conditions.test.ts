import { describe, expect, it } from 'vitest'
import {
  CONDITIONS,
  ConditionsProvider,
  TempTrendTracker,
  WIND_CONVENTION,
  WindAverager,
  conditionsEqual,
  precipitationPct,
  rubberOf,
  stepDeg,
  wetnessLevel,
  windFromRelDeg,
  wrapDeg
} from './conditions'
import { SKIP_EMIT } from './providers'
import { PRACTICE, RACE, makeFrame, makeSession } from './race/testing/raceSim'
import type { MutableFrame } from './race/testing/raceSim'
import type { ConditionsData, SessionDetails, SessionMeta, TempTrend } from './types'

const DEG = Math.PI / 180

/** A dry, mild afternoon with the player driving north and a 5 m/s wind from the east. */
function weatherFrame(): MutableFrame {
  const f = makeFrame()
  f.SessionTime[0] = 1000
  f.TrackTempCrew[0] = 31.26
  f.AirTemp[0] = 22.04
  f.WindVel[0] = 5
  f.WindDir[0] = 90 * DEG
  f.YawNorth[0] = 0
  f.TrackWetness[0] = 1
  f.Precipitation[0] = 0
  f.WeatherDeclaredWet[0] = false
  f.Skies[0] = 1
  return f
}

function session(rubber = 'moderate usage'): SessionMeta {
  const s = makeSession(3)
  const sessions = new Map(s.sessions)
  const race = sessions.get(RACE)
  if (race) sessions.set(RACE, { ...race, rubberState: rubber })
  return { ...s, sessions }
}

describe('wind relative to the car', () => {
  it('wraps degrees into (-180, 180]', () => {
    expect(wrapDeg(0)).toBe(0)
    expect(wrapDeg(180)).toBe(180)
    expect(wrapDeg(-180)).toBe(180)
    expect(wrapDeg(190)).toBe(-170)
    expect(wrapDeg(-190)).toBe(170)
    expect(wrapDeg(720 + 45)).toBe(45)
  })

  it('is WindDir minus YawNorth: 0 is a headwind, + comes from the right', () => {
    // Driving north (0) into a northerly: from straight ahead.
    expect(windFromRelDeg(0, 0)).toBeCloseTo(0)
    // Driving north, wind from the east: from the right.
    expect(windFromRelDeg(90 * DEG, 0)).toBeCloseTo(90)
    // Driving east, wind from the north: from the left.
    expect(windFromRelDeg(0, 90 * DEG)).toBeCloseTo(-90)
    // Driving south into a northerly: from behind.
    expect(windFromRelDeg(0, 180 * DEG)).toBeCloseTo(180)
    // Any range of headings (0..2pi or -pi..pi) gives the same answer.
    expect(windFromRelDeg(10 * DEG, 350 * DEG)).toBeCloseTo(20)
    expect(windFromRelDeg(10 * DEG, -10 * DEG)).toBeCloseTo(20)
  })

  it('flips in one place if the live session disagrees', () => {
    expect(WIND_CONVENTION).toEqual({ dirIsFrom: true, yawClockwise: true })
    // WindDir as where the wind goes: a "northerly" 0 comes from the south.
    expect(windFromRelDeg(0, 0, { dirIsFrom: false, yawClockwise: true })).toBeCloseTo(180)
    // YawNorth counter-clockwise: a heading of +90 is west.
    expect(windFromRelDeg(0, 90 * DEG, { dirIsFrom: true, yawClockwise: false })).toBeCloseTo(90)
  })

  it('has no direction without both angles', () => {
    expect(windFromRelDeg(Number.NaN, 0)).toBeNull()
    expect(windFromRelDeg(0, undefined)).toBeNull()
    expect(windFromRelDeg('1', 0)).toBeNull()
  })

  it('goes out in steps, -180 written as 180', () => {
    expect(stepDeg(33, 5)).toBe(35)
    expect(stepDeg(-178, 5)).toBe(180)
    expect(stepDeg(-1, 5)).toBe(0)
    expect(Object.is(stepDeg(-1, 5), -0)).toBe(false)
  })
})

describe('wetness and rain', () => {
  it('reads TrackWetness 1..7; 0 is unknown, never dry', () => {
    expect(wetnessLevel(0)).toBeNull()
    expect(wetnessLevel(1)).toBe(1)
    expect(wetnessLevel(7)).toBe(7)
    for (const v of [8, -1, 2.5, Number.NaN, undefined, '3']) expect(wetnessLevel(v)).toBeNull()
  })

  it('reads Precipitation as 0..1, or as percent above 1', () => {
    expect(precipitationPct(0)).toBe(0)
    expect(precipitationPct(0.404)).toBe(40)
    expect(precipitationPct(1)).toBe(100)
    expect(precipitationPct(55)).toBe(55)
    expect(precipitationPct(250)).toBe(100)
    for (const v of [-0.1, Number.NaN, undefined]) expect(precipitationPct(v)).toBeNull()
  })
})

describe('TempTrendTracker', () => {
  /** Feeds `c(t)` every second for `seconds` from `t0`; the last trend. */
  function feed(
    tr: TempTrendTracker,
    c: (t: number) => number,
    seconds: number,
    t0 = 0
  ): TempTrend | null {
    let last: TempTrend | null = null
    for (let t = t0; t <= t0 + seconds; t++) last = tr.update(t, c(t))
    return last
  }

  it('says nothing until it has a couple of minutes of history', () => {
    const tr = new TempTrendTracker()
    expect(feed(tr, (t) => 30 + t / 60, CONDITIONS.trendMinSpanS - 5)).toBeNull()
    expect(feed(tr, (t) => 30 + t / 60, 30, CONDITIONS.trendMinSpanS)).toBe('up')
  })

  it('rises, falls and holds steady by the rate over the last minutes', () => {
    expect(feed(new TempTrendTracker(), (t) => 30 + (0.1 * t) / 60, 400)).toBe('up')
    expect(feed(new TempTrendTracker(), (t) => 30 - (0.1 * t) / 60, 400)).toBe('down')
    expect(feed(new TempTrendTracker(), (t) => 30 + (0.02 * t) / 60, 400)).toBe('steady')
    expect(feed(new TempTrendTracker(), () => 30, 400)).toBe('steady')
  })

  it('only looks back over the window: an old rise is forgotten', () => {
    const tr = new TempTrendTracker()
    // +2 °C in the first five minutes, then flat for ten.
    const c = (t: number): number => (t < 300 ? 30 + (2 * t) / 300 : 32)
    expect(feed(tr, c, 299)).toBe('up')
    expect(feed(tr, c, 600, 300)).toBe('steady')
  })

  it('needs a clear change to flip and less to go back (no flicker at the threshold)', () => {
    const tr = new TempTrendTracker()
    const on = CONDITIONS.trendOnCPerMin
    const off = CONDITIONS.trendOffCPerMin
    expect(feed(tr, (t) => 30 + (on * 1.2 * t) / 60, 400)).toBe('up')
    // Slowing to between the two thresholds keeps it rising.
    const mid = (on + off) / 2
    const base = 30 + (on * 1.2 * 400) / 60
    expect(feed(tr, (t) => base + (mid * (t - 400)) / 60, 600, 401)).toBe('up')
  })

  it('starts over when the session clock goes back', () => {
    const tr = new TempTrendTracker()
    expect(feed(tr, (t) => 30 + (0.2 * t) / 60, 400, 1000)).toBe('up')
    expect(tr.update(10, 30)).toBeNull()
  })

  it('ignores ticks without a temperature or a clock', () => {
    const tr = new TempTrendTracker()
    expect(tr.update(Number.NaN, 30)).toBeNull()
    expect(tr.update(100, null)).toBeNull()
  })
})

describe('ConditionsProvider', () => {
  it('sends every reading, quantised to what is shown', () => {
    const d = new ConditionsProvider().compute(weatherFrame(), session())
    expect(d).toEqual<ConditionsData>({
      visible: true,
      trackTempC: 31.3,
      trackTempTrend: null,
      airTempC: 22,
      windKmh: 18,
      windFromDeg: 90,
      wetness: 1,
      precipPct: 0,
      declaredWet: false,
      skies: 1,
      rubberState: 'moderate usage',
      rubberCarried: false
    })
  })

  it('has no wind direction out of the car, or in a calm', () => {
    const f = weatherFrame()
    f.IsOnTrack[0] = false
    const p = new ConditionsProvider()
    expect(p.compute(f, session()).windFromDeg).toBeNull()
    f.IsOnTrack[0] = true
    f.WindVel[0] = CONDITIONS.calmMs / 2
    // A fresh provider: the mean of the last minute would still hold the 5 m/s.
    const calm = new ConditionsProvider().compute(f, session())
    expect(calm.windFromDeg).toBeNull()
    expect(calm.windKmh).toBe(1)
  })

  it('treats missing or corrupt variables as unknown', () => {
    const f = weatherFrame()
    f.TrackTempCrew.length = 0
    f.AirTemp[0] = 500
    f.WindVel.length = 0
    f.YawNorth.length = 0
    f.TrackWetness[0] = 0
    f.Precipitation.length = 0
    f.Skies[0] = 9
    f.WeatherDeclaredWet.length = 0
    const d = new ConditionsProvider().compute(f, session(''))
    expect(d).toEqual<ConditionsData>({
      visible: false,
      trackTempC: null,
      trackTempTrend: null,
      airTempC: null,
      windKmh: null,
      windFromDeg: null,
      wetness: null,
      precipPct: null,
      declaredWet: false,
      skies: null,
      rubberState: '',
      rubberCarried: false
    })
  })

  it('reads the rubber state of the session being driven', () => {
    const f = weatherFrame()
    const s = session('high usage')
    const p = new ConditionsProvider()
    expect(p.compute(f, s).rubberState).toBe('high usage')
    f.SessionNum[0] = PRACTICE
    expect(p.compute(f, s).rubberState).toBe('')
    f.SessionNum.length = 0
    expect(p.compute(f, s).rubberState).toBe('')
  })

  it('reports the declared-wet call', () => {
    const f = weatherFrame()
    f.WeatherDeclaredWet[0] = true
    f.TrackWetness[0] = 5
    f.Precipitation[0] = 0.6
    const d = new ConditionsProvider().compute(f, session())
    expect([d.declaredWet, d.wetness, d.precipPct]).toEqual([true, 5, 60])
  })

  it('follows the track temperature trend at 1 Hz, and forgets it on reset()', () => {
    const f = weatherFrame()
    const p = new ConditionsProvider()
    let d: ConditionsData | null = null
    for (let s = 0; s <= 300; s++) {
      f.SessionTime[0] = 1000 + s
      f.TrackTempCrew[0] = 30 + (0.2 * s) / 60
      d = p.compute(f, session())
    }
    expect(d?.trackTempTrend).toBe('up')
    p.reset()
    expect(p.compute(f, session()).trackTempTrend).toBeNull()
  })
})

describe('SKIP_EMIT.conditions', () => {
  it('re-sends only a changed payload', () => {
    const skip = SKIP_EMIT.conditions
    if (!skip) throw new Error('no conditions rule')
    const a = new ConditionsProvider().compute(weatherFrame(), session())
    expect(skip(a, null)).toBe(false)
    expect(skip(structuredClone(a), a)).toBe(true)
    expect(skip({ ...a, windFromDeg: 95 }, a)).toBe(false)
    expect(skip({ ...a, trackTempTrend: 'up' }, a)).toBe(false)
    expect(conditionsEqual(a, { ...a, rubberState: 'carry over' })).toBe(false)
  })
})

describe('the conditions of a live race (report Q11)', () => {
  it('ignores the first readings of a session: a stale first value is no falling trend', () => {
    // The race at Lime Rock: TrackTempCrew 22.7 °C at t 0.63 (the qualifying's, 73 °F), then
    // 71 °F (21.7 °C) for the whole race. Read at 1 Hz like the widget.
    const tr = new TempTrendTracker()
    const trends = new Set<TempTrend | null>()
    trends.add(tr.update(0.63, 22.7))
    for (let t = 1.6; t < 900; t += 1) trends.add(tr.update(t, 21.7))
    expect([...trends]).toEqual([null, 'steady'])

    // Kept as the first sample, that one reading is a fall for minutes (the report found the
    // arrow down from t 121 to 316): what the settle time keeps out.
    const late = new TempTrendTracker()
    late.update(0, 22.7)
    late.update(CONDITIONS.trendSettleS, 22.7)
    let downs = 0
    for (let t = CONDITIONS.trendSettleS + 1; t < 900; t += 1) {
      if (late.update(t, 21.7) === 'down') downs++
    }
    expect(downs).toBeGreaterThan(120)
    expect(CONDITIONS.trendSettleS).toBeGreaterThanOrEqual(10)
  })

  it('settles again after the session clock goes back (a new session)', () => {
    const tr = new TempTrendTracker()
    for (let t = 0; t <= 400; t++) tr.update(t, 30 + (0.2 * t) / 60)
    expect(tr.update(401, 30 + (0.2 * 401) / 60)).toBe('up')
    expect(tr.update(0.5, 25)).toBeNull()
    expect(tr.update(CONDITIONS.trendSettleS - 1, 24)).toBeNull()
  })

  it('shows the wind of the last minute: the mean speed, the mean direction', () => {
    const w = new WindAverager()
    let last = w.update(0, 5, 0)
    // Gusts between 3 and 5 m/s, every second: 4 m/s on average.
    for (let t = 1; t <= 120; t++) last = w.update(t, t % 2 === 0 ? 5 : 3, 270 * DEG)
    expect(last?.speedMs).toBeCloseTo(4, 5)
    expect(wrapDeg(((last?.fromRad ?? 0) * 180) / Math.PI)).toBeCloseTo(-90, 5)
    // Directions either side of north average to north, not to south.
    const n = new WindAverager()
    n.update(0, 4, 350 * DEG)
    const mean = n.update(1, 4, 10 * DEG)
    expect(wrapDeg(((mean?.fromRad ?? 0) * 180) / Math.PI)).toBeCloseTo(0, 5)
  })

  it('forgets the wind older than the window and starts over when the clock goes back', () => {
    const w = new WindAverager()
    for (let t = 0; t < 60; t++) w.update(t, 10, 0)
    for (let t = 60; t < 120; t++) w.update(t, 2, 0)
    expect(w.update(120, 2, 0)?.speedMs).toBeCloseTo(2, 5)
    expect(w.update(5, 7, 0)?.speedMs).toBe(7)
    // No clock: this reading alone; no speed: nothing.
    expect(w.update(Number.NaN, 3, Number.NaN)).toEqual({ speedMs: 3, fromRad: null })
    expect(w.update(10, -1, 0)).toBeNull()
    expect(w.update(10, undefined, 0)).toBeNull()
    expect(CONDITIONS.windMeanS).toBe(60)
  })

  it('sends the mean wind against the heading now', () => {
    const f = weatherFrame()
    const p = new ConditionsProvider()
    let d: ConditionsData | null = null
    for (let s = 0; s <= 90; s++) {
      f.SessionTime[0] = 1000 + s
      f.WindVel[0] = s % 2 === 0 ? 3 : 5
      f.WindDir[0] = 258 * DEG
      d = p.compute(f, session())
    }
    // 4 m/s = 14.4 km/h; from the west-south-west while driving north: from the left.
    expect(d?.windKmh).toBe(14)
    expect(d?.windFromDeg).toBe(-100)
    // The heading changes at once, the wind does not.
    f.SessionTime[0] = 1091
    f.YawNorth[0] = 258 * DEG
    expect(p.compute(f, session()).windFromDeg).toBe(0)
  })

  it('follows a carried-over rubber state back to the last real one', () => {
    const details = (rubberState: string): SessionDetails => ({
      type: 'Race',
      name: 'X',
      laps: null,
      timeS: null,
      rubberState
    })
    // Practice, qualifying, race: as the official race's session info.
    const sessions = new Map<number, SessionDetails>([
      [0, details('moderately high usage')],
      [1, details('carry over')],
      [2, details('carry over')]
    ])
    expect(rubberOf(sessions, 2)).toEqual({ state: 'moderately high usage', carried: true })
    expect(rubberOf(sessions, 1)).toEqual({ state: 'moderately high usage', carried: true })
    expect(rubberOf(sessions, 0)).toEqual({ state: 'moderately high usage', carried: false })
    expect(rubberOf(sessions, undefined)).toEqual({ state: '', carried: false })
    expect(rubberOf(sessions, 7)).toEqual({ state: '', carried: false })
    // Nothing real before it: it stays as iRacing says.
    const only = new Map<number, SessionDetails>([
      [0, details('')],
      [1, details('carry over')]
    ])
    expect(rubberOf(only, 1)).toEqual({ state: 'carry over', carried: false })

    const f = weatherFrame()
    f.SessionNum[0] = 2
    const d = new ConditionsProvider().compute(f, { ...session(), sessions })
    expect([d.rubberState, d.rubberCarried]).toEqual(['moderately high usage', true])
  })
})
