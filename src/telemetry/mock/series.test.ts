/**
 * A whole mock session and the start of the next one, at 20 Hz, through the
 * real RaceModel: the scenarios of the second half (hazards, off-track,
 * caution, the player's pit stop), the finish, the cool-down and the restart.
 */
import { describe, it, expect } from 'vitest'
import { personalBestKey } from '@shared/delta/references'
import { SessionFlag } from '@shared/flags'
import { wrapPctDelta } from '@shared/lapDist'
import { RaceModel } from '@shared/race/raceModel'
import { parseSessionMeta } from '@shared/session'
import { SessionState, TrackLocation } from '@shared/telemetry'
import type { TelemetryFrame } from '@shared/telemetry'
import type { SessionMeta } from '@shared/types'
import {
  ENGINE_PIT_LIMITER,
  LIMITER_LATE_S,
  PIT_OVERSPEED_KMH,
  PIT_SPEED_MS,
  PLAYER_STALL_S
} from './pitLane'
import {
  MOCK_PIT_SPEED_LIMIT_KMH,
  MOCK_SUBSESSION_ID,
  MOCK_TIMELINE,
  MOCK_TRACK_LENGTH_M,
  MockSeries
} from './simulation'
import type { MockEvent, MockRace } from './simulation'
import { at, raceDist } from './testUtils'

const DT = 1 / 20
/** MockSource's longest step, for the runs that only read the log. */
const COARSE_DT = 0.1
const L = MOCK_TRACK_LENGTH_M
/** Seconds of the second session to run. */
const NEXT_S = 60

interface Tick {
  session: number
  /** Seconds since its session started. */
  t: number
  f: TelemetryFrame
  engineWarnings: number
}

/** A lap of the player as the RaceModel timed it (its final, refined snapshot). */
interface PlayerLap {
  session: number
  lap: number
  lapTime: number
  clean: boolean
}

interface FullRun {
  ticks: Tick[]
  playerLaps: PlayerLap[]
  /** personalBestKey of the player, per session. */
  bestKeys: (string | null)[]
  first: MockRace
  second: MockRace
  /** RaceModel after the last tick of the first session. */
  finishedAtEnd: number[]
  lapsRemainingAtEnd: (number | null)[]
  keys: string[]
  versions: number[]
  racers: number[]
}

let cache: FullRun | null = null

function fullRun(): FullRun {
  if (cache) return cache
  const series = new MockSeries()
  const first = series.current
  const model = new RaceModel()
  let version = series.sessionInfoVersion
  let meta: SessionMeta = parseSessionMeta(series.sessionInfo())
  const racers = [...meta.drivers.values()]
    .filter((d) => !d.isPaceCar && !d.isSpectator)
    .map((d) => d.carIdx)
  const ticks: Tick[] = []
  const playerLaps: PlayerLap[] = []
  const bestKeys = [personalBestKey(meta, series.current.playerCarIdx)]
  const keys: string[] = []
  const versions = [version]
  let finishedAtEnd: number[] = []
  let lapsRemainingAtEnd: (number | null)[] = []
  let start = series.sessionTime
  let nextStartedAt = -1
  for (let k = 0; k < 4000 / DT; k++) {
    const before = series.current
    series.step(DT)
    if (series.current !== before) {
      // Last state of the first session, before the new one reaches the model.
      finishedAtEnd = racers.filter((i) => model.view.car(i)?.finished === true)
      lapsRemainingAtEnd = racers.map((i) => model.view.lapsRemaining(i))
      start = series.sessionTime
      nextStartedAt = k
    }
    if (series.sessionInfoVersion !== version) {
      version = series.sessionInfoVersion
      versions.push(version)
      meta = parseSessionMeta(series.sessionInfo())
      bestKeys.push(personalBestKey(meta, series.current.playerCarIdx))
    }
    const f = series.frame()
    model.update(f, meta)
    const view = model.view.lapProfile(model.view.playerCarIdx, 'last')
    if (view) {
      const lap = {
        session: series.sessionIndex,
        lap: view.lap,
        lapTime: view.lapTime,
        clean: view.clean
      }
      const prev = playerLaps.at(-1)
      if (prev && prev.session === lap.session && prev.lap === lap.lap) Object.assign(prev, lap)
      else playerLaps.push(lap)
    }
    if (keys.at(-1) !== model.view.sessionKey) keys.push(model.view.sessionKey)
    ticks.push({
      session: series.sessionIndex,
      t: series.sessionTime - start,
      f,
      engineWarnings: series.current.engineWarnings
    })
    if (nextStartedAt >= 0 && k - nextStartedAt >= NEXT_S / DT) break
  }
  cache = {
    ticks,
    playerLaps,
    bestKeys,
    first,
    second: series.current,
    finishedAtEnd,
    lapsRemainingAtEnd,
    keys,
    versions,
    racers
  }
  return cache
}

