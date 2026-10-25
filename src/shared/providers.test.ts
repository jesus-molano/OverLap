/**
 * The providers together on the real RaceModel (race/testing/raceSim.ts): what the standings
 * and the battle widget agree on, what they show around the chequered flag, the traffic and
 * alerts providers on the model's pace and speed, and the delta on its lap profiles.
 */
import { describe, expect, it } from 'vitest'
import { DELTA } from './delta/delta'
import { createMemoryStore, personalBestKey } from './delta/references'
import type { PersonalBestStore } from './delta/references'
import { SKIP_EMIT, createProviders } from './providers'
import type { ProviderContext, ProviderSet } from './providers'
import { PRACTICE, Sim, V, makeDriver, makeSession } from './race/testing/raceSim'
import type { Cars } from './race/testing/raceSim'
import { createDefaultSettings, toTelemetryConfig } from './settings'
import { SessionFlag } from './flags'
import { SessionState } from './telemetry'
import type {
  AlertsData,
  BattleData,
  DeltaData,
  DeltaOptions,
  DeltaReference,
  SessionMeta,
  StandingsData,
  TelemetryConfig,
  TrafficData,
  TrafficEntry
} from './types'

function config(): TelemetryConfig {
  const c = toTelemetryConfig(createDefaultSettings())
  return { ...c, battle: { ...c.battle, holdS: 0 } }
}

function ctxOf(
  sim: Sim,
  session: SessionMeta,
  cfg: TelemetryConfig,
  bests: PersonalBestStore = createMemoryStore()
): ProviderContext {
  return { frame: sim.frame, session, config: cfg, race: sim.view, bests }
}

function standings(p: ProviderSet, ctx: ProviderContext): StandingsData {
  return p.run.standings(ctx, null)
}

function row(
  data: StandingsData,
  carIdx: number
): StandingsData['classes'][number]['rows'][number] {
  const r = data.classes.flatMap((b) => b.rows).find((x) => x.carIdx === carIdx)
  if (!r) throw new Error(`no row for car ${carIdx}`)
  return r
}

const seconds = (g: { kind: string; seconds?: number } | null): number | null =>
  g?.kind === 'time' ? (g.seconds ?? null) : null

/** Car 1 leads the player (0) by 0.6 s, car 2 trails it by 0.6 s; lap 30 s. */
function racing(t: number): Cars {
  const d = 1 + V * t
  return { 0: { d }, 1: { d: d + 0.02 }, 2: { d: d - 0.02 } }
}

describe('standings and battle share one iRating field', () => {
  it('a registered non-starter counts the same in both: the battle stake is your perPosition', () => {
    // Four starters and a registered driver who never joined.
    const drivers = [0, 1, 2, 3].map((i) => makeDriver(i, { iRating: 1500 + 100 * i }))
    const session = makeSession(4, {}, [...drivers, makeDriver(4, { iRating: 2500 })])
    const sim = new Sim(session)
    sim.run(70, 60, (t) => ({ ...racing(t), 3: { d: 1 + V * t - 0.3 } }))
    const p = createProviders()
    const ctx = ctxOf(sim, session, config())
    const ir = standings(p, ctx).header.iRating
    const b = p.run.battle(ctx, null)
    // 198 / 4 starters: the non-starter shares the field but not the positions.
    expect(ir?.perPosition).toBe(49.5)
    expect(b.ahead?.iRatingAtStake).toBe(Math.round(198 / 4))
    expect(b.behind?.iRatingAtStake).toBe(Math.round(198 / 4))
    // The player's row and the header agree, and so does a second run (cached).
    expect(row(standings(p, ctx), 0).iRatingDelta).toBe(ir?.iRatingDelta)
  })
})

