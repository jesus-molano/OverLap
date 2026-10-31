import { describe, expect, it } from 'vitest'
import { RADAR } from './radar'
import { EMPTY_SESSION } from './session'
import { SPOTTER, SpotterProvider, closeness, overlapSegment, spotterEqual } from './spotter'
import { CarLeftRight, MAX_CARS, TELEMETRY_VAR_NAMES, TrackLocation } from './telemetry'
import type { TelemetryFrame } from './telemetry'
import type { DriverEntry, SessionMeta, SpotterData } from './types'

const TRACK_M = 5000
const PLAYER = 0
const PLAYER_PCT = 0.5
const L = SPOTTER.carLengthM

interface CarFixture {
  idx: number
  /** Metres from the player along the track, positive = ahead. Ignored when `pct` is set. */
  distM?: number
  pct?: number
  onPitRoad?: boolean
}

interface FrameFixture {
  time?: number
  clr?: number
  onTrack?: boolean
  playerPct?: number
  cars?: CarFixture[]
}

const filled = <T>(value: T): T[] => new Array<T>(MAX_CARS).fill(value)

const MISSING_VARS = Object.fromEntries(
  TELEMETRY_VAR_NAMES.map((n) => [n, []])
) as unknown as TelemetryFrame

function makeFrame(f: FrameFixture = {}): TelemetryFrame {
  const playerPct = f.playerPct ?? PLAYER_PCT
  const pct = filled(-1)
  const surface = filled<number>(TrackLocation.NotInWorld)
  const onPit = filled(false)
  pct[PLAYER] = playerPct
  surface[PLAYER] = TrackLocation.OnTrack
  for (const c of f.cars ?? []) {
    pct[c.idx] = c.pct ?? (((playerPct + (c.distM ?? 0) / TRACK_M) % 1) + 1) % 1
    surface[c.idx] = TrackLocation.OnTrack
    onPit[c.idx] = c.onPitRoad ?? false
  }
  return {
    ...MISSING_VARS,
    SessionTime: [f.time ?? 100],
    SessionNum: [0],
    SessionState: [4],
    PlayerCarIdx: [PLAYER],
    IsOnTrack: [f.onTrack ?? true],
    CarLeftRight: [f.clr ?? CarLeftRight.Clear],
    CarIdxLapDistPct: pct,
    CarIdxEstTime: filled(0),
    CarIdxLapCompleted: filled(3),
    CarIdxOnPitRoad: onPit,
    CarIdxTrackSurface: surface,
    CarIdxClassPosition: filled(0)
  }
}

function driver(carIdx: number): DriverEntry {
  return {
    carIdx,
    userName: `Driver ${carIdx}`,
    teamName: '',
    carNumber: String(carIdx),
    iRating: 2000,
    licString: 'A 4.00',
    licColor: '#0153db',
    classId: 1,
    classShortName: 'GT3',
    classColor: '#ffda59',
    classEstLapTime: 90,
    isPaceCar: false,
    isSpectator: false,
    licLevel: 16,
    licSubLevel: 400,
    classRelSpeed: 0,
    userId: 1000 + carIdx,
    teamId: 0,
    carId: 67,
    carName: 'Porsche 911 GT3 R',
    isAI: false,
    brand: 'unknown',
    country: ''
  }
}

function makeSession(trackLengthM: number | null = TRACK_M): SessionMeta {
  return {
    ...EMPTY_SESSION,
    playerCarIdx: PLAYER,
    paceCarIdx: -1,
    driverCarEstLapTime: 90,
    trackLengthM,
    trackName: 'Test',
    drivers: new Map(Array.from({ length: 10 }, (_, i) => [i, driver(i)])),
    sessionTypes: new Map([[0, 'Race']])
  }
}

/** One tick of a fresh spotter. */
function spot(f: FrameFixture, session = makeSession()): SpotterData {
  return new SpotterProvider().compute(makeFrame(f), session, null)
}

const q = (v: number): number => Math.round(v * SPOTTER.steps) / SPOTTER.steps