const firstSession = (): Tick[] => fullRun().ticks.filter((x) => x.session === 0)
const events = (kind: MockEvent['kind']): MockEvent[] =>
  fullRun().first.log.filter((e) => e.kind === kind)
/** Contiguous [from, to] spans (session seconds) of the ticks where `pred` holds. */
function spans(ticks: readonly Tick[], pred: (x: Tick) => boolean): [number, number][] {
  const out: [number, number][] = []
  for (const x of ticks) {
    const last = out.at(-1)
    if (!pred(x)) continue
    if (last && x.t - last[1] < DT * 1.5) last[1] = x.t
    else out.push([x.t, x.t])
  }
  return out
}
const player = (x: Tick): number => at(x.f.PlayerCarIdx, 0)
/** Metres `i` is ahead of the player on track (negative = behind). */
const aheadM = (x: Tick, i: number): number =>
  wrapPctDelta(at(x.f.CarIdxLapDistPct, i), at(x.f.CarIdxLapDistPct, player(x))) * L

describe('MockSeries: one whole session', () => {
  it('runs Racing, Checkered, CoolDown, then a new session in Racing', () => {
    const r = fullRun()
    const states = r.ticks
      .map((x) => `${x.session}:${at(x.f.SessionState, 0)}`)
      .filter((s, k, all) => k === 0 || s !== all[k - 1])
    expect(states).toEqual([
      `0:${SessionState.Racing}`,
      `0:${SessionState.Checkered}`,
      `0:${SessionState.CoolDown}`,
      `1:${SessionState.Racing}`
    ])
    const coolDown = spans(firstSession(), (x) => at(x.f.SessionState, 0) === SessionState.CoolDown)
    expect(coolDown).toHaveLength(1)
    expect(at(coolDown, 0)[1] - at(coolDown, 0)[0]).toBeCloseTo(60, 0)
    // The first test pays for simulating the whole session (cached for the rest): ~3-5 s on
    // its own, more while the full suite runs in parallel.
  }, 30_000)

  it('shows the chequered flag at the overall leader first crossing with the clock at 0', () => {
    const ticks = firstSession()
    const k = ticks.findIndex((x) => at(x.f.SessionState, 0) === SessionState.Checkered)
    const flag = at(ticks, k)
    const prev = at(ticks, k - 1)
    expect(at(flag.f.SessionTimeRemain, 0)).toBe(0)
    expect(at(flag.f.SessionFlags, 0) & SessionFlag.Checkered).toBe(SessionFlag.Checkered)
    const { racers } = fullRun()
    const leader = racers.reduce((a, b) => (raceDist(prev.f, b) > raceDist(prev.f, a) ? b : a))
    expect(at(flag.f.CarIdxLapCompleted, leader)).toBe(at(prev.f.CarIdxLapCompleted, leader) + 1)
    // The leader's previous crossing came before the clock ran out.
    const crossings = ticks.filter(
      (x, j) =>
        j > 0 &&
        at(x.f.CarIdxLapCompleted, leader) !== at(at(ticks, j - 1).f.CarIdxLapCompleted, leader)
    )
    const before = crossings.filter((x) => x.t < flag.t).at(-1)
    expect(before && at(before.f.SessionTimeRemain, 0)).toBeGreaterThan(0)
    // White flag from the leader's last crossing before the end until the chequered flag.
    const white = spans(ticks, (x) => (at(x.f.SessionFlags, 0) & SessionFlag.White) !== 0)
    expect(white).toHaveLength(1)
    expect(at(white, 0)[0]).toBeCloseTo(before?.t ?? 0, 1)
    expect(at(white, 0)[1]).toBeCloseTo(prev.t, 6)
    expect(events('checkered').map((e) => e.carIdx)).toEqual([leader])
  })

  it('finishes every car at its next crossing, as the RaceModel sees it', () => {
    const r = fullRun()
    expect(events('finish')).toHaveLength(r.racers.length)
    expect(new Set(events('finish').map((e) => e.carIdx))).toEqual(new Set(r.racers))
    expect([...r.finishedAtEnd].sort((a, b) => a - b)).toEqual(r.racers)
    expect(r.lapsRemainingAtEnd.every((n) => n === 0)).toBe(true)
    const flagAt = at(events('checkered'), 0).atS
    for (const e of events('finish')) {
      expect(e.atS).toBeGreaterThanOrEqual(flagAt)
      expect(e.atS - flagAt).toBeLessThan(200)
    }
  })

  it('freezes the class positions of finishers, also once they leave the car', () => {
    const ticks = firstSession()
    for (const e of events('finish')) {
      const after = ticks.filter((x) => x.t >= e.atS + DT)
      const pos = at(at(after, 0).f.CarIdxClassPosition, e.carIdx)
      for (const x of after) expect(at(x.f.CarIdxClassPosition, e.carIdx)).toBe(pos)
    }
    // The winner, every fifth finisher and the ones that pit on the cool-down lap leave.
    const left = events('left-world')
    expect(left.length).toBeGreaterThanOrEqual(4)
    expect(at(left, 0).carIdx).toBe(at(events('checkered'), 0).carIdx)
    for (const e of left) {
      for (const x of ticks.filter((y) => y.t >= e.atS + DT)) {
        expect(at(x.f.CarIdxTrackSurface, e.carIdx)).toBe(TrackLocation.NotInWorld)
        expect(at(x.f.CarIdxLapDistPct, e.carIdx)).toBe(-1)
        expect(at(x.f.CarIdxOnPitRoad, e.carIdx)).toBe(false)
      }
    }
    expect(left.map((e) => e.carIdx)).not.toContain(player(at(ticks, 0)))
  })

  it('starts the next session: new SubSessionID, info version, seats, clock back at 40 min', () => {
    const r = fullRun()
    expect(r.versions).toEqual([1, 2])
    expect(r.second.sessionInfo().WeekendInfo.SubSessionID).toBe(MOCK_SUBSESSION_ID + 1)
    // The RaceModel starts over on the new session.
    expect(r.keys).toHaveLength(2)
    const next = r.ticks.filter((x) => x.session === 1)
    const f0 = at(next, 0).f
    const lastOfFirst = at(firstSession(), firstSession().length - 1).f
    expect(at(f0.SessionTime, 0)).toBeLessThan(at(lastOfFirst.SessionTime, 0))
    expect(at(f0.SessionTimeRemain, 0)).toBeGreaterThan(39 * 60)
    expect(at(f0.SessionFlags, 0)).toBe(0)
    // Same driver, another CarIdx.
    expect(at(f0.PlayerCarIdx, 0)).toBe(14)
    expect(r.second.sessionInfo().DriverInfo.Drivers.find((d) => d.CarIdx === 14)?.UserName).toBe(
      'Alejandro Ruiz'
    )
    for (const i of r.racers)
      expect(at(f0.CarIdxTrackSurface, i)).not.toBe(TrackLocation.NotInWorld)
  })

  it('keeps every car consistent: pct, lap counts, no teleports', () => {
    const { ticks, racers } = fullRun()
    let bad = 0
    let maxStepM = 0
    for (let k = 1; k < ticks.length; k++) {
      const x = at(ticks, k)
      const p = at(ticks, k - 1)
      if (x.session !== p.session) continue
      for (const i of racers) {
        const pct = at(x.f.CarIdxLapDistPct, i)
        const prevPct = at(p.f.CarIdxLapDistPct, i)
        if (at(x.f.CarIdxTrackSurface, i) === TrackLocation.NotInWorld) {
          if (pct !== -1) bad++
          continue
        }
        if (!(pct >= 0 && pct < 1)) bad++
        const wrapped = prevPct > 0.9 && pct < 0.1
        const laps = at(x.f.CarIdxLapCompleted, i)
        if (laps !== at(p.f.CarIdxLapCompleted, i) + (wrapped ? 1 : 0)) bad++
        maxStepM = Math.max(maxStepM, Math.abs(wrapPctDelta(pct, prevPct)) * L)
        if (pct < prevPct && !wrapped) bad++
      }
    }
    expect(bad).toBe(0)
    // ~72 m/s at most.
    expect(maxStepM).toBeLessThan(3.7)
  })
})