describe('around the chequered flag (real RaceModel)', () => {
  const session = makeSession(3)

  it('freezes the finishing gaps, marks finishers and hides the battle once you have finished', () => {
    const sim = new Sim(session)
    const p = createProviders()
    const cfg = config()
    sim.run(70, 60, racing)
    const ctx = ctxOf(sim, session, cfg)
    let battle: BattleData = p.run.battle(ctx, null)
    expect(battle.visible).toBe(true)
    expect(battle.ahead?.carIdx).toBe(1)
    expect(battle.behind?.carIdx).toBe(2)

    // Flag mid-lap; the leader, then you, then car 2 cross the line.
    sim.state = SessionState.Checkered
    sim.runUntil(() => sim.view.car(1)?.finished === true, racing)
    // The leader finished, you have not: nothing ahead to fight for, the car behind still counts.
    battle = p.run.battle(ctx, battle)
    expect(battle.ahead).toBeNull()
    expect(battle.behind?.carIdx).toBe(2)
    sim.runUntil(() => sim.view.car(2)?.finished === true, racing)
    expect(sim.view.car(0)?.finished).toBe(true)
    battle = p.run.battle(ctx, battle)
    expect(battle).toMatchObject({ visible: false, ahead: null, behind: null, lapsRemaining: 0 })

    const atFlag = standings(p, ctx)
    expect(atFlag.classes[0]?.rows.map((r) => r.status)).toEqual([
      'finished',
      'finished',
      'finished'
    ])
    expect(seconds(row(atFlag, 0).interval)).toBeCloseTo(0.6, 1)
    expect(seconds(row(atFlag, 2).gapToLeader)).toBeCloseTo(1.2, 1)
    expect(atFlag.header.lapsRemaining).toBe(0)

    // Cool-down at different paces, the winner parks and leaves the world.
    sim.state = SessionState.CoolDown
    const t0 = sim.t
    const from = (i: number): number => sim.view.car(i)?.distance ?? NaN
    const d0 = [from(0), from(1), from(2)] as const
    const coolDown = (t: number): Cars => {
      const since = t - t0
      return {
        0: { d: d0[0] + since * (V / 2) },
        1: since > 20 ? null : { d: d0[1] + since * (V / 5) },
        2: { d: d0[2] + since * (V / 1.5) }
      }
    }
    for (let k = 0; k < 4; k++) {
      sim.run(10, 60, coolDown)
      const after = standings(p, ctx)
      expect(seconds(row(after, 0).interval), `t=${sim.t}`).toBe(seconds(row(atFlag, 0).interval))
      expect(seconds(row(after, 2).gapToLeader)).toBe(seconds(row(atFlag, 2).gapToLeader))
      expect(row(after, 1).status).toBe('finished')
      expect(p.run.battle(ctx, battle).visible).toBe(false)
    }
  })
})