describe('overlapSegment: what of your car a car alongside covers', () => {
  it('pins the stretch to the end the car is at, the rest of your car free', () => {
    expect(overlapSegment(0)).toEqual({ from: 0, to: 1 })
    // Half a car length ahead: your front half.
    expect(overlapSegment(L / 2)).toEqual({ from: 0, to: 0.5 })
    // Half a car length behind: your rear half.
    expect(overlapSegment(-L / 2)).toEqual({ from: 0.5, to: 1 })
    expect(overlapSegment(1)).toEqual({ from: 0, to: q(1 - 1 / L) })
    expect(overlapSegment(-1)).toEqual({ from: q(1 / L), to: 1 })
  })

  it('shows at least a sliver at that end when iRacing counts a car a little beyond a length', () => {
    expect(overlapSegment(L + 0.5)).toEqual({ from: 0, to: SPOTTER.minCover })
    expect(overlapSegment(-(L + 0.5))).toEqual({ from: 1 - SPOTTER.minCover, to: 1 })
    expect(overlapSegment(L - 0.05)).toEqual({ from: 0, to: SPOTTER.minCover })
  })

  it('is quantised to SPOTTER.steps, so a pass changes the payload a bounded number of times', () => {
    const seen = new Set<string>()
    for (let d = -L; d <= L; d += 0.01) {
      const s = overlapSegment(d)
      expect(Math.round(s.from * SPOTTER.steps)).toBeCloseTo(s.from * SPOTTER.steps, 9)
      expect(Math.round(s.to * SPOTTER.steps)).toBeCloseTo(s.to * SPOTTER.steps, 9)
      seen.add(`${s.from}/${s.to}`)
    }
    expect(seen.size).toBeLessThanOrEqual(2 * SPOTTER.steps + 2)
  })
})

