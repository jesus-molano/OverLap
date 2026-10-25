import { describe, it, expect } from 'vitest'
import { SessionFlag } from '@shared/flags'
import { wrapPctDelta } from '@shared/lapDist'
import { CarLeftRight, TELEMETRY_VAR_NAMES, TrackLocation } from '@shared/telemetry'
import {
  MOCK_CAR_SLOTS,
  MOCK_RACE_LENGTH_S,
  MOCK_TRACK_LENGTH_M,
  MockRace,
  estCurve
} from './simulation'
import { at, raceDist, run } from './testUtils'
import { MOCK_WARNING } from './warnings'

const DT = 1 / 60
const L = MOCK_TRACK_LENGTH_M

interface Observations {
  states: Set<number>
  followClear: boolean
  pitRoad: boolean
  stall: boolean
  nearPitWithin60: boolean
  maxInPits: number
  lapAhead: boolean
  lapBehind: boolean
  badPct: number
  badEst: number
  badNotInWorld: number
  badLaps: number
  maxStepM: number
  badClassPos: number
}

let cached: Observations | null = null

/** One 150 s run shared by the dynamics tests. */
function observe(): Observations {
  if (cached) return cached
  const race = new MockRace()
  const info = race.sessionInfo()
  const est = new Map(info.DriverInfo.Drivers.map((d) => [d.CarIdx, d.CarClassEstLapTime]))
  const classOf = new Map(info.DriverInfo.Drivers.map((d) => [d.CarIdx, d.CarClassID]))
  const raceCars = info.DriverInfo.Drivers.filter((d) => !d.CarIsPaceCar && !d.IsSpectator)
  const o: Observations = {
    states: new Set(),
    followClear: false,
    pitRoad: false,
    stall: false,
    nearPitWithin60: false,
    maxInPits: 0,
    lapAhead: false,
    lapBehind: false,
    badPct: 0,
    badEst: 0,
    badNotInWorld: 0,
    badLaps: 0,
    maxStepM: 0,
    badClassPos: 0
  }
  let prev = race.frame()
  run(race, 150, DT, (f, t) => {
    const clr = at(f.CarLeftRight, 0)
    o.states.add(clr)
    const me = at(f.PlayerCarIdx, 0)
    const myPct = at(f.CarIdxLapDistPct, me)
    const myDist = raceDist(f, me)
    let inPits = 0
    const positions = new Map<number, number[]>()
    for (const d of raceCars) {
      const i = d.CarIdx
      const pct = at(f.CarIdxLapDistPct, i)
      const prevPct = at(prev.CarIdxLapDistPct, i)
      const laps = at(f.CarIdxLapCompleted, i)
      const prevLaps = at(prev.CarIdxLapCompleted, i)
      const onPit = at(f.CarIdxOnPitRoad, i)
      const surface = at(f.CarIdxTrackSurface, i)
      if (!(pct >= 0 && pct < 1)) o.badPct++
      const e = at(f.CarIdxEstTime, i)
      if (!(e >= 0 && e <= (est.get(i) ?? 0))) o.badEst++
      // Lap count only moves when pct wraps, and by exactly one.
      const wrapped = prevPct > 0.9 && pct < 0.1
      if (laps !== prevLaps + (wrapped ? 1 : 0)) o.badLaps++
      o.maxStepM = Math.max(o.maxStepM, Math.abs(wrapPctDelta(pct, prevPct)) * L)
      if (onPit) inPits++
      if (onPit && surface === TrackLocation.ApproachingPits) o.pitRoad = true
      if (onPit && surface === TrackLocation.InPitStall) o.stall = true
      const cls = classOf.get(i) ?? -1
      const list = positions.get(cls) ?? []
      list.push(at(f.CarIdxClassPosition, i))
      positions.set(cls, list)
      if (i === me) continue
      const gapM = wrapPctDelta(pct, myPct) * L
      if (clr === CarLeftRight.Clear && !onPit && gapM <= -5 && gapM >= -15) o.followClear = true
      if (t <= 60 && onPit && Math.abs(gapM) < 250) o.nearPitWithin60 = true
      const diff = laps + pct - myDist
      if (diff >= 1) o.lapAhead = true
      if (diff <= -1) o.lapBehind = true
    }
    o.maxInPits = Math.max(o.maxInPits, inPits)
    for (const list of positions.values()) {
      const sorted = [...list].sort((a, b) => a - b)
      if (sorted.some((p, k) => p !== k + 1)) o.badClassPos++
    }
    for (const idx of [0, 63]) {
      if (at(f.CarIdxLapDistPct, idx) !== -1) o.badNotInWorld++
      if (at(f.CarIdxTrackSurface, idx) !== TrackLocation.NotInWorld) o.badNotInWorld++
      if (at(f.CarIdxLapCompleted, idx) !== -1) o.badNotInWorld++
      if (at(f.CarIdxEstTime, idx) !== 0) o.badNotInWorld++
    }
    prev = f
  })
  cached = o
  return o
}

