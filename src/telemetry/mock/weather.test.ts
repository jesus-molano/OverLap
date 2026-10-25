import { describe, expect, it } from 'vitest'
import { ConditionsProvider } from '@shared/conditions'
import { parseSessionMeta } from '@shared/session'
import type { ConditionsData, TempTrend } from '@shared/types'
import { MockRace } from './race'
import { run } from './testUtils'
import {
  SHOWER_AT_S,
  airTempAt,
  coolingAt,
  declaredWetAt,
  headingAt,
  initialWeatherVars,
  mockRubberState,
  rainAt,
  skiesAt,
  trackTempAt,
  wetnessAt,
  writeWeather
} from './weather'

/** The 40 min of a mock session, second by second. */
const SESSION_S = 2400
const SECONDS = Array.from({ length: SESSION_S + 1 }, (_, t) => t)

describe('mock weather', () => {
  it('starts unknown: nothing measured before the first step', () => {
    const v = initialWeatherVars()
    expect(v.TrackWetness).toEqual([0])
    expect(v.WeatherDeclaredWet).toEqual([false])
  })

  it('is plausible all session: warm track, mild air, a breeze, wetness and skies in range', () => {
    const v = initialWeatherVars()
    for (const t of SECONDS) {
      writeWeather(v, t, 0, t / 120)
      const track = v.TrackTempCrew[0] ?? Number.NaN
      const air = v.AirTemp[0] ?? Number.NaN
      expect(track).toBeGreaterThan(20)
      expect(track).toBeLessThan(40)
      expect(air).toBeGreaterThan(14)
      expect(air).toBeLessThan(track)
      expect(v.WindVel[0]).toBeGreaterThan(1.5)
      expect(v.WindVel[0]).toBeLessThan(6)
      expect(v.TrackWetness[0]).toBeGreaterThanOrEqual(1)
      expect(v.TrackWetness[0]).toBeLessThanOrEqual(7)
      expect(v.Skies[0]).toBeGreaterThanOrEqual(0)
      expect(v.Skies[0]).toBeLessThanOrEqual(3)
      expect(v.YawNorth[0]).toBeGreaterThanOrEqual(0)
      expect(v.YawNorth[0]).toBeLessThan(2 * Math.PI)
    }
  })

  it('moves slowly: no second changes the track by more than a few hundredths of a degree', () => {
    for (const t of SECONDS.slice(1)) {
      expect(Math.abs(trackTempAt(t) - trackTempAt(t - 1))).toBeLessThan(0.05)
      expect(Math.abs(airTempAt(t) - airTempAt(t - 1))).toBeLessThan(0.05)
    }
  })

  it('brings one shower: rain, a wet track declared wet, and a dry track again', () => {
    expect(rainAt(SHOWER_AT_S - 1)).toBe(0)
    expect(Math.max(...SECONDS.map(rainAt))).toBeCloseTo(0.4)
    expect(Math.max(...SECONDS.map(wetnessAt))).toBe(5)
    expect(wetnessAt(0)).toBe(1)
    expect(wetnessAt(SESSION_S)).toBe(1)
    expect(SECONDS.some(declaredWetAt)).toBe(true)
    expect(declaredWetAt(0) || declaredWetAt(SESSION_S)).toBe(false)
    // Declared once it is properly wet, and kept while it dries, never on a nearly dry track.
    expect(wetnessAt(SECONDS.find(declaredWetAt) ?? 0)).toBeGreaterThanOrEqual(4)
    for (const t of SECONDS.filter(declaredWetAt)) expect(wetnessAt(t)).toBeGreaterThanOrEqual(3)
    expect(skiesAt(0)).toBe(1)
    expect(skiesAt(SHOWER_AT_S + 60)).toBe(3)
    expect(coolingAt(0)).toBe(0)
    expect(coolingAt(SHOWER_AT_S + 600)).toBe(1)
  })

  it('turns the heading once per lap', () => {
    expect(headingAt(0)).toBeCloseTo(headingAt(1))
    const turned = new Set(
      Array.from({ length: 36 }, (_, k) => Math.floor(headingAt(k / 36) / (Math.PI / 2)))
    )
    expect(turned.size).toBe(4)
  })

  it('names a rubber state per session, as iRacing writes it', () => {
    expect(mockRubberState(0)).toBe('moderate usage')
    expect(mockRubberState(1)).toBe('moderately high usage')
    expect(mockRubberState(3)).toBe('moderate usage')
    expect(new MockRace().sessionInfo().SessionInfo.Sessions[0]?.SessionTrackRubberState).toBe(
      'moderate usage'
    )
  })

  it('is deterministic', () => {
    const a = initialWeatherVars()
    const b = initialWeatherVars()
    writeWeather(a, 1500.5, 2, 0.37)
    writeWeather(b, 1500.5, 2, 0.37)
    expect(a).toEqual(b)
  })
})

describe('mock weather through the conditions provider', () => {
  /** One payload a second for a whole mock session. */
  function session(): ConditionsData[] {
    const race = new MockRace()
    const meta = parseSessionMeta(race.sessionInfo())
    const p = new ConditionsProvider()
    const out: ConditionsData[] = []
    run(race, SESSION_S, 1, (f) => out.push(p.compute(f, meta)))
    return out
  }

  const payloads = session()
  const trends = new Set<TempTrend | null>(payloads.map((d) => d.trackTempTrend))

  it('shows the track warming, then cooling in the rain', () => {
    expect([...trends]).toEqual(expect.arrayContaining([null, 'up', 'down']))
    const firstUp = payloads.findIndex((d) => d.trackTempTrend === 'up')
    const firstDown = payloads.findIndex((d) => d.trackTempTrend === 'down')
    expect(firstUp).toBeGreaterThan(0)
    expect(firstDown).toBeGreaterThan(firstUp)
  })

  it('turns the wind around the car as it laps, and has a wet spell', () => {
    const dirs = new Set(payloads.map((d) => d.windFromDeg))
    expect(dirs.size).toBeGreaterThan(30)
    expect(dirs.has(null)).toBe(false)
    expect(payloads.some((d) => d.declaredWet && (d.precipPct ?? 0) >= 30)).toBe(true)
    expect(payloads.every((d) => d.visible && d.rubberState === 'moderate usage')).toBe(true)
  })
})