describe('SpotterProvider', () => {
  it('fills the left pillar from the front for a car alongside a little ahead', () => {
    const p = spot({ clr: CarLeftRight.CarLeft, cars: [{ idx: 3, distM: 1.5 }] })
    expect(p.active).toBe(true)
    expect(p.visible).toBe(true)
    expect(p.left).toMatchObject({ count: 1, unknown: false, nearFront: 0, nearRear: 0 })
    expect(p.left.segs).toEqual([overlapSegment(1.5)])
    expect(p.left.cover).toBe(q(1 - 1.5 / L))
    expect(p.right).toEqual({
      count: 0,
      segs: [],
      cover: 0,
      unknown: false,
      nearFront: 0,
      nearRear: 0,
      close: 0
    })
  })

  it('fills the right pillar from the rear for a car alongside a little behind', () => {
    const p = spot({ clr: CarLeftRight.CarRight, cars: [{ idx: 4, distM: -3 }] })
    expect(p.right.count).toBe(1)
    expect(p.right.segs).toEqual([{ from: q(3 / L), to: 1 }])
    expect(p.left.count).toBe(0)
  })

  it('is completely full with a car right beside you, and only then', () => {
    const p = spot({ clr: CarLeftRight.CarLeft, cars: [{ idx: 3, distM: 0.02 }] })
    expect(p.left.segs).toEqual([{ from: 0, to: 1 }])
    expect(p.left.cover).toBe(1)
    expect(spot({ clr: CarLeftRight.CarLeft, cars: [{ idx: 3, distM: 0.3 }] }).left.cover).toBe(
      q(1 - 0.3 / L)
    )
  })

  it('puts one car on each side when three wide', () => {
    const p = spot({
      clr: CarLeftRight.CarLeftRight,
      cars: [
        { idx: 3, distM: 2 },
        { idx: 4, distM: -1 }
      ]
    })
    expect(p.left.count).toBe(1)
    expect(p.right.count).toBe(1)
    // Without history iRacing does not say who is where: the car further ahead goes left.
    expect(p.left.segs).toEqual([overlapSegment(2)])
    expect(p.right.segs).toEqual([overlapSegment(-1)])
  })

  it('draws two cars on one side as two stretches with the count, merged where they overlap', () => {
    const apart = spot({
      clr: CarLeftRight.Cars2Left,
      cars: [
        { idx: 3, distM: 3.2 },
        { idx: 4, distM: -3.4 }
      ]
    })
    expect(apart.left.count).toBe(2)
    expect(apart.left.segs).toEqual([overlapSegment(3.2), overlapSegment(-3.4)])
    expect(apart.left.cover).toBe(
      q(1 - 3.2 / L + (1 - q(3.4 / L))) // the two stretches, each quantised
    )
    const merged = spot({
      clr: CarLeftRight.Cars2Right,
      cars: [
        { idx: 3, distM: 1 },
        { idx: 4, distM: -1 }
      ]
    })
    expect(merged.right.count).toBe(2)
    expect(merged.right.segs).toEqual([{ from: 0, to: 1 }])
    expect(merged.right.cover).toBe(1)
  })

  it('measures across the start/finish line', () => {
    // You 2.5 m before the line, the car 0.5 m after it: 3 m ahead.
    const p = spot({
      clr: CarLeftRight.CarRight,
      playerPct: 1 - 2.5 / TRACK_M,
      cars: [{ idx: 5, pct: 0.5 / TRACK_M }]
    })
    expect(p.right.segs).toEqual([overlapSegment(3)])
    // And the other way: you just past it, the car just before it.
    const back = spot({
      clr: CarLeftRight.CarRight,
      playerPct: 1 / TRACK_M,
      cars: [{ idx: 5, pct: 1 - 1 / TRACK_M }]
    })
    expect(back.right.segs).toEqual([overlapSegment(-2)])
  })

  it('shows a side iRacing counts but no car matches as "somewhere here"', () => {
    const lone = spot({ clr: CarLeftRight.CarLeft })
    expect(lone.left).toMatchObject({ count: 1, segs: [], unknown: true, cover: 1 })
    // No track length: no distances at all.
    const noLength = spot(
      { clr: CarLeftRight.CarRight, cars: [{ idx: 3, distM: 1 }] },
      makeSession(null)
    )
    expect(noLength.right).toMatchObject({ count: 1, segs: [], unknown: true })
  })

  it('ignores a car in the pit lane next to you on track', () => {
    const p = spot({ clr: CarLeftRight.Clear, cars: [{ idx: 3, distM: 0, onPitRoad: true }] })
    expect(p.left.count + p.right.count).toBe(0)
    expect(p.visible).toBe(false)
    expect(p.active).toBe(true)
  })

  it('caps the end a car that was just alongside sits off, while the radar holds its side', () => {
    const sp = new SpotterProvider()
    const s = makeSession()
    let prev = sp.compute(
      makeFrame({ time: 100, clr: CarLeftRight.CarLeft, cars: [{ idx: 3, distM: 2 }] }),
      s,
      null
    )
    expect(prev.left.count).toBe(1)
    // It pulls ahead: no longer counted, held on the left a car length and a half ahead.
    prev = sp.compute(
      makeFrame({ time: 100.5, clr: CarLeftRight.Clear, cars: [{ idx: 3, distM: 7 }] }),
      s,
      prev
    )
    expect(prev.left.count).toBe(0)
    expect(prev.left.segs).toEqual([])
    expect(prev.left.nearFront).toBeGreaterThan(0)
    expect(prev.left.nearFront).toBeLessThan(1)
    expect(prev.left.nearRear).toBe(0)
    expect(prev.visible).toBe(true)
    // Nearer, a stronger cap; beyond the side memory's reach, none.
    const nearer = sp.compute(
      makeFrame({ time: 101, clr: CarLeftRight.Clear, cars: [{ idx: 3, distM: 5 }] }),
      s,
      prev
    )
    expect(nearer.left.nearFront).toBeGreaterThan(prev.left.nearFront)
    const gone = sp.compute(
      makeFrame({
        time: 101.5,
        clr: CarLeftRight.Clear,
        cars: [{ idx: 3, distM: RADAR.sideHoldMaxM + 1 }]
      }),
      s,
      nearer
    )
    expect(gone.left.nearFront).toBe(0)
    expect(gone.visible).toBe(false)
  })

  it('forgets the side memory when the loop starts it over (prev null) or resets it', () => {
    const sp = new SpotterProvider()
    const s = makeSession()
    const first = sp.compute(
      makeFrame({ time: 100, clr: CarLeftRight.CarLeft, cars: [{ idx: 3, distM: 2 }] }),
      s,
      null
    )
    const restarted = sp.compute(
      makeFrame({ time: 100.5, clr: CarLeftRight.Clear, cars: [{ idx: 3, distM: 7 }] }),
      s,
      null
    )
    expect(first.left.count).toBe(1)
    expect(restarted.left.nearFront).toBe(0)
    sp.compute(
      makeFrame({ time: 100, clr: CarLeftRight.CarLeft, cars: [{ idx: 3, distM: 2 }] }),
      s,
      null
    )
    sp.reset()
    const after = sp.compute(
      makeFrame({ time: 100.5, clr: CarLeftRight.Clear, cars: [{ idx: 3, distM: 7 }] }),
      s,
      first
    )
    expect(after.left.nearFront).toBe(0)
  })

  it('is inactive out of the car and with iRacing’s spotter off', () => {
    const out = spot({ onTrack: false, clr: CarLeftRight.CarLeft, cars: [{ idx: 3, distM: 0 }] })
    expect(out).toMatchObject({ active: false, visible: false })
    expect(out.left.count).toBe(0)
    const off = spot({ clr: CarLeftRight.Off, cars: [{ idx: 3, distM: 0 }] })
    expect(off.active).toBe(false)
  })

  it('runs with the radar hidden: it takes no radar options', () => {
    // The provider reads nothing of the settings: the same payload whatever they say.
    const a = spot({ clr: CarLeftRight.CarLeft, cars: [{ idx: 3, distM: 1 }] })
    const b = spot({ clr: CarLeftRight.CarLeft, cars: [{ idx: 3, distM: 1 }] })
    expect(spotterEqual(a, b)).toBe(true)
  })
})