describe('SKIP_EMIT', () => {
  const hidden: BattleData = {
    visible: false,
    lapsRemaining: 10,
    playerLastLaps: [90],
    ahead: null,
    behind: null
  }

  it('battle: one hidden payload is sent, the following hidden ones are not', () => {
    const skip = SKIP_EMIT.battle
    if (!skip) throw new Error('no battle rule')
    expect(skip(hidden, null)).toBe(false)
    expect(skip({ ...hidden, lapsRemaining: 9, playerLastLaps: [91] }, hidden)).toBe(true)
    expect(skip(hidden, { ...hidden, visible: true })).toBe(false)
    expect(skip({ ...hidden }, hidden)).toBe(true)
  })

  it('relative: an empty table (player out of the car) is sent once, not at 10 Hz', () => {
    const skip = SKIP_EMIT.relative
    if (!skip) throw new Error('no relative rule')
    const empty = { rows: [], playerRow: -1, slotsAhead: 3, slotsBehind: 3, sessionType: 'Race' }
    expect(skip(empty, null)).toBe(false)
    expect(skip({ ...empty }, empty)).toBe(true)
    // Anything the empty table draws differently is sent.
    expect(skip({ ...empty, slotsAhead: 4 }, empty)).toBe(false)
    expect(skip({ ...empty, sessionType: 'Practice' }, empty)).toBe(false)
    // A live table is always sent.
    expect(skip({ ...empty, playerRow: 0 }, empty)).toBe(false)
  })

  const entry: TrafficEntry = {
    driver: {
      carIdx: 1,
      carNumber: '2',
      driverName: 'Piloto 1',
      classColor: '#33ceff',
      iRating: 1500,
      licString: 'B 3.00',
      licColor: null
    },
    kind: 'faster',
    className: 'LMP2',
    gapS: -3.2,
    etaS: 41.5,
    meetPct: 0.62,
    meetSector: 2,
    lapping: false,
    hazard: null
  }
  const noTraffic: TrafficData = { visible: false, faster: [], slower: [], hazards: [] }
  const traffic: TrafficData = { visible: true, faster: [entry], slower: [], hazards: [] }

  it('traffic: nothing around is sent once; an unchanged list is not re-sent', () => {
    const skip = SKIP_EMIT.traffic
    if (!skip) throw new Error('no traffic rule')
    expect(skip(noTraffic, null)).toBe(false)
    expect(skip({ ...noTraffic, faster: [] }, noTraffic)).toBe(true)
    expect(skip(noTraffic, traffic)).toBe(false)
    expect(skip(traffic, noTraffic)).toBe(false)
    expect(skip(traffic, null)).toBe(false)
    expect(skip(structuredClone(traffic), traffic)).toBe(true)
    // Any drawn change is sent: the ETA ticking down, a new hazard...
    expect(skip({ ...traffic, faster: [{ ...entry, etaS: 41.4 }] }, traffic)).toBe(false)
    const hazard: TrafficEntry = { ...entry, kind: 'hazard', hazard: 'stopped', gapS: 3 }
    expect(skip({ ...traffic, hazards: [hazard] }, traffic)).toBe(false)
  })

  it('alerts: an unchanged banner (or none) is not re-sent at 10 Hz', () => {
    const skip = SKIP_EMIT.alerts
    if (!skip) throw new Error('no alerts rule')
    const idle: AlertsData = {
      visible: false,
      flags: [],
      notices: [],
      pitLimiter: null,
      speedKmh: 0,
      pitLimitKmh: 60
    }
    const pit: AlertsData = { ...idle, visible: true, pitLimiter: 'on', speedKmh: 58 }
    expect(skip(idle, null)).toBe(false)
    expect(skip({ ...idle, flags: [] }, idle)).toBe(true)
    expect(skip(pit, idle)).toBe(false)
    expect(skip({ ...pit, speedKmh: 59 }, pit)).toBe(false)
    expect(skip({ ...pit, pitLimiter: 'speeding' }, pit)).toBe(false)
    expect(skip({ ...pit, flags: ['blue'] }, pit)).toBe(false)
    expect(skip(structuredClone(pit), pit)).toBe(true)
    // A tow countdown is re-sent each second, not between.
    const tow: AlertsData = { ...pit, notices: [{ kind: 'tow', seconds: 42 }] }
    expect(skip(tow, pit)).toBe(false)
    expect(skip(structuredClone(tow), tow)).toBe(true)
    expect(skip({ ...tow, notices: [{ kind: 'tow', seconds: 41 }] }, tow)).toBe(false)
  })

  it('delta: hidden is sent once; an unchanged reading is not re-sent at 30 Hz', () => {
    const skip = SKIP_EMIT.delta
    if (!skip) throw new Error('no delta rule')
    const hidden: DeltaData = {
      visible: false,
      reference: 'pb',
      refDriver: '',
      refSelf: false,
      refLapTime: null,
      delta: null,
      trend: 0,
      predictedLap: null,
      sectors: [],
      lapValid: true
    }
    const live: DeltaData = {
      visible: true,
      reference: 'pb',
      refDriver: '',
      refSelf: false,
      refLapTime: 92.5,
      delta: -0.12,
      trend: -0.01,
      predictedLap: 92.38,
      sectors: [-0.05, null, null],
      lapValid: true
    }
    expect(skip(hidden, null)).toBe(false)
    expect(skip({ ...hidden }, hidden)).toBe(true)
    // Hidden is hidden, whatever else it says (e.g. another chosen reference).
    expect(skip({ ...hidden, reference: 'class' }, hidden)).toBe(true)
    expect(skip(live, hidden)).toBe(false)
    expect(skip(hidden, live)).toBe(false)
    expect(skip(live, null)).toBe(false)
    expect(skip(structuredClone(live), live)).toBe(true)
    // Any drawn change is sent.
    expect(skip({ ...live, delta: -0.13, predictedLap: 92.37 }, live)).toBe(false)
    expect(skip({ ...live, trend: 0 }, live)).toBe(false)
    expect(skip({ ...live, sectors: [-0.05, 0.1, null] }, live)).toBe(false)
    expect(skip({ ...live, lapValid: false }, live)).toBe(false)
    expect(skip({ ...live, reference: 'session' }, live)).toBe(false)
    expect(skip({ ...live, reference: 'class', refDriver: '#23 L. Costa' }, live)).toBe(false)
    expect(skip({ ...live, reference: 'class', refSelf: true }, live)).toBe(false)
  })

  it('a provider set resets both stateful providers', () => {
    const p = createProviders()
    const sim = new Sim(session3())
    sim.run(70, 60, racing)
    const ctx = ctxOf(sim, session3(), config())
    const first = p.run.standings(ctx, null)
    expect(p.run.standings(ctx, null).header.iRating).toBe(first.header.iRating)
    p.reset()
    const again = p.run.standings(ctx, null)
    expect(again.header.iRating).not.toBe(first.header.iRating)
    expect(again.header.iRating).toEqual(first.header.iRating)
  })
})