describe('MockRace frame', () => {
  it('has every telemetry var, per-car arrays of 72 (like current builds) and scalars of 1', () => {
    const f = new MockRace().frame()
    expect(MOCK_CAR_SLOTS).toBe(72)
    expect(Object.keys(f).sort()).toEqual([...TELEMETRY_VAR_NAMES].sort())
    for (const name of TELEMETRY_VAR_NAMES) {
      expect(f[name].length, name).toBe(name.startsWith('CarIdx') ? MOCK_CAR_SLOTS : 1)
    }
    expect(at(f.SessionNum, 0)).toBe(0)
    expect(at(f.SessionState, 0)).toBe(4)
    expect(at(f.PlayerCarIdx, 0)).toBe(7)
    expect(at(f.IsOnTrack, 0)).toBe(true)
    // On track, no limiter, no flag for the player.
    expect(at(f.OnPitRoad, 0)).toBe(false)
    expect(at(f.EngineWarnings, 0)).toBe(0)
    expect(at(f.CarIdxSessionFlags, 7)).toBe(0)
  })

  it('returns fresh arrays each call', () => {
    const race = new MockRace()
    const a = race.frame()
    race.step(1)
    expect(race.frame().CarIdxLapDistPct).not.toBe(a.CarIdxLapDistPct)
    expect(race.frame().CarIdxLapDistPct).not.toEqual(a.CarIdxLapDistPct)
  })

  it('advances SessionTime by dt and ignores non-positive steps', () => {
    const race = new MockRace()
    const t0 = race.sessionTime
    race.step(0.5)
    race.step(0.25)
    race.step(0)
    race.step(-1)
    race.step(Number.NaN)
    expect(race.sessionTime).toBeCloseTo(t0 + 0.75, 9)
    expect(at(race.frame().SessionTime, 0)).toBeCloseTo(t0 + 0.75, 9)
  })
})

describe('MockRace determinism', () => {
  it('produces identical frames for the same seed', () => {
    const a = new MockRace({ seed: 42 })
    const b = new MockRace({ seed: 42 })
    for (let k = 0; k < 5; k++) {
      run(a, 10, DT)
      run(b, 10, DT)
      expect(a.frame()).toEqual(b.frame())
    }
  })

  it('differs for another seed', () => {
    const a = new MockRace({ seed: 1 })
    const b = new MockRace({ seed: 2 })
    run(a, 10, DT)
    run(b, 10, DT)
    expect(a.frame()).not.toEqual(b.frame())
  })

  it('accepts any race car as the player, LMP2 included', () => {
    for (const playerCarIdx of [1, 12, 13, 20]) {
      const race = new MockRace({ playerCarIdx })
      run(race, 20, DT)
      const f = race.frame()
      expect(at(f.PlayerCarIdx, 0)).toBe(playerCarIdx)
      expect(race.sessionInfo().DriverInfo.DriverCarIdx).toBe(playerCarIdx)
      for (let i = 1; i <= 20; i++) expect(at(f.CarIdxLapDistPct, i)).toBeGreaterThanOrEqual(0)
    }
  })

  it('rejects a player that is not a race car', () => {
    expect(() => new MockRace({ playerCarIdx: 0 })).toThrow()
    expect(() => new MockRace({ playerCarIdx: 63 })).toThrow()
  })

  it('seats the default player in its car of later sessions', () => {
    const race = new MockRace({ sessionIndex: 1 })
    expect(race.playerCarIdx).toBe(14)
    const me = race.sessionInfo().DriverInfo.Drivers.find((d) => d.CarIdx === 14)
    expect(me?.UserName).toBe('Alejandro Ruiz')
  })
})