describe('MockSeries: laps of the player for the delta widget', () => {
  const clean = (): PlayerLap[] => fullRun().playerLaps.filter((l) => l.session === 0 && l.clean)

  it('keys the personal best by car model and layout, the same car every session', () => {
    expect(fullRun().bestKeys).toEqual(['67@9001/Gran Premio', '67@9001/Gran Premio'])
  })

  it('has plenty of clean laps a little apart, slower ones under caution, pit stop and offs', () => {
    const laps = fullRun().playerLaps.filter((l) => l.session === 0)
    const times = clean().map((l) => l.lapTime)
    expect(times.length).toBeGreaterThanOrEqual(10)
    const spread = Math.max(...times) - Math.min(...times)
    expect(spread).toBeGreaterThan(0.4)
    expect(spread).toBeLessThan(2.5)
    for (const t of times) expect(t).toBeCloseTo(138, -1)
    expect(laps.filter((l) => !l.clean).length).toBeGreaterThanOrEqual(3)
  })

  it('beats its own best now and then during the session, not on every lap', () => {
    let best = Infinity
    let beaten = 0
    for (const l of clean()) {
      if (l.lapTime < best && best !== Infinity) beaten++
      best = Math.min(best, l.lapTime)
    }
    expect(beaten).toBeGreaterThanOrEqual(3)
    expect(beaten).toBeLessThan(clean().length - 1)
    // The last laps are the quickest part of the stint: rubber down, fuel burnt off.
    const times = clean().map((l) => l.lapTime)
    const half = Math.floor(times.length / 2)
    const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length
    expect(mean(times.slice(half))).toBeLessThan(mean(times.slice(0, half)))
  })
})