describe('traffic and alerts on the real RaceModel', () => {
  // You (GT3, 30 s laps); an LMP2 0.3 lap behind lapping in 27 s; a GT3 0.16 lap ahead that
  // stops on track at t = 67 s (0.06 lap ahead of you at t = 70 s).
  const drivers = [
    makeDriver(0, { classId: 1, classShortName: 'GT3', classRelSpeed: 50 }),
    makeDriver(1, {
      classId: 2,
      classShortName: 'LMP2',
      classRelSpeed: 70,
      classColor: '#33ceff',
      classEstLapTime: 27
    }),
    makeDriver(2, { classId: 1, classShortName: 'GT3', classRelSpeed: 50 })
  ]
  const session = makeSession(3, { sectorStarts: [0, 0.5], pitSpeedLimitKmh: 60 }, drivers)
  const field = (t: number): Cars => ({
    0: { d: 1 + V * t },
    1: { d: 0.7 + t / 27 },
    2: { d: 1.16 + V * Math.min(t, 67) }
  })

  it('the LMP2 closing with its ETA, and the stopped car ahead', () => {
    const sim = new Sim(session)
    sim.run(70, 60, field)
    const p = createProviders()
    const d = p.run.traffic(ctxOf(sim, session, config()), null)
    expect(d.visible).toBe(true)
    // 0.0407 lap behind at 27 s: 1.1 s away, closing at 1/27 - 1/30 lap/s: 11 s, at 0.70.
    expect(d.faster).toHaveLength(1)
    const f = d.faster[0]
    expect(f).toMatchObject({ kind: 'faster', className: 'LMP2', lapping: false, meetSector: 2 })
    expect(f?.gapS).toBeCloseTo(-1.1, 0)
    expect(f?.etaS).toBeGreaterThan(9)
    expect(f?.etaS).toBeLessThan(13)
    expect(f?.meetPct).toBeCloseTo(0.7, 1)
    // 0.06 lap ahead at your 30 s pace: 1.8 s.
    expect(d.hazards).toHaveLength(1)
    expect(d.hazards[0]).toMatchObject({ hazard: 'stopped', kind: 'hazard' })
    expect(d.hazards[0]?.gapS).toBeCloseTo(1.8, 0)
    expect(d.slower).toEqual([])
  })

  it('reset() forgets the traffic and the alerts holds', () => {
    const sim = new Sim(session)
    sim.run(70, 60, field)
    const p = createProviders()
    const base = config()
    // The LMP2 is 1.1 s behind: inside 2 s, then outside a 1 s window.
    const cfg = (behindS: number): TelemetryConfig => ({
      ...base,
      traffic: { ...base.traffic, behindS },
      alerts: { ...base.alerts, holdS: 3 }
    })
    sim.frame.CarIdxSessionFlags[0] = SessionFlag.Blue
    const shown = p.run.traffic(ctxOf(sim, session, cfg(2)), null)
    expect(shown.faster).toHaveLength(1)
    expect(p.run.alerts(ctxOf(sim, session, cfg(2)), null).flags).toEqual(['blue'])
    sim.run(0.1, 60, field)
    expect(p.run.traffic(ctxOf(sim, session, cfg(1)), shown).faster).toHaveLength(1)
    expect(p.run.alerts(ctxOf(sim, session, cfg(1)), null).flags).toEqual(['blue'])
    p.reset()
    sim.run(0.1, 60, field)
    expect(p.run.traffic(ctxOf(sim, session, cfg(1)), shown).faster).toEqual([])
    expect(p.run.alerts(ctxOf(sim, session, cfg(1)), null).flags).toEqual([])
  })
})

