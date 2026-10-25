import { describe, expect, it } from 'vitest'
import { ENGINE_TREND, EngineTrend, type EngineTrendInput, type TrendNotice } from './engineTrend'

/** 10 Hz, 30 s laps; the RaceModel's verdict per lap number (clean unless listed). */
class Drive {
  readonly e = new EngineTrend()
  t = 0
  laps = 0
  readonly unclean = new Set<number>()
  last: TrendNotice | null = null

  step(o: Partial<EngineTrendInput> = {}): TrendNotice | null {
    this.t += 0.1
    this.last = this.e.update({
      now: this.t,
      lapsCompleted: this.laps,
      water: 88,
      oil: 100,
      driving: true,
      closeBehind: false,
      warning: false,
      lapClean: (lap) => !this.unclean.has(lap),
      ...o
    })
    return this.last
  }

  /** `seconds` of samples. */
  run(seconds: number, o: Partial<EngineTrendInput> = {}): TrendNotice | null {
    for (let k = 0; k < Math.round(seconds * 10); k++) this.step(o)
    return this.last
  }

  /** The rest of the lap in progress and `n` more whole laps of 30 s. */
  lapsOf(n: number, o: Partial<EngineTrendInput> = {}): void {
    for (let i = 0; i < n; i++) {
      this.run(30, o)
      this.laps++
    }
  }
}

/** Two whole clean laps at 88 / 100 after a first partial one: a reference. */
function warmed(): Drive {
  const d = new Drive()
  d.lapsOf(4)
  d.step()
  return d
}

