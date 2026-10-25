import { describe, it, expect } from 'vitest'
import { computeRadar, proximityColor, RADAR, sideCounts } from './radar'
import { EMPTY_SESSION } from './session'
import { CarLeftRight, MAX_CARS, TELEMETRY_VAR_NAMES, TrackLocation } from './telemetry'
import type { TelemetryFrame } from './telemetry'
import type { DriverEntry, RadarCar, RadarData, RadarOptions, SessionMeta } from './types'

const TRACK_M = 5000
const PLAYER = 0
const PLAYER_PCT = 0.5

interface CarFixture {
  idx: number
  /** Metres from the player along the track, positive = ahead. Ignored when `pct` is set. */
  distM?: number
  pct?: number
  onPitRoad?: boolean
  surface?: number
}

interface FrameFixture {
  /** SessionTime in seconds (100 by default); null = variable missing. */
  time?: number | null
  clr?: number
  onTrack?: boolean
  playerCarIdx?: number
  playerPct?: number
  playerOnPitRoad?: boolean
  playerSurface?: number
  cars?: CarFixture[]
}

function filled<T>(value: T): T[] {
  return new Array<T>(MAX_CARS).fill(value)
}

/** Every variable missing (empty array); makeFrame fills the ones the radar reads. */
const MISSING_VARS = Object.fromEntries(
  TELEMETRY_VAR_NAMES.map((n) => [n, []])
) as unknown as TelemetryFrame