describe('delta on the real RaceModel', () => {
  // Practice. You lap in 30 s until t = 90, then one lap in 31 s; car 1 (your class) in 29.5 s.
  // Your first timed (clean) lap ends at t = 60, car 1's at t = 44.25.
  const drivers = [
    makeDriver(0, { userName: 'Andrés Lucena' }),
    makeDriver(1, { userName: 'Lia Costa', carNumber: '23' })
  ]
  const session = makeSession(2, { sectorStarts: [0, 0.5] }, drivers)
  const cars = (t: number): Cars => ({
    0: { d: t <= 90 ? 1 + V * t : 4 + (t - 90) / 31 },
    1: { d: 1.5 + t / 29.5 }
  })

  interface Sent {
    t: number
    d: DeltaData
  }

  function practice(
    delta: Partial<DeltaOptions>,
    bests: PersonalBestStore,
    each?: (sim: Sim, t: number) => void,
    seconds = 125
  ): Sent[] {
    const sim = new Sim(session, { sessionNum: PRACTICE })
    const p = createProviders()
    const base = config()
    const ctx = ctxOf(sim, session, { ...base, delta: { ...base.delta, ...delta } }, bests)
    const out: Sent[] = []
    let n = 0
    // The delta runs at 30 Hz: every other 60 Hz tick of the model.
    sim.run(seconds, 60, cars, (t) => {
      each?.(sim, t)
      if (n++ % 2 === 1) out.push({ t, d: p.run.delta(ctx, out.at(-1)?.d ?? null) })
    })
    return out
  }

  const between = (sent: readonly Sent[], from: number, to: number): Sent[] =>
    sent.filter((x) => x.t > from && x.t < to)
  const guardS = DELTA.guardPct * 30

  it('your session best is the reference from your first clean lap; a slower lap reads +', () => {
    const sent = practice({ reference: 'session', fallback: false }, createMemoryStore())
    expect(between(sent, 0, 60).every((x) => !x.d.visible)).toBe(true)
    // Lap 4 at the same pace: within a hundredth all lap.
    const lap4 = between(sent, 60 + guardS + 0.1, 90)
    expect(lap4.length).toBeGreaterThan(800)
    for (const { t, d } of lap4) {
      expect(d, `t=${t}`).toMatchObject({ visible: true, reference: 'session', lapValid: true })
      expect(d).toMatchObject({ refDriver: '', refSelf: false })
      expect(d.refLapTime).toBeCloseTo(30, 2)
      expect(Math.abs(d.delta ?? Infinity), `t=${t}`).toBeLessThanOrEqual(0.01)
      expect(d.predictedLap).toBeCloseTo(30, 1)
    }
    // At the line: lap 4 as it was.
    for (const { d } of between(sent, 90.1, 90 + guardS - 0.1)) {
      expect(d).toMatchObject({ delta: 0, sectors: [0, 0] })
      expect(d.predictedLap).toBeCloseTo(30, 2)
    }
    // Lap 5 in 31 s: half a second lost per half lap, the trend says losing.
    const s1 = between(sent, 106, 120.5)
    expect(s1.length).toBeGreaterThan(100)
    expect(s1.every((x) => x.d.sectors[0] === 0.5 && x.d.sectors[1] === null)).toBe(true)
    expect(s1.every((x) => x.d.trend > 0)).toBe(true)
    expect(between(sent, 120.8, 121).at(-1)?.d.delta).toBeCloseTo(1, 1)
    const line = between(sent, 121.1, 121 + guardS - 0.1)
    expect(line.length).toBeGreaterThan(5)
    for (const { d } of line) {
      expect(d).toMatchObject({ delta: 1, sectors: [0.5, 0.5], lapValid: true })
      expect(d.predictedLap).toBeCloseTo(31, 2)
      // The slower lap does not replace the reference.
      expect(d.refLapTime).toBeCloseTo(30, 2)
    }
  })

  it('pb with fallback: class best first, then yours, then your record; the record outlives the session', () => {
    const bests = createMemoryStore()
    const key = personalBestKey(session, 0) ?? ''
    let offered = false
    const sent = practice({ reference: 'pb', fallback: true }, bests, (sim, t) => {
      // The telemetry loop offers your clean lap once its official time could have arrived.
      if (offered || t < 65.5) return
      offered = true
      const last = sim.view.lapProfile(0, 'last')
      if (last) bests.offer(key, { lapTime: last.lapTime, profile: last.profile, recordedAt: '' })
    })
    expect(between(sent, 0, 44.2).every((x) => !x.d.visible)).toBe(true)
    // No lap of yours yet: car 1's, taken at once although you are mid-lap.
    for (const { d } of between(sent, 44.4, 60)) {
      expect(d).toMatchObject({ visible: true, reference: 'class', refDriver: '#23 L. Costa' })
      expect(d.refLapTime).toBeCloseTo(29.5, 2)
    }
    // Your first clean lap at the line, then your record once it is stored (same lap).
    const session4 = between(sent, 60 + guardS + 0.1, 65.4)
    expect(session4.every((x) => x.d.reference === 'session')).toBe(true)
    const pb = between(sent, 66, 90)
    expect(pb.length).toBeGreaterThan(600)
    expect(pb.every((x) => x.d.reference === 'pb' && x.d.refDriver === '' && !x.d.refSelf)).toBe(
      true
    )

    // Another session with the same car and track: your record is there from the first tick.
    const next = practice({ reference: 'pb', fallback: false }, bests, undefined, 20)
    expect(next[0]?.d).toMatchObject({ visible: true, reference: 'pb', delta: null })
    expect(next[0]?.d.refLapTime).toBeCloseTo(30, 2)
  })
})

