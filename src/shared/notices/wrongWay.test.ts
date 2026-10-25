import { describe, expect, it } from 'vitest'
import { WRONG_WAY, WrongWayDetector, type WrongWayInput } from './wrongWay'

const L = 4000
/** 30 m/s, first gear or above, on track, in the car, a 4 km lap. */
const BASE: WrongWayInput = {
  pct: 0.5,
  speedMs: 30,
  gear: 3,
  onPitRoad: false,
  inCar: true,
  trackLengthM: L
}

/** Feeds the lap fraction moving `stepM` per sample from `fromPct`; the last answer. */
function drive(
  d: WrongWayDetector,
  fromPct: number,
  stepM: number,
  samples: number,
  o: Partial<WrongWayInput> = {}
): boolean {
  let on = false
  let pct = fromPct
  for (let k = 0; k < samples; k++) {
    on = d.update({ ...BASE, ...o, pct: ((pct % 1) + 1) % 1 })
    pct += stepM / L
  }
  return on
}

describe('WrongWayDetector', () => {
  it('says so after triggerM backwards at speed, and stops after clearM forwards', () => {
    const d = new WrongWayDetector()
    expect(drive(d, 0.5, 3, 20)).toBe(false)
    // 3 m back per sample: the 7th sample is 18 m back, the 8th 21 m.
    expect(drive(d, 0.52, -3, 7)).toBe(false)
    expect(d.update({ ...BASE, pct: 0.52 - 21 / L })).toBe(true)
    expect(drive(d, 0.52 - 24 / L, -3, 30)).toBe(true)
    // Turned round: 9 m forwards is not enough, 12 m is.
    const at = 0.52 - 114 / L
    expect(drive(d, at, 3, 4)).toBe(true)
    expect(drive(d, at + 12 / L, 3, 2)).toBe(false)
    expect(WRONG_WAY.triggerM).toBe(20)
  })

  it('ignores reverse gear, neutral, pit road, slow speeds and being out of the car', () => {
    for (const o of [
      { gear: -1 },
      { gear: 0 },
      { onPitRoad: true },
      { speedMs: WRONG_WAY.minSpeedMs - 0.1 },
      { inCar: false }
    ]) {
      const d = new WrongWayDetector()
      expect(drive(d, 0.5, -3, 40, o), JSON.stringify(o)).toBe(false)
    }
    // Any of them ends it at once.
    const d = new WrongWayDetector()
    expect(drive(d, 0.5, -3, 40)).toBe(true)
    expect(d.update({ ...BASE, pct: 0.47, gear: -1 })).toBe(false)
    expect(d.update({ ...BASE, pct: 0.469 })).toBe(false)
  })

  it('does not count the S/F line, jumps or unknown fractions', () => {
    const d = new WrongWayDetector()
    // Forwards across the line: 0.999 -> 0.001.
    expect(drive(d, 0.99, 3, 40)).toBe(false)
    // Teleports (a tow, a reset) are skipped, backwards or forwards.
    expect(d.update({ ...BASE, pct: 0.6 })).toBe(false)
    expect(d.update({ ...BASE, pct: 0.3 })).toBe(false)
    for (const pct of [undefined, -1, Number.NaN, 1.5]) {
      expect(d.update({ ...BASE, pct })).toBe(false)
    }
    // Backwards over the line: the step across it is skipped, the metres on each side count
    // (16 m before it, 4 m after).
    const back = new WrongWayDetector()
    expect(drive(back, 0.004, -2, 11)).toBe(false)
    expect(drive(back, 0.9985, -2, 1)).toBe(true)
  })

  it('uses a usual lap length when the session gives none', () => {
    const d = new WrongWayDetector()
    // 0.001 of a 4 km default lap is 4 m.
    let on = false
    for (let k = 0; k < 6; k++) on = d.update({ ...BASE, trackLengthM: null, pct: 0.5 - k * 0.001 })
    expect(on).toBe(true)
  })

  it('starts over after resume()', () => {
    const d = new WrongWayDetector()
    expect(drive(d, 0.5, -3, 40)).toBe(true)
    d.resume()
    expect(d.update({ ...BASE, pct: 0.45 })).toBe(false)
  })
})