describe('MockSeries: scenarios of the first session', () => {
  it('stops a car on track ahead of the player twice; the player goes by while it waits', () => {
    const ticks = firstSession()
    const stops = events('hazard')
    expect(stops.map((e) => e.atS >= at(MOCK_TIMELINE.hazardStopsS, 0))).toEqual([true, true])
    expect(at(stops, 1).atS).toBeGreaterThanOrEqual(at(MOCK_TIMELINE.hazardStopsS, 1))
    for (const e of stops) {
      const i = e.carIdx
      const atStart = ticks.find((x) => x.t >= e.atS)
      expect(atStart && aheadM(atStart, i)).toBeGreaterThanOrEqual(250)
      expect(atStart && aheadM(atStart, i)).toBeLessThan(L / 2)
      const window = ticks.filter((x) => x.t >= e.atS && x.t <= e.atS + 40)
      const unmoved = window.filter(
        (x, k) =>
          k > 0 && at(x.f.CarIdxLapDistPct, i) === at(at(window, k - 1).f.CarIdxLapDistPct, i)
      )
      const still = spans(unmoved, () => true)
      expect(still).toHaveLength(1)
      const [from, to] = at(still, 0)
      expect(to - from).toBeGreaterThanOrEqual(9.5)
      expect(to - from).toBeLessThanOrEqual(40.5)
      const stopped = window.filter((x) => x.t >= from && x.t <= to)
      for (const x of stopped) expect(at(x.f.CarIdxTrackSurface, i)).toBe(TrackLocation.OnTrack)
      // In the hazard window (1-8 s ahead) at some point, then behind the player.
      expect(stopped.some((x) => aheadM(x, i) > 50 && aheadM(x, i) < 400)).toBe(true)
      expect(aheadM(at(stopped, stopped.length - 1), i)).toBeLessThan(0)
      // Within 8 s at the player's pace (the traffic widget's default hazard window) for a while.
      const myLapS = at(at(stopped, 0).f.CarIdxLastLapTime, player(at(stopped, 0)))
      const within8 = stopped.filter((x) => {
        const s = (aheadM(x, i) / L) * myLapS
        return s > 0 && s <= 8
      })
      expect(within8.length * DT).toBeGreaterThan(5)
    }
    expect(events('hazard-end')).toHaveLength(2)
  })

  it('sends a car off the track ahead of the player for ~3 s', () => {
    const ticks = firstSession()
    const offs = events('off-track').filter((e) => e.atS >= at(MOCK_TIMELINE.offTracksS, 0))
    expect(offs).toHaveLength(1)
    const e = at(offs, 0)
    const atStart = ticks.find((x) => x.t >= e.atS)
    expect(atStart && aheadM(atStart, e.carIdx)).toBeGreaterThanOrEqual(100)
    expect(atStart && aheadM(atStart, e.carIdx)).toBeLessThan(L / 2)
    const off = spans(
      ticks.filter((x) => x.t >= e.atS - 1 && x.t < e.atS + 30),
      (x) => at(x.f.CarIdxTrackSurface, e.carIdx) === TrackLocation.OffTrack
    )
    expect(off).toHaveLength(1)
    expect(at(off, 0)[1] - at(off, 0)[0]).toBeCloseTo(3, 0)
  })

  it('throws one short caution', () => {
    const caution = spans(
      firstSession(),
      (x) => (at(x.f.SessionFlags, 0) & SessionFlag.Caution) !== 0
    )
    expect(caution).toHaveLength(1)
    expect(at(caution, 0)[0]).toBeCloseTo(MOCK_TIMELINE.cautionS, 0)
    expect(at(caution, 0)[1] - at(caution, 0)[0]).toBeCloseTo(MOCK_TIMELINE.cautionLengthS, 0)
  })

  it('pits the player once: pit road, box, limiter and clutch consistent', () => {
    const ticks = firstSession()
    const me = (x: Tick): number => player(x)
    const onPit = spans(ticks, (x) => at(x.f.CarIdxOnPitRoad, me(x)))
    expect(onPit).toHaveLength(1)
    const [from, to] = at(onPit, 0)
    expect(from).toBeGreaterThanOrEqual(MOCK_TIMELINE.playerPitS)
    // ~700 m of pit lane at 60 km/h plus the box.
    expect(to - from).toBeGreaterThan(PLAYER_STALL_S + 30)
    expect(to - from).toBeLessThan(PLAYER_STALL_S + 55)
    for (const x of ticks) {
      const surface = at(x.f.CarIdxTrackSurface, me(x))
      expect(at(x.f.PlayerTrackSurface, 0)).toBe(surface)
      const pit = at(x.f.CarIdxOnPitRoad, me(x))
      // The player's own OnPitRoad and EngineWarnings, in the frame.
      expect(at(x.f.OnPitRoad, 0)).toBe(pit)
      expect(at(x.f.EngineWarnings, 0)).toBe(x.engineWarnings)
      // The limiter goes on LIMITER_LATE_S after the entry line, off at the exit line.
      const late = pit && x.t - from < LIMITER_LATE_S - DT / 2
      expect(x.engineWarnings & ENGINE_PIT_LIMITER).toBe(pit && !late ? ENGINE_PIT_LIMITER : 0)
      if (pit) {
        expect([TrackLocation.ApproachingPits, TrackLocation.InPitStall]).toContain(surface)
        const kmh = at(x.f.Speed, 0) * 3.6
        // Over the limit only in the late-limiter moment, by a few km/h.
        if (x.t - from > LIMITER_LATE_S + 3)
          expect(at(x.f.Speed, 0)).toBeLessThanOrEqual(PIT_SPEED_MS + 1e-9)
        else expect(kmh).toBeLessThanOrEqual(MOCK_PIT_SPEED_LIMIT_KMH + PIT_OVERSPEED_KMH + 1e-6)
      } else {
        expect(surface).not.toBe(TrackLocation.InPitStall)
      }
    }
    // OFF, then on but over the limit, then on (what the alerts widget shows).
    const states = ticks
      .filter((x) => at(x.f.OnPitRoad, 0))
      .map((x) => {
        if ((x.engineWarnings & ENGINE_PIT_LIMITER) === 0) return 'off'
        return at(x.f.Speed, 0) * 3.6 > MOCK_PIT_SPEED_LIMIT_KMH + 1 ? 'speeding' : 'on'
      })
    expect(states.filter((s, k) => k === 0 || s !== states[k - 1])).toEqual([
      'off',
      'speeding',
      'on'
    ])
    const stall = spans(
      ticks,
      (x) => at(x.f.CarIdxTrackSurface, me(x)) === TrackLocation.InPitStall
    )
    expect(stall).toHaveLength(1)
    expect(at(stall, 0)[1] - at(stall, 0)[0]).toBeCloseTo(PLAYER_STALL_S, 0)
    const inStall = ticks.filter((x) => x.t >= at(stall, 0)[0] && x.t <= at(stall, 0)[1])
    for (const x of inStall) expect(at(x.f.Speed, 0)).toBe(0)
    // Pulling away: clutch pressed in first gear.
    const launch = ticks.find((x) => x.t > at(stall, 0)[1])
    expect(launch && at(launch.f.Clutch, 0)).toBeLessThan(0.1)
    expect(launch && at(launch.f.Gear, 0)).toBe(1)
    expect(events('pit-in')).toHaveLength(1)
    expect(events('pit-out')).toHaveLength(1)
    // The radar stays quiet on pit road.
    for (const x of ticks.filter((y) => at(y.f.CarIdxOnPitRoad, me(y)))) {
      expect(at(x.f.CarLeftRight, 0)).toBe(1)
    }
  })

  it('never has more than three cars on pit road while racing (two plus the player)', () => {
    const { racers } = fullRun()
    for (const x of firstSession()) {
      if (at(x.f.SessionState, 0) !== SessionState.Racing) continue
      expect(racers.filter((i) => at(x.f.CarIdxOnPitRoad, i)).length).toBeLessThanOrEqual(3)
    }
  })
})

