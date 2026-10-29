/**
 * The repairs' real-time estimate from synthetic 60 Hz feeds: a crew second per real second, one
 * per three (smooth and in steps), pauses, a tow, a fast repair, new damage and leaving the
 * stall. Whatever the feed, the estimate is never negative and never rises within a stop.
 */
import { describe, expect, it } from 'vitest'
import { makeFrame, type MutableFrame } from '../race/testing/raceSim'
import { TrackLocation } from '../telemetry'
import { REPAIR_CLOCK, RepairClock, beingServiced } from './repairClock'

const HZ = 60
/** The lights' rate: the estimate is read every 6th tick. */
const EVERY = 6
const T0 = 500

interface Tick {
  /** Seconds since the feed started. */
  t: number
  /** iRacing's figure then (crew seconds). */
  crew: number
  /** The estimate read then (real seconds), null while unknown. */
  real: number | null
}

/** In the stall, stopped, being serviced. */
function serviced(): MutableFrame {
  const f = makeFrame()
  f.IsOnTrack[0] = true
  f.PlayerTrackSurface[0] = TrackLocation.InPitStall
  f.PlayerCarInPitStall[0] = true
  f.PitstopActive[0] = true
  f.Speed[0] = 0
  return f
}

/**
 * `seconds` of feed: `crewAt(t)` is PitRepairLeft at t; `edit(f, t)` changes the frame (a tow,
 * leaving). Returns what the clock says at the lights' rate.
 */
function feed(
  seconds: number,
  crewAt: (t: number) => number,
  edit: (f: MutableFrame, t: number) => void = () => {}
): Tick[] {
  const f = serviced()
  const clock = new RepairClock('PitRepairLeft')
  const out: Tick[] = []
  for (let n = 0; n <= seconds * HZ; n++) {
    const t = n / HZ
    f.SessionTime[0] = T0 + t
    f.PitRepairLeft[0] = Math.max(0, crewAt(t))
    edit(f, t)
    clock.observe(f, beingServiced(f))
    if (n % EVERY === 0) out.push({ t, crew: f.PitRepairLeft[0], real: clock.realS() })
  }
  return out
}

/** The ticks with an estimate. */
const known = (ticks: Tick[]): (Tick & { real: number })[] =>
  ticks.filter((k): k is Tick & { real: number } => k.real !== null)

/** Never negative, never rising while it lasts (an unknown stretch starts a new run). */
function expectSane(ticks: Tick[]): void {
  let prev: number | null = null
  for (const k of ticks) {
    if (k.real === null) {
      prev = null
      continue
    }
    expect(k.real).toBeGreaterThan(0)
    if (prev !== null) expect(k.real).toBeLessThanOrEqual(prev)
    prev = k.real
  }
}