describe('closeness: the «Cercanía» bar, the radar as two bars (5c)', () => {
  it('follows the radar’s proximity: 1 within a car length, 0 at the side memory’s reach', () => {
    expect(closeness(0)).toBe(1)
    expect(closeness(L)).toBe(1)
    expect(closeness(SPOTTER.nearM)).toBe(0)
    expect(closeness(SPOTTER.nearM + 5)).toBe(0)
    const mid = (L + SPOTTER.nearM) / 2
    expect(closeness(mid)).toBe(0.5)
    expect(closeness(6)).toBeGreaterThan(closeness(8))
    // Quantised to SPOTTER.steps: a pass changes it a bounded number of times.
    for (const m of [5, 5.3, 7.77, 9.1, 11.4]) {
      expect(closeness(m) * SPOTTER.steps).toBeCloseTo(Math.round(closeness(m) * SPOTTER.steps), 9)
    }
  })

  it('is full on the side a car is alongside, wherever along you it is, placed or not', () => {
    for (const distM of [0, 2, -4.2]) {
      const p = spot({ clr: CarLeftRight.CarRight, cars: [{ idx: 4, distM }] })
      expect(p.right.close).toBe(1)
      expect(p.left.close).toBe(0)
    }
    expect(spot({ clr: CarLeftRight.CarLeft }).left.close).toBe(1)
    expect(spot({ clr: CarLeftRight.Cars2Left, cars: [{ idx: 3, distM: 1 }] }).left).toMatchObject({
      count: 2,
      close: 1
    })
  })

  it('empties as a car held on its side gets away, ahead or behind, and stays empty unsided', () => {
    const sp = new SpotterProvider()
    const s = makeSession()
    let prev = sp.compute(
      makeFrame({ time: 100, clr: CarLeftRight.CarLeft, cars: [{ idx: 3, distM: -2 }] }),
      s,
      null
    )
    expect(prev.left.close).toBe(1)
    const seen: number[] = []
    for (const [i, distM] of [-6, -8, -10].entries()) {
      prev = sp.compute(
        makeFrame({ time: 100.2 + i * 0.2, clr: CarLeftRight.Clear, cars: [{ idx: 3, distM }] }),
        s,
        prev
      )
      expect(prev.left.close).toBe(closeness(-distM))
      seen.push(prev.left.close)
    }
    expect(seen[0]).toBeGreaterThan(seen[1] ?? 1)
    expect(seen[1]).toBeGreaterThan(seen[2] ?? 1)
    expect(prev.visible).toBe(true)
    // A car right behind you that was never alongside: iRacing gives it no side, so no bar fills.
    const unsided = spot({ clr: CarLeftRight.Clear, cars: [{ idx: 5, distM: -5 }] })
    expect(unsided.left.close + unsided.right.close).toBe(0)
    expect(unsided.visible).toBe(false)
  })

  it('shares one empty side and one inactive payload: a quiet pass allocates none', () => {
    const a = spot({ clr: CarLeftRight.Clear })
    const b = spot({ clr: CarLeftRight.Clear })
    expect(a.left).toBe(b.left)
    expect(a.left).toBe(a.right)
    expect(Object.isFrozen(a.left)).toBe(true)
    const out1 = spot({ onTrack: false })
    expect(spot({ onTrack: false })).toBe(out1)
  })
})

describe('spotterEqual', () => {
  it('tells payloads that draw the same from those that do not', () => {
    const a = spot({ clr: CarLeftRight.CarLeft, cars: [{ idx: 3, distM: 1 }] })
    // A centimetre further on: the same quantised stretch.
    expect(
      spotterEqual(a, spot({ clr: CarLeftRight.CarLeft, cars: [{ idx: 3, distM: 1.01 }] }))
    ).toBe(true)
    expect(spotterEqual(a, spot({ clr: CarLeftRight.CarLeft, cars: [{ idx: 3, distM: 2 }] }))).toBe(
      false
    )
    expect(
      spotterEqual(a, spot({ clr: CarLeftRight.CarRight, cars: [{ idx: 3, distM: 1 }] }))
    ).toBe(false)
    const two = spot({
      clr: CarLeftRight.Cars2Left,
      cars: [
        { idx: 3, distM: 3.2 },
        { idx: 4, distM: -3.4 }
      ]
    })
    const twoMoved = spot({
      clr: CarLeftRight.Cars2Left,
      cars: [
        { idx: 3, distM: 3.2 },
        { idx: 4, distM: -2.4 }
      ]
    })
    expect(spotterEqual(two, twoMoved)).toBe(false)
  })
})