/** An on-road pass between the player and car `carIdx` (session seconds). */
interface Pass {
  t: number
  carIdx: number
  /** Race-distance laps the car is up (+) or down (-) on the player at the pass. */
  laps: number
}

/**
 * Passes in session 0 while racing: `car passes player` (from behind to ahead within
 * 50 m) when `byCar`, else the player passing it. Pit road and the player's stop excluded.
 */
function passes(byCar: boolean, keep: (carIdx: number) => boolean): Pass[] {
  const { racers } = fullRun()
  const ticks = firstSession()
  const out: Pass[] = []
  for (let k = 1; k < ticks.length; k++) {
    const x = at(ticks, k)
    const p = at(ticks, k - 1)
    if (at(x.f.SessionState, 0) !== SessionState.Racing || at(x.f.OnPitRoad, 0)) continue
    const me = player(x)
    for (const i of racers) {
      if (i === me || !keep(i) || at(x.f.CarIdxOnPitRoad, i)) continue
      const now = aheadM(x, i)
      const before = aheadM(p, i)
      if (Math.abs(now) > 50 || Math.abs(before) > 50) continue
      const crossed = byCar ? before < 0 && now >= 0 : before >= 0 && now < 0
      if (crossed) out.push({ t: x.t, carIdx: i, laps: raceDist(x.f, i) - raceDist(x.f, me) })
    }
  }
  return out
}