describe('EngineTrend', () => {
  it('builds the reference from whole clean laps only, each like the lap before it', () => {
    const d = new Drive()
    // The first lap is seen from its middle: not a reference. The first whole one has no lap
    // before it to be like (stableC): not one either.
    d.lapsOf(2)
    d.step()
    expect(d.e.reference('water')).toBeNull()
    d.lapsOf(1)
    d.step()
    expect(d.e.reference('water')).toBeNull()
    d.lapsOf(1)
    d.step()
    expect(d.e.reference('water')).toBeCloseTo(88, 6)
    expect(d.e.reference('oil')).toBeCloseTo(100, 6)
    // An unclean lap (pit road, caution, off track) leaves it alone.
    d.unclean.add(d.laps + 1)
    d.lapsOf(1, { water: 70 })
    d.step()
    expect(d.e.reference('water')).toBeCloseTo(88, 6)
  })

  it('raises the notice after sustainS well above the reference, the hotter fluid first', () => {
    const d = warmed()
    // The smoothed reading needs a few seconds to cross riseC; then sustainS.
    expect(d.run(ENGINE_TREND.sustainS, { water: 96 })).toBeNull()
    const n = d.run(10, { water: 96 })
    expect(n).toEqual({ kind: 'engineTrend', fluid: 'water', tempC: 96, deltaC: 8, draft: false })
    // Oil further above its own reference wins the band.
    d.run(40, { water: 96, oil: 112 })
    expect(d.last).toMatchObject({ fluid: 'oil', tempC: 112, deltaC: 12 })
  })

  it('ignores a short spike and ends below clearC', () => {
    const d = warmed()
    expect(d.run(8, { water: 110 })).toBeNull()
    expect(d.run(60)).toBeNull()
    d.run(40, { water: 95 })
    expect(d.last?.fluid).toBe('water')
    // Between clearC and riseC it stays; under clearC it goes.
    expect(d.run(20, { water: 91.5 })).not.toBeNull()
    expect(d.run(20, { water: 89 })).toBeNull()
  })

  it('suggests slipstreaming after most of the time close behind another car', () => {
    const d = warmed()
    d.run(60, { water: 96, closeBehind: true })
    expect(d.last?.draft).toBe(true)
    d.run(60, { water: 96, closeBehind: false })
    expect(d.last).toMatchObject({ fluid: 'water', draft: false })
  })

  it('says nothing in the box or on pit road, nor for a reading the car lacks', () => {
    const d = warmed()
    expect(d.run(60, { water: 99, driving: false })).toBeNull()
    expect(d.run(60, { water: Number.NaN, oil: Number.NaN })).toBeNull()
    const none = new Drive()
    none.lapsOf(4, { water: Number.NaN })
    none.step({ water: Number.NaN })
    expect(none.e.reference('water')).toBeNull()
    expect(none.e.reference('oil')).toBeCloseTo(100, 6)
  })

  it('keeps hot laps and laps with a warning light out of the reference', () => {
    const d = warmed()
    d.lapsOf(1, { warning: true, water: 80 })
    d.step()
    expect(d.e.reference('water')).toBeCloseTo(88, 6)
    // A whole lap with the notice on is not "your normal" either.
    d.run(40, { water: 97 })
    d.laps++
    d.lapsOf(1, { water: 97 })
    d.step({ water: 97 })
    expect(d.e.reference('water')).toBeCloseTo(88, 6)
  })

  it('averages the last refLaps clean laps; waits for the verdict of a lap', () => {
    const d = warmed()
    // The first lap at 90 is 2 °C off the one before: not a reference; the next ones are.
    for (let k = 0; k <= ENGINE_TREND.refLaps; k++) d.lapsOf(1, { water: 90 })
    d.step({ water: 90 })
    expect(d.e.reference('water')).toBeCloseTo(90, 6)
    // Unknown verdict: kept for pendingS, then dropped.
    const p = warmed()
    let verdict: boolean | null = null
    p.lapsOf(1, { water: 87.5, lapClean: () => verdict })
    p.run(5, { lapClean: () => verdict })
    expect(p.e.reference('water')).toBeCloseTo(88, 6)
    verdict = true
    p.step({ lapClean: () => verdict })
    expect(p.e.reference('water')).toBeLessThan(88)
  })

  it('a warm-up is no reference: laps still climbing more than stableC each (Q6)', () => {
    const d = new Drive()
    // Online: 1.5 °C a lap after a repair, for laps.
    for (let k = 0; k < 8; k++) d.lapsOf(1, { oil: 60 + 1.5 * k })
    d.step({ oil: 72 })
    expect(d.e.reference('oil')).toBeNull()
    // The water stayed put meanwhile: its reference is there.
    expect(d.e.reference('water')).toBeCloseTo(88, 6)
    // Settled: within stableC of the lap before.
    d.lapsOf(3, { oil: 72.5 })
    d.step({ oil: 72.5 })
    expect(d.e.reference('oil')).toBeCloseTo(72.5, 1)
  })

  it('observe(): a tow or a reading jumping more than jumpC starts it over (Q6)', () => {
    const tow = warmed()
    tow.e.observe(tow.t, false, 88, 100)
    expect(tow.e.reference('water')).toBeCloseTo(88, 6)
    tow.e.observe(tow.t + 0.02, true, 88, 100)
    expect(tow.e.reference('water')).toBeNull()
    expect(tow.e.reference('oil')).toBeNull()
    // The repair: the oil 12 °C down from one tick to the next.
    const jump = warmed()
    jump.e.observe(jump.t, false, 88, 100)
    jump.e.observe(jump.t + 0.02, false, 88, 100 - ENGINE_TREND.jumpC - 0.1)
    expect(jump.e.reference('water')).toBeNull()
    // A slow change, or the same step across a gap, is not a jump.
    const slow = warmed()
    let oil = 100
    for (let k = 1; k <= 100; k++) slow.e.observe(slow.t + k / 60, false, 88, (oil -= 0.1))
    slow.e.observe(slow.t + 10, false, 88, oil - 2 * ENGINE_TREND.jumpC)
    expect(slow.e.reference('water')).toBeCloseTo(88, 6)
  })

  it('keeps the reference over resume() and drops it on reset()', () => {
    const d = warmed()
    d.e.resume()
    expect(d.e.reference('water')).toBeCloseTo(88, 6)
    d.e.reset()
    expect(d.e.reference('water')).toBeNull()
  })
})