function makeFrame(f: FrameFixture = {}): TelemetryFrame {
  const player = f.playerCarIdx ?? PLAYER
  const playerPct = f.playerPct ?? PLAYER_PCT
  const pct = filled(-1)
  const surface = filled<number>(TrackLocation.NotInWorld)
  const onPit = filled(false)
  if (player >= 0 && player < MAX_CARS) {
    pct[player] = playerPct
    surface[player] = f.playerSurface ?? TrackLocation.OnTrack
    onPit[player] = f.playerOnPitRoad ?? false
  }
  for (const c of f.cars ?? []) {
    pct[c.idx] = c.pct ?? (((playerPct + (c.distM ?? 0) / TRACK_M) % 1) + 1) % 1
    surface[c.idx] = c.surface ?? TrackLocation.OnTrack
    onPit[c.idx] = c.onPitRoad ?? false
  }
  return {
    ...MISSING_VARS,
    SessionTime: f.time === null ? [] : [f.time ?? 100],
    SessionNum: [0],
    SessionState: [4],
    PlayerCarIdx: [player],
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

function driver(carIdx: number, extra: Partial<DriverEntry> = {}): DriverEntry {
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
    ...extra
  }
}

interface SessionFixture {
  trackLengthM?: number | null
  paceCarIdx?: number
  playerCarIdx?: number
  drivers?: DriverEntry[]
}

function makeSession(s: SessionFixture = {}): SessionMeta {
  const drivers = s.drivers ?? Array.from({ length: 10 }, (_, i) => driver(i))
  return {
    ...EMPTY_SESSION,
    playerCarIdx: s.playerCarIdx ?? PLAYER,
    paceCarIdx: s.paceCarIdx ?? -1,
    driverCarEstLapTime: 90,
    trackLengthM: s.trackLengthM === undefined ? TRACK_M : s.trackLengthM,
    trackName: 'Test',
    drivers: new Map(drivers.map((d) => [d.carIdx, d])),
    sessionTypes: new Map([[0, 'Race']])
  }
}

function radar(
  f: FrameFixture,
  opts: { session?: SessionMeta; prev?: RadarData | null; rangeM?: number } = {}
): RadarData {
  return computeRadar(
    makeFrame(f),
    opts.session ?? makeSession(),
    radarOpts(opts.rangeM ?? 20),
    opts.prev ?? null
  )
}

function radarOpts(rangeM: number): RadarOptions {
  return { rangeM, showRangeLabels: true }
}

function carOf(data: RadarData, carIdx: number): RadarCar | undefined {
  return data.cars.find((c) => c.carIdx === carIdx)
}

function laneOf(data: RadarData, carIdx: number): number | undefined {
  return carOf(data, carIdx)?.lane
}

function expectHidden(data: RadarData, clr: number): void {
  expect(data.visible).toBe(false)
  expect(data.cars).toEqual([])
  expect(data.leftCount).toBe(0)
  expect(data.rightCount).toBe(0)
  expect(data.carLeftRight).toBe(clr)
}

describe('sideCounts', () => {
  it('maps every CarLeftRight value', () => {
    expect(sideCounts(CarLeftRight.Off)).toEqual({ left: 0, right: 0 })
    expect(sideCounts(CarLeftRight.Clear)).toEqual({ left: 0, right: 0 })
    expect(sideCounts(CarLeftRight.CarLeft)).toEqual({ left: 1, right: 0 })
    expect(sideCounts(CarLeftRight.CarRight)).toEqual({ left: 0, right: 1 })
    expect(sideCounts(CarLeftRight.CarLeftRight)).toEqual({ left: 1, right: 1 })
    expect(sideCounts(CarLeftRight.Cars2Left)).toEqual({ left: 2, right: 0 })
    expect(sideCounts(CarLeftRight.Cars2Right)).toEqual({ left: 0, right: 2 })
    expect(sideCounts(42)).toEqual({ left: 0, right: 0 })
    expect(sideCounts(-1)).toEqual({ left: 0, right: 0 })
  })
})

describe('computeRadar: side lanes', () => {
  it('Cars2Left: nearer car on the inner lane, the other outside', () => {
    const data = radar({
      clr: CarLeftRight.Cars2Left,
      cars: [
        { idx: 1, distM: -3 },
        { idx: 2, distM: 1 }
      ]
    })
    expect(data.visible).toBe(true)
    expect(data.leftCount).toBe(2)
    expect(data.rightCount).toBe(0)
    expect(laneOf(data, 2)).toBe(-1)
    expect(laneOf(data, 1)).toBe(-2)
    for (const car of data.cars) {
      expect(car.overlapping).toBe(true)
      expect(car.proximity).toBe(1)
      expect(car.color).toBe(proximityColor(1))
      expect(car.classColor).toBe('#ffda59')
    }
    expect(data.cars.map((c) => c.carIdx)).toEqual([2, 1])
  })

  it('Cars2Right: lanes +1 (nearer) and +2', () => {
    const data = radar({
      clr: CarLeftRight.Cars2Right,
      cars: [
        { idx: 1, distM: 2.5 },
        { idx: 2, distM: -0.5 }
      ]
    })
    expect(data.leftCount).toBe(0)
    expect(data.rightCount).toBe(2)
    expect(laneOf(data, 2)).toBe(1)
    expect(laneOf(data, 1)).toBe(2)
  })

  it('Cars2Left keeps each car in its previous lane when their order swaps', () => {
    const first = radar({
      clr: CarLeftRight.Cars2Left,
      cars: [
        { idx: 1, distM: 1 },
        { idx: 2, distM: 3 }
      ]
    })
    expect(laneOf(first, 1)).toBe(-1)
    expect(laneOf(first, 2)).toBe(-2)
    const second = radar(
      {
        clr: CarLeftRight.Cars2Left,
        cars: [
          { idx: 1, distM: 3 },
          { idx: 2, distM: 1 }
        ]
      },
      { prev: first }
    )
    expect(laneOf(second, 1)).toBe(-1)
    expect(laneOf(second, 2)).toBe(-2)
  })

  it('CarLeft / CarRight: single car alongside, a car right behind stays in lane 0', () => {
    const cars = [
      { idx: 1, distM: -2 },
      { idx: 2, distM: -9 }
    ]
    const l = radar({ clr: CarLeftRight.CarLeft, cars })
    expect(l.leftCount).toBe(1)
    expect(l.rightCount).toBe(0)
    expect(laneOf(l, 1)).toBe(-1)
    expect(laneOf(l, 2)).toBe(0)
    expect(l.cars.find((c) => c.carIdx === 1)?.overlapping).toBe(true)
    expect(l.cars.find((c) => c.carIdx === 2)?.overlapping).toBe(false)

    const r = radar({ clr: CarLeftRight.CarRight, cars })
    expect(r.leftCount).toBe(0)
    expect(r.rightCount).toBe(1)
    expect(laneOf(r, 1)).toBe(1)
    expect(laneOf(r, 2)).toBe(0)
  })

  it('picks the nearest car when several are within the overlap', () => {
    const data = radar({
      clr: CarLeftRight.CarLeft,
      cars: [
        { idx: 1, distM: 5 },
        { idx: 2, distM: -1 }
      ]
    })
    expect(laneOf(data, 2)).toBe(-1)
    expect(laneOf(data, 1)).toBe(0)
  })

  it('widens the search to overlapSearchM when nobody is within overlapM', () => {
    const data = radar({ clr: CarLeftRight.CarRight, cars: [{ idx: 1, distM: 7 }] })
    expect(laneOf(data, 1)).toBe(1)
    expect(data.cars).toHaveLength(1)
    expect(data.cars[0]?.distM).toBeCloseTo(7, 6)
    const far = radar({ clr: CarLeftRight.CarRight, cars: [{ idx: 1, distM: 9 }] })
    expect(laneOf(far, -1)).toBe(1)
    expect(laneOf(far, 1)).toBe(0)
  })

  it('keeps a side car even when it is beyond the configured range', () => {
    const data = radar(
      { clr: CarLeftRight.CarLeft, cars: [{ idx: 1, distM: 7 }] },
      { rangeM: RADAR.minRangeM }
    )
    expect(laneOf(data, 1)).toBe(-1)
  })

  it('CarLeftRight without history: the car further ahead goes left', () => {
    const data = radar({
      clr: CarLeftRight.CarLeftRight,
      cars: [
        { idx: 1, distM: -1 },
        { idx: 2, distM: 2 }
      ]
    })
    expect(data.leftCount).toBe(1)
    expect(data.rightCount).toBe(1)
    expect(laneOf(data, 2)).toBe(-1)
    expect(laneOf(data, 1)).toBe(1)
    expect(data.cars.every((c) => c.overlapping)).toBe(true)
  })

  it('CarLeftRight with history keeps the sides when the order swaps', () => {
    const first = radar({
      clr: CarLeftRight.CarLeftRight,
      cars: [
        { idx: 1, distM: -1 },
        { idx: 2, distM: 2 }
      ]
    })
    const snapshot = JSON.stringify(first)
    const second = radar(
      {
        clr: CarLeftRight.CarLeftRight,
        cars: [
          { idx: 1, distM: 2 },
          { idx: 2, distM: -1 }
        ]
      },
      { prev: first }
    )
    expect(laneOf(second, 2)).toBe(-1)
    expect(laneOf(second, 1)).toBe(1)
    // prev is never mutated.
    expect(JSON.stringify(first)).toBe(snapshot)
  })

  it('CarLeftRight with history for one car only puts the other on the opposite side', () => {
    const prev = radar({ clr: CarLeftRight.CarRight, cars: [{ idx: 1, distM: -1 }] })
    expect(laneOf(prev, 1)).toBe(1)
    const data = radar(
      {
        clr: CarLeftRight.CarLeftRight,
        cars: [
          { idx: 1, distM: -1 },
          { idx: 3, distM: -2 }
        ]
      },
      { prev }
    )
    expect(laneOf(data, 1)).toBe(1)
    expect(laneOf(data, 3)).toBe(-1)
  })

  it('a car moving from 2-wide outer lane keeps its side', () => {
    const prev = radar({
      clr: CarLeftRight.Cars2Left,
      cars: [
        { idx: 1, distM: 0.5 },
        { idx: 2, distM: 2 }
      ]
    })
    expect(laneOf(prev, 2)).toBe(-2)
    // Car 1 dropped back out of the overlap; car 2 is now the only one on the left.
    const data = radar(
      {
        clr: CarLeftRight.CarLeft,
        cars: [
          { idx: 1, distM: -10 },
          { idx: 2, distM: 1 }
        ]
      },
      { prev }
    )
    expect(laneOf(data, 2)).toBe(-1)
    // Side-lane hold: car 1 stays on the left, not overlapping, outside car 2 that took -1.
    expect(carOf(data, 1)).toMatchObject({ lane: -2, overlapping: false })
  })

  it('a car alongside keeps its lane when a drafting car gets nearer', () => {
    const first = radar({
      clr: CarLeftRight.CarLeft,
      cars: [
        { idx: 1, distM: 4.5 },
        { idx: 2, distM: -4.8 }
      ]
    })
    expect(laneOf(first, 1)).toBe(-1)
    expect(laneOf(first, 2)).toBe(0)
    const second = radar(
      {
        clr: CarLeftRight.CarLeft,
        cars: [
          { idx: 1, distM: 4.9 },
          { idx: 2, distM: -4.7 }
        ]
      },
      { prev: first }
    )
    expect(laneOf(second, 1)).toBe(-1)
    expect(laneOf(second, 2)).toBe(0)
    expect(second.cars.find((c) => c.carIdx === 2)?.overlapping).toBe(false)
  })

  it('CarLeftRight -> CarLeft -> CarLeftRight keeps each car on its side', () => {
    const both = radar({
      clr: CarLeftRight.CarLeftRight,
      cars: [
        { idx: 1, distM: 2 },
        { idx: 2, distM: -1 }
      ]
    })
    expect(laneOf(both, 1)).toBe(-1)
    expect(laneOf(both, 2)).toBe(1)
    // Car 2 is nearer but its side is no longer reported: it must not jump to the left.
    const leftOnly = radar(
      {
        clr: CarLeftRight.CarLeft,
        cars: [
          { idx: 1, distM: 2.2 },
          { idx: 2, distM: -0.8 }
        ]
      },
      { prev: both }
    )
    expect(laneOf(leftOnly, 1)).toBe(-1)
    // Side-lane hold: car 2 keeps the right lane, no longer overlapping.
    expect(carOf(leftOnly, 2)).toMatchObject({ lane: 1, overlapping: false })
    const again = radar(
      {
        clr: CarLeftRight.CarLeftRight,
        cars: [
          { idx: 1, distM: 2.4 },
          { idx: 2, distM: -0.6 }
        ]
      },
      { prev: leftOnly }
    )
    expect(laneOf(again, 1)).toBe(-1)
    expect(laneOf(again, 2)).toBe(1)
  })

  it('Cars2Left -> CarLeftRight: the outer car stays left, a new car takes the right', () => {
    const two = radar({
      clr: CarLeftRight.Cars2Left,
      cars: [
        { idx: 1, distM: 1 },
        { idx: 2, distM: 3 }
      ]
    })
    expect(laneOf(two, 1)).toBe(-1)
    expect(laneOf(two, 2)).toBe(-2)
    const data = radar(
      {
        clr: CarLeftRight.CarLeftRight,
        cars: [
          { idx: 1, distM: 1.2 },
          { idx: 2, distM: 3.5 },
          { idx: 3, distM: -5 }
        ]
      },
      { prev: two }
    )
    expect(laneOf(data, 1)).toBe(-1)
    // Side-lane hold: no longer counted alongside, car 2 keeps its outer left lane.
    expect(carOf(data, 2)).toMatchObject({ lane: -2, overlapping: false })
    expect(laneOf(data, 3)).toBe(1)
    expect(data.cars.some((c) => c.carIdx === -1)).toBe(false)
  })

  it('a car with side history never switches sides: a phantom fills the other side', () => {
    const prev = radar({ clr: CarLeftRight.CarLeft, cars: [{ idx: 1, distM: 1 }] })
    expect(laneOf(prev, 1)).toBe(-1)
    const data = radar({ clr: CarLeftRight.CarRight, cars: [{ idx: 1, distM: 1 }] }, { prev })
    // Side-lane hold: it stays on the left, not overlapping.
    expect(carOf(data, 1)).toMatchObject({ lane: -1, overlapping: false })
    expect(laneOf(data, -1)).toBe(1)
    expect(data.visible).toBe(true)
  })

  it('CarLeftRight without history ranks only the two nearest candidates', () => {
    const data = radar({
      clr: CarLeftRight.CarLeftRight,
      cars: [
        { idx: 1, distM: -1 },
        { idx: 2, distM: 2 },
        { idx: 3, distM: 6 }
      ]
    })
    expect(laneOf(data, 2)).toBe(-1)
    expect(laneOf(data, 1)).toBe(1)
    expect(laneOf(data, 3)).toBe(0)
  })

  it('adds a phantom when CarLeftRight reports more cars than are near', () => {
    const data = radar({ clr: CarLeftRight.CarLeftRight, cars: [{ idx: 1, distM: 1 }] })
    expect(data.cars).toHaveLength(2)
    const phantom = data.cars.find((c) => c.carIdx === -1)
    expect(phantom).toMatchObject({ distM: 0, overlapping: true, classColor: '#ffffff' })
    expect(phantom?.lane).toBe(-(laneOf(data, 1) ?? 0))
  })

  it('takes cars alongside from within overlapM while it holds enough of them (B24)', () => {
    // Car 1 was alongside on the left; now only the right is reported, and car 2 is 7 m away:
    // too far to overlap you while car 1 is level, so the right lane is a phantom.
    const prev = radar({
      clr: CarLeftRight.CarLeft,
      cars: [
        { idx: 1, distM: 1 },
        { idx: 2, distM: 7 }
      ]
    })
    expect(laneOf(prev, 1)).toBe(-1)
    const data = radar(
      {
        clr: CarLeftRight.CarRight,
        cars: [
          { idx: 1, distM: 1 },
          { idx: 2, distM: 7 }
        ]
      },
      { prev }
    )
    expect(laneOf(data, 2)).toBe(0)
    expect(laneOf(data, -1)).toBe(1)
    expect(RADAR.overlapM).toBeLessThan(RADAR.overlapSearchM)
    // Nobody within overlapM: the pool widens and car 2 is the one alongside.
    const alone = radar({ clr: CarLeftRight.CarRight, cars: [{ idx: 2, distM: 7 }] })
    expect(laneOf(alone, 2)).toBe(1)
  })

  it('keeps a car alongside in its lane up to overlapSearchM: no swap around overlapM', () => {
    const first = radar({
      clr: CarLeftRight.CarRight,
      cars: [
        { idx: 1, distM: 5.4 },
        { idx: 2, distM: -5.6 }
      ]
    })
    expect(laneOf(first, 1)).toBe(1)
    const second = radar(
      {
        clr: CarLeftRight.CarRight,
        cars: [
          { idx: 1, distM: 5.6 },
          { idx: 2, distM: -5.4 }
        ]
      },
      { prev: first }
    )
    expect(laneOf(second, 1)).toBe(1)
    expect(laneOf(second, 2)).toBe(0)
  })
})

describe('computeRadar: lone sessions (B11)', () => {
  // Lone qualifying: the other cars are on track in runs of their own, not with you.
  const lone: SessionMeta = { ...makeSession(), sessionTypes: new Map([[0, 'Lone Qualify']]) }

  it('draws none of the other cars: CarLeftRight said clear all along', () => {
    const data = radar(
      {
        clr: CarLeftRight.Clear,
        cars: [
          { idx: 1, distM: 4.1 },
          { idx: 2, distM: -12 }
        ]
      },
      { session: lone }
    )
    expect(data.visible).toBe(false)
    expect(data.cars).toEqual([])
    // An open session shows them.
    expect(radar({ clr: CarLeftRight.Clear, cars: [{ idx: 1, distM: 4.1 }] }).visible).toBe(true)
  })

  it('still shows what CarLeftRight reports, as phantoms', () => {
    const data = radar(
      { clr: CarLeftRight.CarLeft, cars: [{ idx: 1, distM: 1 }] },
      { session: lone }
    )
    expect(data.visible).toBe(true)
    expect(data.cars.map((c) => [c.carIdx, c.lane])).toEqual([[-1, -1]])
  })
})

describe('computeRadar: side-lane hold', () => {
  const T0 = 100
  const END = T0 + RADAR.sideHoldS

  /** Car 1 alongside on the left at `time`. */
  function alongsideLeft(time = T0, rangeM = 20): RadarData {
    return radar({ time, clr: CarLeftRight.CarLeft, cars: [{ idx: 1, distM: 1 }] }, { rangeM })
  }

  /** Car 1 held on the left at `distM` after alongsideLeft(). */
  function heldLeft(distM: number, time = T0 + 0.5): RadarData {
    return radar(
      { time, clr: CarLeftRight.Clear, cars: [{ idx: 1, distM }] },
      { prev: alongsideLeft() }
    )
  }

  it('a car that pulls ahead of the overlap keeps its side lane for sideHoldS, not overlapping', () => {
    const first = alongsideLeft()
    expect(carOf(first, 1)).toMatchObject({ lane: -1, overlapping: true, sideHoldUntil: END })
    const snapshot = JSON.stringify(first)
    const proximity = 1 - (7 - RADAR.carLengthM) / (20 - RADAR.carLengthM)
    let prev = first
    for (const time of [T0 + 0.5, T0 + 1.5, END - 0.01]) {
      prev = radar({ time, clr: CarLeftRight.Clear, cars: [{ idx: 1, distM: 7 }] }, { prev })
      const car = carOf(prev, 1)
      expect(car?.lane).toBe(-1)
      expect(car?.overlapping).toBe(false)
      // By distance, like a lane-0 car: not forced to 1.
      expect(car?.proximity).toBeCloseTo(proximity, 6)
      expect(car?.color).toBe(proximityColor(car?.proximity ?? 0))
      // Not refreshed while held: the hold counts from the last tick alongside.
      expect(car?.sideHoldUntil).toBe(END)
      expect(prev.leftCount).toBe(0)
      expect(prev.visible).toBe(true)
      expect(prev.cars.some((c) => c.carIdx === -1)).toBe(false)
    }
    // prev is never mutated.
    expect(JSON.stringify(first)).toBe(snapshot)
    const expired = radar(
      { time: END, clr: CarLeftRight.Clear, cars: [{ idx: 1, distM: 7 }] },
      { prev }
    )
    expect(carOf(expired, 1)).toMatchObject({ lane: 0, overlapping: false })
    expect(carOf(expired, 1)?.sideHoldUntil).toBeUndefined()
  })

  it('refreshes the hold on every tick alongside; dropping back holds too', () => {
    const later = radar(
      { time: T0 + 5, clr: CarLeftRight.CarLeft, cars: [{ idx: 1, distM: 2 }] },
      { prev: alongsideLeft() }
    )
    expect(carOf(later, 1)?.sideHoldUntil).toBe(T0 + 5 + RADAR.sideHoldS)
    const held = radar(
      { time: T0 + 7.5, clr: CarLeftRight.Clear, cars: [{ idx: 1, distM: -7 }] },
      { prev: later }
    )
    expect(carOf(held, 1)).toMatchObject({ lane: -1, overlapping: false })
  })

  it('beyond sideHoldMaxM the car goes to lane 0 at once and its side is forgotten', () => {
    const prev = alongsideLeft()
    for (const sign of [1, -1]) {
      const far = radar(
        {
          time: T0 + 0.1,
          clr: CarLeftRight.Clear,
          cars: [{ idx: 1, distM: sign * (RADAR.sideHoldMaxM + 0.5) }]
        },
        { prev }
      )
      expect(carOf(far, 1)).toMatchObject({ lane: 0, overlapping: false })
      const back = radar(
        { time: T0 + 0.2, clr: CarLeftRight.Clear, cars: [{ idx: 1, distM: sign * 7 }] },
        { prev: far }
      )
      expect(laneOf(back, 1)).toBe(0)
      const within = radar(
        {
          time: T0 + 0.1,
          clr: CarLeftRight.Clear,
          cars: [{ idx: 1, distM: sign * (RADAR.sideHoldMaxM - 0.5) }]
        },
        { prev }
      )
      expect(laneOf(within, 1)).toBe(-1)
    }
  })

  it('a new car alongside on that side takes the lane: the held car moves outside, else to lane 0', () => {
    const held = heldLeft(7)
    expect(laneOf(held, 1)).toBe(-1)
    // Car 1, 7 m ahead, is a side candidate too, but car 2 is nearer.
    const cars = [
      { idx: 1, distM: 7 },
      { idx: 2, distM: -1 }
    ]
    const one = radar({ time: T0 + 1, clr: CarLeftRight.CarLeft, cars }, { prev: held })
    expect(carOf(one, 2)).toMatchObject({ lane: -1, overlapping: true, proximity: 1 })
    expect(carOf(one, 1)).toMatchObject({ lane: -2, overlapping: false, sideHoldUntil: END })
    expect(one.cars.some((c) => c.carIdx === -1)).toBe(false)
    const next = radar({ time: T0 + 1.1, clr: CarLeftRight.CarLeft, cars }, { prev: one })
    expect(laneOf(next, 2)).toBe(-1)
    expect(carOf(next, 1)).toMatchObject({ lane: -2, overlapping: false })

    // Two cars alongside on the left: no lane left on that side.
    const two = radar(
      {
        time: T0 + 1,
        clr: CarLeftRight.Cars2Left,
        cars: [...cars, { idx: 3, distM: 2 }]
      },
      { prev: held }
    )
    expect(laneOf(two, 2)).toBe(-1)
    expect(laneOf(two, 3)).toBe(-2)
    expect(carOf(two, 1)).toMatchObject({ lane: 0, overlapping: false })
    expect(carOf(two, 1)?.sideHoldUntil).toBeUndefined()

    // An unmatched car alongside (phantom) owns its lane as well.
    const phantom = radar(
      { time: T0 + 1, clr: CarLeftRight.CarLeft, cars: [{ idx: 1, distM: 10 }] },
      { prev: heldLeft(10) }
    )
    expect(laneOf(phantom, -1)).toBe(-1)
    expect(carOf(phantom, 1)).toMatchObject({ lane: -2, overlapping: false })
  })

  it('a held car alongside again goes through normal assignment and keeps its side', () => {
    const again = radar(
      {
        time: T0 + 1,
        clr: CarLeftRight.CarLeft,
        cars: [
          { idx: 1, distM: 2 },
          { idx: 2, distM: -6 }
        ]
      },
      { prev: heldLeft(7) }
    )
    expect(carOf(again, 1)).toMatchObject({
      lane: -1,
      overlapping: true,
      proximity: 1,
      sideHoldUntil: T0 + 1 + RADAR.sideHoldS
    })
    expect(carOf(again, 2)).toMatchObject({ lane: 0, overlapping: false })
  })

  it('never moves a held car to the opposite side', () => {
    const cases = [
      { from: CarLeftRight.CarLeft, lane: -1, to: CarLeftRight.CarRight },
      { from: CarLeftRight.CarRight, lane: 1, to: CarLeftRight.CarLeft }
    ]
    for (const { from, lane, to } of cases) {
      const prev = radar({ time: T0, clr: from, cars: [{ idx: 1, distM: 1 }] })
      const held = radar(
        { time: T0 + 0.5, clr: CarLeftRight.Clear, cars: [{ idx: 1, distM: 3 }] },
        { prev }
      )
      expect(carOf(held, 1)).toMatchObject({ lane, overlapping: false })
      // Only the other side is reported and car 1 is the only candidate: a phantom takes it.
      const data = radar({ time: T0 + 1, clr: to, cars: [{ idx: 1, distM: 3 }] }, { prev: held })
      expect(carOf(data, 1)).toMatchObject({ lane, overlapping: false })
      expect(laneOf(data, -1)).toBe(-lane)
      expect(data.visible).toBe(true)
    }

    // One car each side: the held car keeps the left, so the new one takes the right although
    // the "further ahead goes left" rule alone would put it on the left.
    const both = radar(
      {
        time: T0 + 1,
        clr: CarLeftRight.CarLeftRight,
        cars: [
          { idx: 1, distM: -6 },
          { idx: 2, distM: 1 }
        ]
      },
      { prev: heldLeft(-6) }
    )
    expect(carOf(both, 1)).toMatchObject({ lane: -1, overlapping: true })
    expect(carOf(both, 2)).toMatchObject({ lane: 1, overlapping: true })
  })

  it('without a valid SessionTime nothing is held (previous behaviour)', () => {
    for (const time of [null, Number.NaN, Number.POSITIVE_INFINITY]) {
      const first = radar({ time, clr: CarLeftRight.CarLeft, cars: [{ idx: 1, distM: 1 }] })
      expect(carOf(first, 1)).toMatchObject({ lane: -1, overlapping: true })
      expect(carOf(first, 1)?.sideHoldUntil).toBeUndefined()
      const next = radar(
        { time, clr: CarLeftRight.Clear, cars: [{ idx: 1, distM: 7 }] },
        { prev: first }
      )
      expect(carOf(next, 1)).toMatchObject({ lane: 0, overlapping: false })
    }
    const valid = alongsideLeft()
    const clear = { clr: CarLeftRight.Clear, cars: [{ idx: 1, distM: 7 }] }
    // A hold set with a valid clock does not run on a tick without one...
    expect(laneOf(radar({ ...clear, time: null }, { prev: valid }), 1)).toBe(0)
    // ... nor after SessionTime went back (new session, replay).
    expect(laneOf(radar({ ...clear, time: T0 - 10 }, { prev: valid }), 1)).toBe(0)
  })

  it('a held car shows the panel only by distance, like a lane-0 car', () => {
    const rangeM = 10
    const prev = alongsideLeft(T0, rangeM)
    expect(prev.visible).toBe(true)
    /** Shown panel: hides three quarters through the fade band. */
    const leaveM = rangeM * (1 - RADAR.edgeFadeFrac / 4)
    const at = (distM: number): RadarData =>
      radar(
        { time: T0 + 0.5, clr: CarLeftRight.Clear, cars: [{ idx: 1, distM }] },
        { rangeM, prev }
      )
    const faint = at(leaveM + 0.2)
    expect(carOf(faint, 1)).toMatchObject({ lane: -1, overlapping: false })
    expect(faint.visible).toBe(false)
    const near = at(leaveM - 0.5)
    expect(laneOf(near, 1)).toBe(-1)
    expect(near.visible).toBe(true)
    // Beyond the range it is dropped like a lane-0 car.
    const out = at(rangeM + 0.5)
    expect(out.cars).toEqual([])
    expect(out.visible).toBe(false)
  })
})

describe('computeRadar: cars ahead and behind', () => {
  it('Clear: car 10 m ahead shown in lane 0 with partial proximity', () => {
    const data = radar({ clr: CarLeftRight.Clear, cars: [{ idx: 1, distM: 10 }] }, { rangeM: 20 })
    expect(data.visible).toBe(true)
    expect(data.leftCount).toBe(0)
    expect(data.rightCount).toBe(0)
    expect(data.cars).toHaveLength(1)
    const car = data.cars[0]
    expect(car?.lane).toBe(0)
    expect(car?.overlapping).toBe(false)
    expect(car?.distM).toBeCloseTo(10, 6)
    expect(car?.proximity).toBeGreaterThan(0)
    expect(car?.proximity).toBeLessThan(1)
    expect(car?.proximity).toBeCloseTo(1 - (10 - RADAR.carLengthM) / (20 - RADAR.carLengthM), 6)
    expect(car?.color).toBe(proximityColor(car?.proximity ?? 0))
    expect(car?.classColor).toBe('#ffda59')
  })

  it('Clear: a car at 30 m with range 20 is not shown', () => {
    const data = radar({ clr: CarLeftRight.Clear, cars: [{ idx: 1, distM: -30 }] }, { rangeM: 20 })
    expect(data.visible).toBe(false)
    expect(data.cars).toEqual([])
  })

  it('Clear and nobody near: not visible', () => {
    const data = radar({ clr: CarLeftRight.Clear })
    expect(data.visible).toBe(false)
    expect(data.cars).toEqual([])
    expect(data.trackLengthKnown).toBe(true)
    expect(data.carLeftRight).toBe(CarLeftRight.Clear)
  })

  it('touching cars get proximity 1, cars at the range edge 0', () => {
    const data = radar({
      clr: CarLeftRight.Clear,
      cars: [
        { idx: 1, distM: -4 },
        { idx: 2, distM: 19.99 }
      ]
    })
    expect(data.cars.find((c) => c.carIdx === 1)?.proximity).toBe(1)
    expect(data.cars.find((c) => c.carIdx === 2)?.proximity).toBeCloseTo(0, 2)
  })

  it('sorts cars by |distM|', () => {
    const data = radar({
      clr: CarLeftRight.CarLeft,
      cars: [
        { idx: 1, distM: 15 },
        { idx: 2, distM: -8.5 },
        { idx: 3, distM: 1 },
        { idx: 4, distM: -12 }
      ]
    })
    expect(data.cars.map((c) => c.carIdx)).toEqual([3, 2, 4, 1])
  })

  it('wraps across the start/finish line', () => {
    const ahead = radar({ playerPct: 0.999, cars: [{ idx: 1, pct: 0.001 }] })
    expect(ahead.cars[0]?.distM).toBeCloseTo(10, 6)
    const behind = radar({ playerPct: 0.001, cars: [{ idx: 1, pct: 0.999 }] })
    expect(behind.cars[0]?.distM).toBeCloseTo(-10, 6)
  })
})

describe('computeRadar: unknown track length', () => {
  const session = makeSession({ trackLengthM: null })

  it('CarLeft: one phantom on lane -1', () => {
    const data = radar({ clr: CarLeftRight.CarLeft, cars: [{ idx: 1, distM: 1 }] }, { session })
    expect(data.visible).toBe(true)
    expect(data.trackLengthKnown).toBe(false)
    expect(data.leftCount).toBe(1)
    expect(data.cars).toEqual([
      {
        carIdx: -1,
        distM: 0,
        lane: -1,
        overlapping: true,
        proximity: 1,
        color: proximityColor(1),
        classColor: '#ffffff'
      }
    ])
  })

  it('Cars2Right and CarLeftRight: phantoms in every demanded lane', () => {
    const two = radar({ clr: CarLeftRight.Cars2Right }, { session })
    expect(two.cars.map((c) => c.lane)).toEqual([1, 2])
    const both = radar({ clr: CarLeftRight.CarLeftRight }, { session })
    expect(both.cars.map((c) => c.lane)).toEqual([-1, 1])
  })

  it('Clear: not visible even with a car nearby', () => {
    const data = radar({ clr: CarLeftRight.Clear, cars: [{ idx: 1, distM: 3 }] }, { session })
    expect(data.visible).toBe(false)
    expect(data.cars).toEqual([])
    expect(data.trackLengthKnown).toBe(false)
  })
})

describe('computeRadar: hidden', () => {
  const cars = [{ idx: 1, distM: 1 }]

  it('player not on track', () => {
    const data = radar({ onTrack: false, clr: CarLeftRight.CarLeft, cars })
    expectHidden(data, CarLeftRight.CarLeft)
    expect(data.trackLengthKnown).toBe(true)
    expect(data.rangeM).toBe(20)
  })

  it('CarLeftRight Off', () => {
    expectHidden(radar({ clr: CarLeftRight.Off, cars }), CarLeftRight.Off)
  })

  it('focus car not in world or with an invalid pct', () => {
    expectHidden(radar({ clr: CarLeftRight.CarLeft, playerPct: -1, cars }), CarLeftRight.CarLeft)
    expectHidden(
      radar({ clr: CarLeftRight.CarLeft, playerSurface: TrackLocation.NotInWorld, cars }),
      CarLeftRight.CarLeft
    )
  })

  it('reports trackLengthKnown false when hidden without a track length', () => {
    const data = radar({ onTrack: false }, { session: makeSession({ trackLengthM: null }) })
    expect(data.trackLengthKnown).toBe(false)
  })
})

describe('computeRadar: focus car', () => {
  it('falls back to session.playerCarIdx when PlayerCarIdx is invalid', () => {
    const data = computeRadar(
      { ...makeFrame({ playerCarIdx: 5, cars: [{ idx: 1, distM: 10 }] }), PlayerCarIdx: [-1] },
      makeSession({ playerCarIdx: 5 }),
      radarOpts(20),
      null
    )
    expect(data.cars.map((c) => c.carIdx)).toEqual([1])
  })

  it('prefers telemetry PlayerCarIdx over session.playerCarIdx', () => {
    const data = radar(
      { playerCarIdx: 3, cars: [{ idx: 1, distM: 10 }] },
      { session: makeSession({ playerCarIdx: 1 }) }
    )
    expect(data.cars.map((c) => c.carIdx)).toEqual([1])
  })

  it('ignores a PlayerCarIdx without a driver entry, like the other widgets', () => {
    // Car 12 has no DriverEntry: the radar must centre on DriverInfo's car 5 instead.
    const frame = makeFrame({ playerCarIdx: 5, cars: [{ idx: 1, distM: 10 }] })
    const data = computeRadar(
      { ...frame, PlayerCarIdx: [12] },
      makeSession({ playerCarIdx: 5 }),
      radarOpts(20),
      null
    )
    expect(data.visible).toBe(true)
    expect(data.cars.map((c) => c.carIdx)).toEqual([1])
  })

  it('hidden when neither index is valid', () => {
    const data = computeRadar(
      { ...makeFrame({ cars: [{ idx: 1, distM: 10 }] }), PlayerCarIdx: [70] },
      makeSession({ playerCarIdx: -1 }),
      radarOpts(20),
      null
    )
    expect(data.visible).toBe(false)
  })
})

describe('computeRadar: exclusions', () => {
  it('skips pace car, spectators, cars not in world, unknown drivers and other pit state', () => {
    const session = makeSession({
      paceCarIdx: 7,
      drivers: [
        driver(0),
        driver(1, { isPaceCar: true }),
        driver(2, { isSpectator: true }),
        driver(3),
        driver(4),
        driver(5),
        driver(7),
        driver(8)
      ]
    })
    const data = radar(
      {
        clr: CarLeftRight.CarLeft,
        cars: [
          { idx: 1, distM: 1 },
          { idx: 2, distM: 1.5 },
          { idx: 3, distM: 2, surface: TrackLocation.NotInWorld },
          { idx: 4, pct: -1 },
          { idx: 5, distM: 2.5, onPitRoad: true },
          { idx: 6, distM: 3 },
          { idx: 7, distM: 3.5 },
          { idx: 8, distM: 12 }
        ]
      },
      { session }
    )
    expect(data.cars.map((c) => c.carIdx)).toEqual([-1, 8])
    expect(laneOf(data, -1)).toBe(-1)
    expect(laneOf(data, 8)).toBe(0)
  })

  it('pit-road cars are shown while the player is on pit road too', () => {
    const data = radar({
      playerOnPitRoad: true,
      cars: [
        { idx: 1, distM: 6, onPitRoad: true },
        { idx: 2, distM: 7 }
      ]
    })
    expect(data.cars.map((c) => c.carIdx)).toEqual([1])
  })

  it('cars in the pit stall or off track are not excluded by surface', () => {
    const data = radar({
      cars: [
        { idx: 1, distM: 6, surface: TrackLocation.OffTrack },
        { idx: 2, distM: -7, surface: TrackLocation.ApproachingPits }
      ]
    })
    expect(data.cars.map((c) => c.carIdx)).toEqual([1, 2])
  })
})

describe('proximityColor', () => {
  it('green when far, red when touching', () => {
    expect(proximityColor(0)).toBe('hsl(120 90% 55%)')
    expect(proximityColor(1)).toBe('hsl(0 90% 55%)')
    expect(proximityColor(0.5)).toBe('hsl(60 90% 55%)')
  })

  it('clamps out-of-range input', () => {
    expect(proximityColor(-3)).toBe(proximityColor(0))
    expect(proximityColor(7)).toBe(proximityColor(1))
    expect(proximityColor(Number.NaN)).toBe(proximityColor(0))
    expect(proximityColor(Number.POSITIVE_INFINITY)).toBe(proximityColor(1))
  })
})

describe('computeRadar: range', () => {
  const cars = [{ idx: 1, distM: 6 }]

  it('clamps rangeM to [minRangeM, maxRangeM]', () => {
    const zero = radar({ cars }, { rangeM: 0 })
    expect(zero.rangeM).toBe(RADAR.minRangeM)
    expect(zero.visible).toBe(false)
    expect(radar({ cars }, { rangeM: -10 }).rangeM).toBe(RADAR.minRangeM)
    const big = radar({ cars: [{ idx: 1, distM: 99 }] }, { rangeM: 1000 })
    expect(big.rangeM).toBe(RADAR.maxRangeM)
    expect(big.cars.map((c) => c.carIdx)).toEqual([1])
  })

  it('non-finite rangeM falls back to 20 m', () => {
    const nan = radar({ cars: [{ idx: 1, distM: 19 }] }, { rangeM: Number.NaN })
    expect(nan.rangeM).toBe(20)
    expect(nan.cars.map((c) => c.carIdx)).toEqual([1])
    expect(radar({ cars }, { rangeM: Number.POSITIVE_INFINITY }).rangeM).toBe(20)
  })
})

describe('computeRadar: visibility at the range edge', () => {
  const rangeM = 20
  /** ~50% opacity in the widget's fade band. */
  const enterM = rangeM * (1 - RADAR.edgeFadeFrac / 2)
  /** ~25% opacity. */
  const leaveM = rangeM * (1 - RADAR.edgeFadeFrac / 4)

  function at(distM: number, prev: RadarData | null): RadarData {
    return radar({ clr: CarLeftRight.Clear, cars: [{ idx: 1, distM }] }, { rangeM, prev })
  }

  it('fade band is the outer fifth of the range', () => {
    expect(RADAR.edgeFadeFrac).toBe(0.2)
    expect(enterM).toBeCloseTo(18, 9)
    expect(leaveM).toBeCloseTo(19, 9)
  })

  it('while hidden, a car shows the panel only once it is halfway through the fade band', () => {
    for (const sign of [1, -1]) {
      const faint = at(sign * (enterM + 0.1), null)
      expect(faint.visible).toBe(false)
      // Still sent, so the widget can fade it in.
      expect(faint.cars.map((c) => c.carIdx)).toEqual([1])
      expect(at(sign * (enterM - 0.1), null).visible).toBe(true)
    }
    const hiddenPrev = at(30, null)
    expect(hiddenPrev.visible).toBe(false)
    expect(at(enterM + 0.1, hiddenPrev).visible).toBe(false)
  })

  it('while shown, the panel hides only once the car is three quarters through the band', () => {
    const shown = at(10, null)
    expect(shown.visible).toBe(true)
    expect(at(leaveM - 0.1, shown).visible).toBe(true)
    expect(at(-(leaveM - 0.1), shown).visible).toBe(true)
    const gone = at(leaveM + 0.1, shown)
    expect(gone.visible).toBe(false)
    expect(gone.cars.map((c) => c.carIdx)).toEqual([1])
    expect(at(rangeM + 0.1, shown).cars).toEqual([])
  })

  it('does not blink while a car hovers around the range edge or a threshold', () => {
    const run = (dists: number[], start: RadarData | null): boolean[] => {
      let prev = start
      return dists.map((d) => {
        prev = at(d, prev)
        return prev.visible
      })
    }
    expect(run([19.7, 20.3, 19.7, 20.3, 19.7], null)).toEqual([false, false, false, false, false])
    const shown = at(10, null)
    expect(run([18.9, 18.2, 18.9, 18.2, 18.9], shown)).toEqual([true, true, true, true, true])
    // Drifting out, back in and out again: one hide and one show, no flicker in between.
    expect(run([17, 18.5, 18.9, 19.2, 18.5, 18.9, 18.2, 17.8, 18.8, 19.1], null)).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      true,
      true,
      false
    ])
  })

  it('cars alongside show the panel at any distance', () => {
    const data = radar(
      { clr: CarLeftRight.CarRight, cars: [{ idx: 1, distM: 7 }] },
      { rangeM: RADAR.minRangeM }
    )
    expect(laneOf(data, 1)).toBe(1)
    expect(data.visible).toBe(true)
  })
})