/** Median of the lap times (CarIdxLastLapTime at each S/F crossing) of `cars` in session 0. */
function medianLap(cars: readonly number[]): number {
  const ticks = firstSession()
  const laps: number[] = []
  for (let k = 1; k < ticks.length; k++) {
    const x = at(ticks, k)
    const p = at(ticks, k - 1)
    if (at(x.f.SessionState, 0) !== SessionState.Racing) continue
    for (const i of cars) {
      if (at(x.f.CarIdxLapCompleted, i) !== at(p.f.CarIdxLapCompleted, i)) {
        laps.push(at(x.f.CarIdxLastLapTime, i))
      }
    }
  }
  laps.sort((a, b) => a - b)
  return laps[Math.floor(laps.length / 2)] ?? Number.NaN
}

describe('MockSeries: traffic and flags for the traffic and alerts widgets', () => {
  const meta = parseSessionMeta(new MockSeries().sessionInfo())
  const me = meta.playerCarIdx
  const classOf = (i: number): number => meta.drivers.get(i)?.classId ?? -1
  const myClass = classOf(me)
  const escorts = new Set<number>(new MockSeries().current.cast.escorts)

  it('has the LMP2s lapping the GT3 player regularly, ~8-11 % quicker', () => {
    const lmp2 = fullRun().racers.filter((i) => classOf(i) !== myClass && !escorts.has(i))
    const ratio = medianLap(lmp2) / medianLap([me])
    expect(ratio).toBeGreaterThan(0.89)
    expect(ratio).toBeLessThan(0.93)
    const laps = passes(true, (i) => classOf(i) !== myClass && !escorts.has(i))
    // Every pass is a car lapping the player (a lap or more up), at the closing rate above.
    for (const p of laps) expect(p.laps, `t=${p.t} #${p.carIdx}`).toBeGreaterThan(0.5)
    expect(laps.length).toBeGreaterThanOrEqual(6)
    // Never ten minutes without one (the player's own stop aside).
    const times = [0, ...laps.map((p) => p.t)]
    for (let k = 1; k < times.length; k++) {
      expect(at(times, k) - at(times, k - 1), `after t=${at(times, k - 1)}`).toBeLessThan(600)
    }
  })

  it('has the player catching slow backmarkers of its own class', () => {
    const caught = passes(false, (i) => classOf(i) === myClass)
    const lapped = caught.filter((p) => p.laps < -0.5)
    expect(lapped.length).toBeGreaterThanOrEqual(2)
    const backmarkers = [...new Set(lapped.map((p) => p.carIdx))]
    // Over 2 % slower than the player: the traffic widget's margin within a class.
    expect(medianLap(backmarkers) / medianLap([me])).toBeGreaterThan(1.025)
    // The first one within ~6 min, the next one well before the player's stop.
    expect(at(lapped, 0).t).toBeLessThan(360)
    expect(at(lapped, 1).t).toBeLessThan(MOCK_TIMELINE.playerPitS)
  })

  it('shows the blue flag on the player only, while racing on track, a few times a session', () => {
    const ticks = firstSession()
    const blue = spans(
      ticks,
      (x) => (at(x.f.CarIdxSessionFlags, player(x)) & SessionFlag.Blue) !== 0
    )
    expect(blue.length).toBeGreaterThanOrEqual(5)
    for (const x of ticks) {
      const flags = at(x.f.CarIdxSessionFlags, player(x))
      if (!(flags & SessionFlag.Blue)) continue
      expect(at(x.f.OnPitRoad, 0)).toBe(false)
      expect(at(x.f.SessionState, 0)).toBe(SessionState.Racing)
    }
    for (const i of fullRun().racers) {
      if (i === me) continue
      expect(ticks.every((x) => (at(x.f.CarIdxSessionFlags, i) & SessionFlag.Blue) === 0)).toBe(
        true
      )
    }
  })

  it('waves the green flag for a few seconds when the caution ends, and only then', () => {
    const green = spans(firstSession(), (x) => (at(x.f.SessionFlags, 0) & SessionFlag.Green) !== 0)
    expect(green).toHaveLength(1)
    const [from, to] = at(green, 0)
    const end = MOCK_TIMELINE.cautionS + MOCK_TIMELINE.cautionLengthS
    expect(from).toBeCloseTo(end, 0)
    expect(to - from).toBeGreaterThan(4)
    expect(to - from).toBeLessThan(6)
    for (const x of firstSession()) {
      const flags = at(x.f.SessionFlags, 0)
      if (flags & SessionFlag.Green) expect(flags & SessionFlag.Caution).toBe(0)
    }
  })

  it('writes the 60 km/h pit speed limit into the session YAML', () => {
    const info = fullRun().first.sessionInfo()
    expect(info.WeekendInfo.TrackPitSpeedLimit).toBe('60.00 kph')
    expect(meta.pitSpeedLimitKmh).toBe(MOCK_PIT_SPEED_LIMIT_KMH)
  })

  it('starts no pit stop in the last five minutes of the clock', () => {
    const { racers } = fullRun()
    const ticks = firstSession()
    for (let k = 1; k < ticks.length; k++) {
      const x = at(ticks, k)
      const p = at(ticks, k - 1)
      if (at(x.f.SessionState, 0) !== SessionState.Racing) continue
      if (at(x.f.SessionTimeRemain, 0) > 300) continue
      for (const i of racers) {
        expect(at(x.f.CarIdxOnPitRoad, i) && !at(p.f.CarIdxOnPitRoad, i), `#${i}`).toBe(false)
      }
    }
  })
})