describe('optimal laps on the real RaceModel', () => {
  // Practice on a two-sector track (halves). Your laps from t = 0 (the first one is not timed):
  // 15 + 15, 14 + 16, 16 + 14.5, then 15 + 15: your optimal is 14 + 14.5 = 28.5 from t = 90.5.
  // Car 1 (your class) laps evenly in 28.8 (14.4 a half); car 2, another class, in 25.
  const drivers = [
    makeDriver(0),
    makeDriver(1, { userName: 'Lia Costa', carNumber: '23' }),
    makeDriver(2, { userName: 'Ana Prototipo', carNumber: '2', classId: 2 })
  ]
  const session = makeSession(3, { sectorStarts: [0, 0.5] }, drivers)
  const HALVES: readonly (readonly [number, number])[] = [
    [15, 15],
    [14, 16],
    [16, 14.5],
    [15, 15],
    [15, 15],
    [15, 15]
  ]

  /** Race distance at t along HALVES, from the line at t = 0. */
  function along(t: number): number {
    let d = 1
    let at = 0
    for (const [a, b] of HALVES) {
      if (t < at + a) return d + (0.5 * (t - at)) / a
      if (t < at + a + b) return d + 0.5 + (0.5 * (t - at - a)) / b
      at += a + b
      d += 1
    }
    return d
  }

  const cars = (t: number): Cars => ({
    0: { d: along(t) },
    1: { d: 1.5 + t / 28.8 },
    2: { d: 1.2 + t / 25 }
  })

  function practice(reference: DeltaReference): { t: number; d: DeltaData }[] {
    const sim = new Sim(session, { sessionNum: PRACTICE })
    const p = createProviders()
    const base = config()
    const delta: DeltaOptions = { ...base.delta, reference, fallback: false }
    const ctx = ctxOf(sim, session, { ...base, delta })
    const out: { t: number; d: DeltaData }[] = []
    let n = 0
    sim.run(150, 60, cars, (t) => {
      if (n++ % 2 === 1) out.push({ t, d: p.run.delta(ctx, out.at(-1)?.d ?? null) })
    })
    return out
  }

  const between = <T extends { t: number }>(sent: readonly T[], from: number, to: number): T[] =>
    sent.filter((x) => x.t > from && x.t < to)
  const guardS = DELTA.guardPct * 30

  it('your optimal: the best of each half from different laps; the sectors read against it', () => {
    const sent = practice('optimal')
    expect(between(sent, 0, 60).every((x) => !x.d.visible)).toBe(true)
    // Lap 3 (14 + 16) alone, then 14 + 14.5 once lap 4 is in.
    for (const { d } of between(sent, 60 + guardS + 0.1, 90)) {
      expect(d).toMatchObject({
        visible: true,
        reference: 'optimal',
        refDriver: '',
        refSelf: false
      })
      expect(d.refLapTime).toBeCloseTo(30, 1)
    }
    const after = between(sent, 90.5 + guardS + 0.1, 150)
    expect(after.length).toBeGreaterThan(1500)
    for (const { d } of after) expect(d.refLapTime).toBeCloseTo(28.5, 1)
    // Lap 5 (15 + 15) at its line: a second lost in S1, half a second in S2.
    const line = between(sent, 120.6, 120.5 + guardS - 0.1)
    expect(line.length).toBeGreaterThan(5)
    for (const { d } of line) {
      expect(d.delta).toBeCloseTo(1.5, 1)
      expect(d.sectors[0]).toBeCloseTo(1, 1)
      expect(d.sectors[1]).toBeCloseTo(0.5, 1)
    }
  })

  it('the class optimal: your S1 and car 1’s S2, under the class best and your optimal', () => {
    const optimal = practice('optimal').at(-1)?.d.refLapTime ?? NaN
    const best = practice('class').at(-1)?.d.refLapTime ?? NaN
    const sent = practice('classOptimal')
    const last = sent.at(-1)?.d
    expect(last).toMatchObject({ visible: true, reference: 'classOptimal', refDriver: '' })
    expect(last?.refSelf).toBe(false)
    expect(last?.refLapTime).toBeCloseTo(14 + 14.4, 1)
    expect(best).toBeCloseTo(28.8, 1)
    expect(last?.refLapTime).toBeLessThan(Math.min(best, optimal))
  })
})

function session3(): SessionMeta {
  return makeSession(3)
}