describe('MockRace dynamics over 150 s', () => {
  it('goes through every CarLeftRight state', () => {
    const { states } = observe()
    for (const s of [
      CarLeftRight.Clear,
      CarLeftRight.CarLeft,
      CarLeftRight.CarRight,
      CarLeftRight.CarLeftRight,
      CarLeftRight.Cars2Left,
      CarLeftRight.Cars2Right
    ]) {
      expect(states.has(s), CarLeftRight[s]).toBe(true)
    }
    expect(states.has(CarLeftRight.Off)).toBe(false)
  })

  it('has a car following 5-15 m behind with Clear', () => {
    expect(observe().followClear).toBe(true)
  })

  it('has cars on pit road and in the stall, at most 2 at once', () => {
    const o = observe()
    expect(o.pitRoad).toBe(true)
    expect(o.stall).toBe(true)
    expect(o.nearPitWithin60).toBe(true)
    expect(o.maxInPits).toBeLessThanOrEqual(2)
  })

  it('has cars a lap up and a lap down on the player', () => {
    const o = observe()
    expect(o.lapAhead).toBe(true)
    expect(o.lapBehind).toBe(true)
  })

  it('keeps pct, est time, lap counts and class positions consistent', () => {
    const o = observe()
    expect(o.badPct).toBe(0)
    expect(o.badEst).toBe(0)
    expect(o.badLaps).toBe(0)
    expect(o.badClassPos).toBe(0)
    // No teleports: at most ~65 m/s along the track.
    expect(o.maxStepM).toBeLessThan(1.2)
  })

  it('keeps the pace car and the spectator out of the world', () => {
    expect(observe().badNotInWorld).toBe(0)
  })
})

// --- timed race: timing, flags, battles ----------------------------------------

const LONG_DT = 1 / 20
const LONG_S = 900

/** Least-squares slope of y over x. */
function slope(points: readonly (readonly [x: number, y: number])[]): number {
  const n = points.length
  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0
  for (const [x, y] of points) {
    sx += x
    sy += y
    sxx += x * x
    sxy += x * y
  }
  return (n * sxy - sx * sy) / (n * sxx - sx * sx)
}

interface TimedLap {
  carIdx: number
  time: number
  /** SessionTime at the end of the lap. */
  endS: number
  /** On pit road at some point of the lap (in-lap, out-lap). */
  pit: boolean
}

interface LongRun {
  race: MockRace
  t0: number
  playerIdx: number
  classOf: ReadonlyMap<number, number>
  estOf: ReadonlyMap<number, number>
  /** Per car: SessionTime at each tenth-of-a-lap line (key = race distance x 10), interpolated. */
  lines: Map<number, Map<number, number>>
  laps: TimedLap[]
  /** Last lap time changed without crossing the S/F line. */
  badLastChange: number
  /** Best above last, or best got worse. */
  badBest: number
  /** CarIdxClassPosition not the order by race distance within the class. */
  badClassOrder: number
  /** First and last SessionTime offset (s since start) each flag value was seen, per car. */
  flags: Map<number, { flag: number; from: number; to: number }[]>
  meatballOnPitWhileFlagged: boolean
  incidents: { t: number; n: number }[]
  playerOffTrack: number[]
  remain: number[]
  sessionFlags: Set<number>
  battleOnPit: number
  maxBattleLapGap: number
  /** Ticks (first 300 s) where the class neighbours on track were not the battle cars. */
  badNeighbours: number
  /** Seconds since the start of each tick with the blue flag (0x20) on the player. */
  blueTicks: number[]
  /** Ticks with the blue flag on any other car. */
  blueOthers: number
  /** Blue ticks without a car lapping the player within ~3 s behind it. */
  badBlue: number
  /** Ticks with a lapping car well within 3 s behind the player on track but no blue flag. */
  missedBlue: number
}

let longCache: LongRun | null = null