describe('MockSeries: other seeds and players', () => {
  for (const opts of [{ seed: 2 }, { seed: 3 }, { seed: 4, playerCarIdx: 13 }]) {
    it(`plays every scenario and restarts (${JSON.stringify(opts)})`, () => {
      const series = new MockSeries(opts)
      const first = series.current
      for (let k = 0; k < 4000 / COARSE_DT && series.sessionIndex === 0; k++) series.step(COARSE_DT)
      expect(series.sessionIndex).toBe(1)
      const kinds = first.log.map((e) => e.kind)
      const count = (kind: MockEvent['kind']): number => kinds.filter((k) => k === kind).length
      expect(count('hazard')).toBe(2)
      expect(count('off-track')).toBe(2)
      expect(count('caution')).toBe(1)
      expect(count('pit-in')).toBe(1)
      expect(count('pit-out')).toBe(1)
      expect(count('white-flag')).toBe(1)
      expect(count('checkered')).toBe(1)
      expect(count('finish')).toBe(20)
      expect(count('session-end')).toBe(1)
      expect(series.sessionInfoVersion).toBe(2)
    })
  }

  it('is deterministic over a whole session', () => {
    const a = new MockSeries({ seed: 9 })
    const b = new MockSeries({ seed: 9 })
    for (let k = 1; k <= 2900 / COARSE_DT; k++) {
      a.step(COARSE_DT)
      b.step(COARSE_DT)
      if (k % 2000 === 0) expect(a.frame()).toEqual(b.frame())
    }
    expect(a.sessionIndex).toBe(1)
    expect(a.current.log).toEqual(b.current.log)
  })

  it('keeps going session after session: new ids and seats, the same player, whole races', () => {
    const series = new MockSeries()
    const seen: { sub: number; player: string; finishes: number; ended: boolean }[] = []
    let race = series.current
    for (let k = 0; k < (6 * 2800) / COARSE_DT && seen.length < 5; k++) {
      series.step(COARSE_DT)
      if (series.current === race) continue
      const info = race.sessionInfo()
      seen.push({
        sub: info.WeekendInfo.SubSessionID,
        player:
          info.DriverInfo.Drivers.find((d) => d.CarIdx === info.DriverInfo.DriverCarIdx)
            ?.UserName ?? '',
        finishes: race.log.filter((e) => e.kind === 'finish').length,
        ended: race.done
      })
      race = series.current
    }
    expect(seen.map((s) => s.sub - MOCK_SUBSESSION_ID)).toEqual([0, 1, 2, 3, 4])
    expect(new Set(seen.map((s) => s.player))).toEqual(new Set(['Alejandro Ruiz']))
    expect(seen.every((s) => s.finishes === 20 && s.ended)).toBe(true)
    expect(series.sessionInfoVersion).toBe(6)
  })
})