describe('RepairClock: the real seconds a repair has left', () => {
  it('a crew second per real second: the estimate is iRacing figure itself', () => {
    const ticks = feed(20, (t) => 30 - t)
    expectSane(ticks)
    // Unknown until the window spans REPAIR_CLOCK.minSpanS.
    for (const k of ticks.filter((k) => k.t < REPAIR_CLOCK.minSpanS)) expect(k.real).toBeNull()
    const est = known(ticks)
    // The first fall is one tick in; the lights read every 0.1 s.
    expect(est[0]?.t).toBeGreaterThan(REPAIR_CLOCK.minSpanS)
    expect(est[0]?.t).toBeLessThan(REPAIR_CLOCK.minSpanS + 0.15)
    for (const k of est) expect(k.real).toBeCloseTo(30 - k.t, 1)
  })

  it('a crew second every three real ones: three times the figure, falling at real time', () => {
    const ticks = feed(30, (t) => 30 - t / 3)
    expectSane(ticks)
    const est = known(ticks)
    expect(est.length).toBeGreaterThan(200)
    // The real seconds left: (30 - t / 3) * 3 = 90 - t.
    for (const k of est) expect(k.real).toBeCloseTo(90 - k.t, 1)
    // Ten real seconds take ten off it (a crew second would have taken three and a bit).
    const at = (s: number): number => est.find((k) => k.t >= s)?.real ?? Number.NaN
    expect(at(10) - at(20)).toBeCloseTo(10, 1)
  })

  it('a figure that falls in whole steps, one every 3 s: unknown, the crew figure is shown', () => {
    // Each step is a run of its own (the still stretches between are pauses): no rate is
    // measured, rather than a guess from one step that could only be corrected by rising.
    const ticks = feed(40, (t) => 30 - Math.floor(t / 3))
    for (const k of ticks) expect(k.real).toBeNull()
  })

  it('a figure updated in steps closer together than a pause (0.75 s): followed', () => {
    const ticks = feed(20, (t) => 30 - Math.floor((t / 3) * 4) / 4)
    expectSane(ticks)
    const est = known(ticks)
    expect(est.length).toBeGreaterThan(100)
    for (const k of est) expect(Math.abs(k.real - (90 - k.t))).toBeLessThanOrEqual(1)
  })

  it('a pause keeps the estimate where it was; it falls again once the crew does', () => {
    // Falls 5 s at one per second, stands still 4 s, falls again.
    const crewAt = (t: number): number => (t < 5 ? 30 - t : t < 9 ? 25 : 25 - (t - 9))
    const ticks = feed(20, crewAt)
    expectSane(ticks)
    const paused = known(ticks).filter((k) => k.t >= 5.2 && k.t < 9)
    expect(paused.length).toBeGreaterThan(30)
    for (const k of paused) expect(k.real).toBeCloseTo(25, 0)
    const after = known(ticks).filter((k) => k.t >= 13)
    for (const k of after) expect(k.real).toBeCloseTo(crewAt(k.t), 0)
  })

  it('a pause from the start: nothing to estimate until the figure moves', () => {
    const ticks = feed(10, (t) => (t < 6 ? 40 : 40 - (t - 6)))
    expectSane(ticks)
    for (const k of ticks.filter((k) => k.t < 6.5)) expect(k.real).toBeNull()
    expect(known(ticks).length).toBeGreaterThan(0)
  })

  it('while towed to the box: nothing; after the tow, it starts measuring then', () => {
    const towUntil = 8
    const ticks = feed(
      16,
      (t) => 30 - t / 2,
      (f, t) => {
        f.PlayerCarTowTime[0] = t < towUntil ? towUntil - t : 0
      }
    )
    expectSane(ticks)
    for (const k of ticks.filter((k) => k.t < towUntil + REPAIR_CLOCK.minSpanS - 0.05)) {
      expect(k.real).toBeNull()
    }
    // (30 - t / 2) * 2 = 60 - t.
    for (const k of known(ticks)) expect(k.real).toBeCloseTo(60 - k.t, 1)
  })

  it('a fast repair (the figure gone in a tick): nothing left to show, never a negative', () => {
    const ticks = feed(8, (t) => (t < 4 ? 40 - t : 0))
    expectSane(ticks)
    for (const k of ticks.filter((k) => k.t >= 4)) expect(k.real).toBeNull()
  })

  it('a figure that drops most of the way at once: the estimate falls with it', () => {
    const ticks = feed(8, (t) => (t < 4 ? 40 - t : 3 - (t - 4)))
    expectSane(ticks)
    const late = known(ticks).filter((k) => k.t >= 4.5)
    expect(late.length).toBeGreaterThan(0)
    for (const k of late) expect(k.real).toBeLessThan(4)
  })

  it('new damage (the figure rises) starts over: a new estimate, not a rising one', () => {
    const ticks = feed(12, (t) => (t < 5 ? 20 - t : 40 - (t - 5)))
    expectSane(ticks)
    expect(ticks.find((k) => k.t >= 5.1 && k.t < 5 + REPAIR_CLOCK.minSpanS - 0.1)?.real).toBeNull()
    for (const k of known(ticks).filter((k) => k.t >= 8))
      expect(k.real).toBeCloseTo(40 - (k.t - 5), 1)
  })

  it('leaving the stall, moving, a replay or the service off: nothing estimated', () => {
    const cases: ((f: MutableFrame, t: number) => void)[] = [
      (f) => {
        f.PlayerCarInPitStall[0] = false
        f.PlayerTrackSurface[0] = TrackLocation.OnTrack
      },
      (f) => {
        f.Speed[0] = 3
      },
      (f) => {
        f.IsReplayPlaying[0] = true
      },
      (f) => {
        f.PitstopActive[0] = false
      },
      (f) => {
        f.IsOnTrack[0] = false
      }
    ]
    for (const edit of cases) {
      const ticks = feed(
        6,
        (t) => 30 - t / 3,
        (f, t) => t >= 3 && edit(f, t)
      )
      for (const k of ticks.filter((k) => k.t >= 3)) expect(k.real).toBeNull()
      expect(known(ticks).length).toBeGreaterThan(0)
    }
  })

  it('a sim without PitstopActive: in the stall and stopped is enough', () => {
    const f = serviced() as unknown as Record<string, unknown>
    f.PitstopActive = []
    expect(beingServiced(f as unknown as MutableFrame)).toBe(true)
  })

  it('the stall from the surface alone, or from PlayerCarInPitStall alone', () => {
    const a = serviced()
    a.PlayerCarInPitStall[0] = false
    expect(beingServiced(a)).toBe(true)
    const b = serviced()
    b.PlayerTrackSurface[0] = TrackLocation.ApproachingPits
    expect(beingServiced(b)).toBe(true)
  })

  it('the clock going back (a replay jump) or a paused sim', () => {
    const f = serviced()
    const clock = new RepairClock('PitRepairLeft')
    for (let n = 0; n <= 3 * HZ; n++) {
      f.SessionTime[0] = T0 + n / HZ
      f.PitRepairLeft[0] = 30 - n / HZ
      clock.observe(f, true)
    }
    const before = clock.realS()
    expect(before).not.toBeNull()
    // The same tick again (the sim paused): nothing changes.
    clock.observe(f, true)
    expect(clock.realS()).toBe(before)
    f.SessionTime[0] = T0
    clock.observe(f, true)
    expect(clock.realS()).toBeNull()
  })

  it('an absent or non-finite figure reads as none', () => {
    const f = serviced() as unknown as Record<string, unknown>
    const clock = new RepairClock('PitOptRepairLeft')
    f.SessionTime = [T0]
    f.PitOptRepairLeft = []
    clock.observe(f as unknown as MutableFrame, true)
    expect(clock.realS()).toBeNull()
    f.PitOptRepairLeft = [Number.NaN]
    clock.observe(f as unknown as MutableFrame, true)
    expect(clock.realS()).toBeNull()
  })
})