/** One 15 min run (20 Hz) shared by the timing, flag and battle tests. */
function longRun(): LongRun {
  if (longCache) return longCache
  const race = new MockRace()
  const info = race.sessionInfo()
  const racers = info.DriverInfo.Drivers.filter((d) => !d.CarIsPaceCar && !d.IsSpectator)
  const ids = racers.map((d) => d.CarIdx)
  const classOf = new Map(racers.map((d) => [d.CarIdx, d.CarClassID]))
  const estOf = new Map(racers.map((d) => [d.CarIdx, d.CarClassEstLapTime]))
  const playerIdx = info.DriverInfo.DriverCarIdx
  const myClass = classOf.get(playerIdx)
  const { battleAhead, battleBehind, meatball } = race.cast
  let prev = race.frame()
  const t0 = at(prev.SessionTime, 0)
  const r: LongRun = {
    race,
    t0,
    playerIdx,
    classOf,
    estOf,
    lines: new Map(ids.map((i) => [i, new Map<number, number>()])),
    laps: [],
    badLastChange: 0,
    badBest: 0,
    badClassOrder: 0,
    flags: new Map(),
    meatballOnPitWhileFlagged: false,
    incidents: [],
    playerOffTrack: [],
    remain: [at(prev.SessionTimeRemain, 0)],
    sessionFlags: new Set(),
    battleOnPit: 0,
    maxBattleLapGap: 0,
    badNeighbours: 0,
    blueTicks: [],
    blueOthers: 0,
    badBlue: 0,
    missedBlue: 0
  }
  const pitThisLap = new Map(ids.map((i) => [i, false]))
  run(race, LONG_S, LONG_DT, (f) => {
    const now = at(f.SessionTime, 0)
    const t = now - t0
    for (const i of ids) {
      const d = raceDist(f, i)
      const d0 = raceDist(prev, i)
      const lines = r.lines.get(i)
      for (let k = Math.floor(d0 * 10) + 1; k <= Math.floor(d * 10); k++) {
        lines?.set(k, now - (LONG_DT * (d - k / 10)) / (d - d0))
      }
      const onPit = at(f.CarIdxOnPitRoad, i)
      const crossed = at(f.CarIdxLapCompleted, i) !== at(prev.CarIdxLapCompleted, i)
      const last = at(f.CarIdxLastLapTime, i)
      const best = at(f.CarIdxBestLapTime, i)
      if (!crossed && last !== at(prev.CarIdxLastLapTime, i)) r.badLastChange++
      if (crossed) {
        r.laps.push({ carIdx: i, time: last, endS: now, pit: pitThisLap.get(i) === true || onPit })
        pitThisLap.set(i, onPit)
      } else if (onPit) {
        pitThisLap.set(i, true)
      }
      if (best > last + 1e-9 || best > at(prev.CarIdxBestLapTime, i) + 1e-9) r.badBest++

      // Penalties here; the player's blue flag is checked on its own below.
      const allFlags = at(f.CarIdxSessionFlags, i)
      if (allFlags & SessionFlag.Blue && i !== playerIdx) r.blueOthers++
      const flag = allFlags & ~SessionFlag.Blue
      if (flag !== 0) {
        const list = r.flags.get(i) ?? []
        const lastSpan = list.at(-1)
        if (lastSpan && lastSpan.flag === flag && t - lastSpan.to < LONG_DT * 1.5) lastSpan.to = t
        else list.push({ flag, from: t, to: t })
        r.flags.set(i, list)
        if (i === meatball && onPit) r.meatballOnPitWhileFlagged = true
      }
    }

    const byDist = [...ids].sort((a, b) => raceDist(f, b) - raceDist(f, a))
    for (const cls of new Set(classOf.values())) {
      byDist
        .filter((i) => classOf.get(i) === cls)
        .forEach((i, k) => {
          if (at(f.CarIdxClassPosition, i) !== k + 1) r.badClassOrder++
        })
    }

    const n = at(f.PlayerCarMyIncidentCount, 0)
    if (n !== r.incidents.at(-1)?.n) r.incidents.push({ t, n })
    if (at(f.PlayerTrackSurface, 0) === TrackLocation.OffTrack) r.playerOffTrack.push(t)
    r.remain.push(at(f.SessionTimeRemain, 0))
    r.sessionFlags.add(at(f.SessionFlags, 0))

    const myDist = raceDist(f, playerIdx)
    // Blue: a car a lap or more up (race distance), behind on the road, within ~3 s at its pace.
    let lappingS = Infinity
    for (const i of ids) {
      if (i === playerIdx || at(f.CarIdxOnPitRoad, i)) continue
      if (raceDist(f, i) - myDist < 0.5) continue
      // Moving at racing speed (a car stopped behind you laps nobody).
      const est = estOf.get(i) ?? 0
      if ((raceDist(f, i) - raceDist(prev, i)) * est < 0.9 * LONG_DT) continue
      const behind = wrapPctDelta(at(f.CarIdxLapDistPct, playerIdx), at(f.CarIdxLapDistPct, i))
      if (behind > 0) lappingS = Math.min(lappingS, behind * est)
    }
    const blue = (at(f.CarIdxSessionFlags, playerIdx) & SessionFlag.Blue) !== 0
    if (blue) r.blueTicks.push(t)
    // Est lap +-3 % against the car's own pace.
    if (blue && !(lappingS <= 3 * 1.03)) r.badBlue++
    if (!blue && lappingS < 3 * 0.97) r.missedBlue++
    for (const b of [battleAhead, battleBehind]) {
      if (at(f.CarIdxOnPitRoad, b)) r.battleOnPit++
      r.maxBattleLapGap = Math.max(r.maxBattleLapGap, Math.abs(raceDist(f, b) - myDist))
    }
    if (t <= 300) {
      const mates = byDist.filter((i) => classOf.get(i) === myClass && !at(f.CarIdxOnPitRoad, i))
      const k = mates.indexOf(playerIdx)
      if (mates[k - 1] !== battleAhead || mates[k + 1] !== battleBehind) r.badNeighbours++
    }
    prev = f
  })
  longCache = r
  return r
}

/** Gaps (s) at each tenth-of-a-lap line both cars crossed: [player laps since start, gap]. */
function lineGaps(r: LongRun, ahead: number, behind: number, maxT: number): [number, number][] {
  const a = r.lines.get(ahead)
  const b = r.lines.get(behind)
  const mine = r.lines.get(r.playerIdx)
  const first = Math.min(...(mine?.keys() ?? []))
  const t0 = mine?.get(first) ?? 0
  const out: [number, number][] = []
  for (const [k, tb] of b ?? []) {
    const ta = a?.get(k)
    const tp = mine?.get(k)
    if (ta === undefined || tp === undefined || tp - t0 > maxT) continue
    out.push([(k - first) / 10, tb - ta])
  }
  return out
}

describe('MockRace timed race', () => {
  const race = new MockRace()
  const info = race.sessionInfo()
  const f = race.frame()
  const racers = info.DriverInfo.Drivers.filter((d) => !d.CarIsPaceCar && !d.IsSpectator)

  it('is a timed race with ~40 min left, consistent with the laps already run', () => {
    expect(at(f.SessionLapsRemainEx, 0)).toBe(32767)
    const remain = at(f.SessionTimeRemain, 0)
    expect(remain).toBeGreaterThan(38 * 60)
    expect(remain).toBeLessThan(42 * 60)
    // ~15 laps of ~139 s already run.
    const me = info.DriverInfo.DriverCarIdx
    const driven = raceDist(f, me) * info.DriverInfo.DriverCarEstLapTime
    expect(Math.abs(MOCK_RACE_LENGTH_S - remain - driven)).toBeLessThan(150)
    expect(at(f.SessionTime, 0)).toBeGreaterThan(MOCK_RACE_LENGTH_S - remain)
    const later = new MockRace()
    later.step(2.5)
    expect(at(later.frame().SessionTimeRemain, 0)).toBeCloseTo(remain - 2.5, 9)
    expect(at(f.SessionFlags, 0)).toBe(0)
  })

  it('reports lap times and flags for race cars only', () => {
    for (const d of racers) {
      const i = d.CarIdx
      expect(at(f.CarIdxLastLapTime, i)).toBeGreaterThan(0)
      expect(at(f.CarIdxBestLapTime, i)).toBeLessThanOrEqual(at(f.CarIdxLastLapTime, i))
      expect(at(f.CarIdxClassPosition, i)).toBeGreaterThan(0)
      expect(at(f.CarIdxClass, i)).toBe(d.CarClassID)
      expect(at(f.CarIdxSessionFlags, i)).toBe(0)
    }
    for (const idx of [0, 63]) {
      expect(at(f.CarIdxLastLapTime, idx)).toBe(-1)
      expect(at(f.CarIdxBestLapTime, idx)).toBe(-1)
      expect(at(f.CarIdxClassPosition, idx)).toBe(0)
    }
    expect(at(f.PlayerTrackSurface, 0)).toBe(TrackLocation.OnTrack)
    expect(at(f.PlayerCarMyIncidentCount, 0)).toBe(0)
  })

  it('casts escorts from the other class and battle cars from the player class', () => {
    const { cast } = race
    const classOf = new Map(racers.map((d) => [d.CarIdx, d.CarClassID]))
    const mine = classOf.get(info.DriverInfo.DriverCarIdx)
    for (const e of cast.escorts) expect(classOf.get(e)).not.toBe(mine)
    for (const b of [cast.battleAhead, cast.battleBehind, cast.pitter, cast.meatball]) {
      expect(classOf.get(b)).toBe(mine)
      expect(cast.escorts).not.toContain(b)
    }
    expect(classOf.get(cast.blackFlag)).not.toBe(mine)
    const all = [...cast.escorts, cast.battleAhead, cast.battleBehind, cast.pitter, cast.meatball]
    expect(new Set([...all, cast.blackFlag]).size).toBe(7)
  })
})

describe(`MockRace over ${LONG_S / 60} min`, () => {
  it('times every lap at the S/F line with plausible times', () => {
    const r = longRun()
    expect(r.badLastChange).toBe(0)
    expect(r.badBest).toBe(0)
    expect(r.laps.length).toBeGreaterThan(100)
    const escorts = new Set(r.race.cast.escorts)
    const mine = r.laps.filter((l) => l.carIdx === r.playerIdx).map((l) => l.time)
    expect(mine.length).toBeGreaterThanOrEqual(6)
    for (const t of mine) {
      expect(t).toBeGreaterThan(137)
      expect(t).toBeLessThan(141)
    }
    // Lap times vary lap to lap, like a human.
    expect(Math.max(...mine) - Math.min(...mine)).toBeGreaterThan(0.1)
    // The car stopped on track (from 640 s) loses its lap.
    const stops = r.race.log.filter((e) => e.kind === 'hazard')
    expect(stops).toHaveLength(1)
    const stopped = (lap: TimedLap): boolean =>
      stops.some(
        (e) =>
          e.carIdx === lap.carIdx &&
          lap.endS >= r.t0 + e.atS &&
          lap.endS - lap.time <= r.t0 + e.atS + 40
      )
    for (const lap of r.laps) {
      const ref = escorts.has(lap.carIdx)
        ? (r.estOf.get(r.playerIdx) ?? 0) * 1.005
        : (r.estOf.get(lap.carIdx) ?? 0)
      const ratio = lap.time / ref
      if (lap.pit || stopped(lap)) {
        expect(ratio, `pit or stop lap of ${lap.carIdx}`).toBeGreaterThan(1.03)
      } else {
        expect(ratio, `lap of ${lap.carIdx}`).toBeGreaterThan(0.96)
        expect(ratio, `lap of ${lap.carIdx}`).toBeLessThan(escorts.has(lap.carIdx) ? 1.03 : 1.045)
      }
    }
    expect(r.laps.some((l) => l.pit)).toBe(true)
    expect(r.laps.some(stopped)).toBe(true)
  })

  it('keeps CarIdxClassPosition in the race order', () => {
    expect(longRun().badClassOrder).toBe(0)
  })

  it('counts down the race clock, with no session flag before the hazards', () => {
    const { remain, sessionFlags } = longRun()
    expect(at(remain, 0) - (remain.at(-1) ?? 0)).toBeCloseTo(LONG_S, 6)
    expect(remain.every((v, k) => k === 0 || v < at(remain, k - 1))).toBe(true)
    expect([...sessionFlags]).toEqual([0])
    expect(SessionFlag.Caution).toBe(0x4000)
  })

  it('adds player incidents with a moment off track', () => {
    const r = longRun()
    // The 2x one is an off-track upgraded to a loss of control a moment later (playerIncidents.ts).
    expect(r.incidents.map((e) => e.n)).toEqual([0, 1, 2, 3])
    expect(at(r.incidents, 1).t).toBeCloseTo(90, 0)
    expect(at(r.incidents, 2).t).toBeCloseTo(300, 0)
    expect(at(r.incidents, 3).t - at(r.incidents, 2).t).toBeCloseTo(0.8, 1)
    expect(r.playerOffTrack.length).toBeGreaterThan(0)
    for (const t of r.playerOffTrack) {
      expect((t >= 90 && t <= 91.3) || (t >= 300 && t <= 302.3), `off track at ${t}`).toBe(true)
    }
  })

  it('shows a meatball until the car pits for repairs, then a black flag', () => {
    const r = longRun()
    const { meatball, blackFlag } = r.race.cast
    const repair = r.flags.get(meatball) ?? []
    expect(repair).toHaveLength(1)
    expect(at(repair, 0).flag).toBe(SessionFlag.Repair)
    expect(at(repair, 0).from).toBeCloseTo(28, 0)
    expect(at(repair, 0).to - at(repair, 0).from).toBeGreaterThan(60)
    expect(r.meatballOnPitWhileFlagged).toBe(true)
    const black = r.flags.get(blackFlag) ?? []
    expect(black).toHaveLength(1)
    expect(at(black, 0).flag).toBe(SessionFlag.Black)
    expect(at(black, 0).from).toBeCloseTo(420, 0)
    // Served (drive-through) within about a lap.
    expect(at(black, 0).to).toBeLessThan(LONG_S - 1)
    // And the battle car ahead's warning (warnings.test.ts): nobody else is flagged.
    const { battleAhead } = r.race.cast
    expect([...r.flags.keys()].sort()).toEqual([meatball, blackFlag, battleAhead].sort())
    const warning = r.flags.get(battleAhead) ?? []
    expect(warning.map((s) => s.flag)).toEqual([SessionFlag.Furled])
    expect(at(warning, 0).from).toBeCloseTo(MOCK_WARNING.atS, 0)
    expect(at(warning, 0).to - at(warning, 0).from).toBeCloseTo(MOCK_WARNING.forS, 0)
  })

  it('shows the blue flag on the player only while a car lapping it is within ~3 s behind', () => {
    const r = longRun()
    expect(r.blueOthers).toBe(0)
    expect(r.badBlue).toBe(0)
    expect(r.missedBlue).toBe(0)
    const spans: [number, number][] = []
    for (const t of r.blueTicks) {
      const last = spans.at(-1)
      if (last && t - last[1] < LONG_DT * 1.5) last[1] = t
      else spans.push([t, t])
    }
    // The LMP2s lap the GT3 player a few times in 15 min, ~30 s of blue each (~0.1 s/s closing).
    expect(spans.length).toBeGreaterThanOrEqual(3)
    for (const [from, to] of spans) {
      expect(to - from, `blue at ${from}`).toBeGreaterThan(10)
      expect(to - from, `blue at ${from}`).toBeLessThan(60)
    }
    // Never for the radar escorts or the battle cars: they run on the player's lap.
    expect(r.blueTicks.length * LONG_DT).toBeLessThan(LONG_S / 4)
  })

  it('keeps the battle cars on the player lap, off pit road and as class neighbours', () => {
    const r = longRun()
    expect(r.battleOnPit).toBe(0)
    expect(r.maxBattleLapGap).toBeLessThan(0.02)
    expect(r.badNeighbours).toBe(0)
  })

  it('closes the gap to the car ahead (~0.15 s/lap) and lets the car behind close in (~0.1 s/lap)', () => {
    const r = longRun()
    const { battleAhead, battleBehind } = r.race.cast
    const ahead = lineGaps(r, battleAhead, r.playerIdx, 300)
    const behind = lineGaps(r, r.playerIdx, battleBehind, 300)
    expect(ahead.length).toBeGreaterThan(15)
    expect(behind.length).toBeGreaterThan(15)
    for (const [, g] of ahead) {
      expect(g).toBeGreaterThan(0.4)
      expect(g).toBeLessThan(0.9)
    }
    for (const [, g] of behind) {
      expect(g).toBeGreaterThan(0.85)
      expect(g).toBeLessThan(1.3)
    }
    // The player gains on the car ahead, the car behind gains on the player.
    expect(slope(ahead)).toBeLessThan(-0.1)
    expect(slope(ahead)).toBeGreaterThan(-0.2)
    expect(slope(behind)).toBeLessThan(-0.06)
    expect(slope(behind)).toBeGreaterThan(-0.14)
    // Later on the battle stays within the widget's 1.5 s threshold.
    for (const [, g] of lineGaps(r, battleAhead, r.playerIdx, LONG_S)) {
      expect(g).toBeGreaterThan(0.3)
      expect(g).toBeLessThan(0.9)
    }
    for (const [, g] of lineGaps(r, r.playerIdx, battleBehind, LONG_S)) {
      expect(g).toBeGreaterThan(0.45)
      expect(g).toBeLessThan(1.3)
    }
  })
})

describe('estCurve', () => {
  it('is monotonic from 0 to 1', () => {
    expect(estCurve(0)).toBe(0)
    expect(estCurve(1)).toBeCloseTo(1, 12)
    let last = -1
    for (let p = 0; p <= 1; p += 0.001) {
      expect(estCurve(p)).toBeGreaterThan(last)
      last = estCurve(p)
    }
  })
})
