/**
 * End to end without Electron: the real mock series through the real TelemetryLoop (RaceModel,
 * providers, visibility rules and SKIP_EMIT) on a fake clock, checking the messages main would
 * receive. Two runs:
 * - the first ten minutes of a session at 60 Hz;
 * - joining late (overlay started at minute 22.5), through the caution, a car stopped ahead,
 *   the player's pit stop, the chequered flag, the cool-down and into the next session, at 30 Hz.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { DELTA } from '@shared/delta/delta'
import type { TelemetryOutMessage } from '@shared/ipc'
import type { TelemetryFrame } from '@shared/telemetry'
import type {
  DeltaOptions,
  DeltaReference,
  FlagKind,
  GapValue,
  HiddenReason,
  StandingsData,
  TelemetryConfig,
  TrafficEntry,
  WidgetPayloads
} from '@shared/types'
import type { WidgetId } from '@shared/widgets'
import { TelemetryLoop, defaultTelemetryConfig } from './loop'
import { MOCK_PIT_SPEED_LIMIT_KMH, MOCK_TIMELINE, MockSeries } from './mock/simulation'
import type { MockSessionInfo } from './mock/simulation'
import type { TelemetrySource } from './sources/TelemetrySource'

/** Gaps need a lap of timing-line history; the first S/F crossing of the player is at ~10 s. */
const WARM_UP_S = 150
/** Run 2 starts here (seconds since the session started): before the caution. */
const LATE_JOIN_S = 1350
/** Default traffic windows (s) and alerts hold (s). */
const DEFAULTS = defaultTelemetryConfig()

/**
 * The delta against your record in every kind of session (the one reference every file had
 * before v2.6): these runs check its whole chain (pb -> session -> class).
 */
function withRecord(config: TelemetryConfig): TelemetryConfig {
  return {
    ...config,
    // The spotter too, hidden for a new install: every widget runs.
    enabledWidgets: [...new Set([...config.enabledWidgets, 'spotter' as const])],
    delta: { ...config.delta, ...everySession('pb') },
    // The standings' second header line (iRating, SR), off for a new install since R30.
    standings: { ...config.standings, subheaderBarSize: 'normal' }
  }
}

function everySession(
  r: DeltaReference
): Pick<DeltaOptions, 'referencePractice' | 'referenceQualify' | 'referenceRace'> {
  return { referencePractice: r, referenceQualify: r, referenceRace: r }
}

/** The series stepped by exactly one tick per waitForTick, on a fake clock. */
class SteppedSource implements TelemetrySource {
  readonly kind = 'mock'

  constructor(
    readonly series: MockSeries,
    private readonly clock: { ms: number },
    private readonly dtS: number,
    private readonly finished: () => boolean,
    private readonly done: () => void
  ) {}

  connect(): Promise<boolean> {
    return Promise.resolve(true)
  }

  disconnect(): void {
    // Nothing to release.
  }

  isConnected(): boolean {
    return true
  }

  waitForTick(): boolean {
    if (this.finished()) {
      this.done()
      return false
    }
    this.series.step(this.dtS)
    this.clock.ms += this.dtS * 1000
    return true
  }

  readFrame(): TelemetryFrame {
    return this.series.frame()
  }

  sessionInfoVersion(): number {
    return this.series.sessionInfoVersion
  }

  readSessionInfo(): MockSessionInfo {
    return this.series.sessionInfo()
  }
}

/** A message as received, with the session it belongs to and its seconds since it started. */
interface At {
  session: number
  s: number
}
type Sent<K extends WidgetId> = At & { payload: WidgetPayloads[K] }
type Hidden = At & { widget: WidgetId; hidden: boolean; reason: HiddenReason | null }

interface Run {
  series: MockSeries
  standings: Sent<'standings'>[]
  battle: Sent<'battle'>[]
  inputs: Sent<'inputs'>[]
  radar: Sent<'radar'>[]
  traffic: Sent<'traffic'>[]
  alerts: Sent<'alerts'>[]
  delta: Sent<'delta'>[]
  spotter: Sent<'spotter'>[]
  hidden: Hidden[]
  logs: string[]
  ticks: number
}

async function runLoop(
  series: MockSeries,
  dtS: number,
  until: (run: Run) => boolean,
  config?: TelemetryConfig
): Promise<Run> {
  const start = new MockSeries().sessionTime
  const run: Run = {
    series,
    standings: [],
    battle: [],
    inputs: [],
    radar: [],
    traffic: [],
    alerts: [],
    delta: [],
    spotter: [],
    hidden: [],
    logs: [],
    ticks: 0
  }
  const at = (): At => ({ session: series.sessionIndex, s: series.sessionTime - start })
  const emit = (msg: TelemetryOutMessage): void => {
    if (msg.type === 'log') run.logs.push(`${msg.level}: ${msg.message}`)
    if (msg.type === 'auto-hidden') {
      run.hidden.push({ ...at(), widget: msg.widget, hidden: msg.hidden, reason: msg.reason })
    }
    if (msg.type !== 'data') return
    if (msg.widget === 'standings') run.standings.push({ ...at(), payload: msg.payload })
    else if (msg.widget === 'battle') run.battle.push({ ...at(), payload: msg.payload })
    else if (msg.widget === 'inputs') run.inputs.push({ ...at(), payload: msg.payload })
    else if (msg.widget === 'radar') run.radar.push({ ...at(), payload: msg.payload })
    else if (msg.widget === 'traffic') run.traffic.push({ ...at(), payload: msg.payload })
    else if (msg.widget === 'alerts') run.alerts.push({ ...at(), payload: msg.payload })
    else if (msg.widget === 'delta') run.delta.push({ ...at(), payload: msg.payload })
    else if (msg.widget === 'spotter') run.spotter.push({ ...at(), payload: msg.payload })
  }
  const clock = { ms: 0 }
  const end = { stop: (): void => {} }
  const source = new SteppedSource(
    series,
    clock,
    dtS,
    () => {
      if (until(run)) return true
      run.ticks++
      return false
    },
    () => end.stop()
  )
  const loop = new TelemetryLoop(source, emit, {
    now: () => clock.ms,
    sleep: () => Promise.resolve(),
    yieldToEventLoop: () => Promise.resolve()
  })
  loop.setConfig(config ?? withRecord(defaultTelemetryConfig()))
  end.stop = () => loop.stop()
  await loop.start()
  return run
}

function seconds(g: GapValue | null | undefined): number | null {
  return g !== null && g !== undefined && g.kind === 'time' ? g.seconds : null
}

/** Every entry of a traffic group across the run, with the time it was received. */
function entries(
  sent: readonly Sent<'traffic'>[],
  group: 'faster' | 'slower' | 'hazards'
): (At & { e: TrafficEntry })[] {
  return sent.flatMap((x) => x.payload[group].map((e) => ({ session: x.session, s: x.s, e })))
}

/** When a flag was listed: [first, last] message times of each unbroken stretch. */
function flagSpans(sent: readonly Sent<'alerts'>[], kind: FlagKind): [number, number][] {
  const out: [number, number][] = []
  let open: [number, number] | null = null
  for (let i = 0; i < sent.length; i++) {
    const x = sent[i]
    if (!x) continue
    if (x.payload.flags.includes(kind)) {
      if (!open) out.push((open = [x.s, x.s]))
      // Messages are sent on change only: the stretch lasts until the next message.
      open[1] = sent[i + 1]?.s ?? x.s
    } else open = null
  }
  return out
}

function playerClass(p: StandingsData): StandingsData['classes'][number] | undefined {
  return p.classes[0]
}

function playerRow(p: StandingsData): StandingsData['classes'][number]['rows'][number] | undefined {
  return playerClass(p)?.rows.find((r) => r.isPlayer)
}

/** The player's lap times as the standings showed them in one session, in order. */
function playerLaps(sent: readonly Sent<'standings'>[], session: number): number[] {
  const out: number[] = []
  for (const x of sent) {
    const lap = x.session === session ? playerRow(x.payload)?.lastLap : null
    if (lap != null && lap !== out.at(-1)) out.push(lap)
  }
  return out
}

/** A delta payload at the S/F line: the lap just finished, with every sector. */
function atLine(p: WidgetPayloads['delta']): boolean {
  return p.visible && p.sectors.length > 0 && p.sectors.every((v) => v !== null)
}

/**
 * Against your own laps (reference pb or session) the delta is a few tenths and the predicted
 * lap is the reference plus the delta; at the line it is the lap you just drove. Returns how
 * many line payloads were checked.
 */
function checkOwnDelta(sent: readonly Sent<'delta'>[], laps: readonly number[]): number {
  let lines = 0
  for (const { s, payload: p } of sent) {
    const at = `t=${s.toFixed(2)}`
    if (!p.visible || p.reference === 'class' || p.delta === null) continue
    if (p.lapState === 'valid') expect(Math.abs(p.delta), at).toBeLessThan(3)
    expect(p.predictedLap, at).toBeCloseTo((p.refLapTime ?? NaN) + p.delta, 2)
    if (!atLine(p)) continue
    lines++
    const lap = p.predictedLap ?? NaN
    expect(
      laps.some((l) => Math.abs(l - lap) < 0.01),
      `${at} ${lap}`
    ).toBe(true)
    // The sectors add up to the lap (each rounded to 0.01).
    const sum = p.sectors.reduce<number>((a, v) => a + (v ?? NaN), 0)
    expect(Math.abs(sum - p.delta), at).toBeLessThanOrEqual(0.02)
  }
  return lines
}

describe('mock race end to end: the first ten minutes at 60 Hz', () => {
  const RUN_S = 600
  let run: Run
  beforeAll(async () => {
    const ticks = Math.round(RUN_S * 60)
    run = await runLoop(new MockSeries(), 1 / 60, (r) => r.ticks >= ticks)
  }, 20_000)

  it('runs without provider or model errors, every widget shown in a race', () => {
    expect(run.logs).toEqual([])
    expect(run.hidden).toEqual([])
    // 4 Hz widgets: SKIP_EMIT drops the unchanged payloads.
    expect(run.standings.length).toBeGreaterThan(RUN_S)
    expect(run.standings.length).toBeLessThan(RUN_S * 4)
    expect(run.battle.length).toBeGreaterThan(10)
    expect(run.battle.length).toBeLessThan(RUN_S * 4)
  })

  it('spotter: every side the mock drives, two cars on one, a full pillar, few payloads', () => {
    const sides = new Set<string>()
    let full = 0
    let filled = 0
    let unknown = 0
    for (const { s, payload: p } of run.spotter) {
      const at = `t=${s.toFixed(2)}`
      if (!p.active) continue
      sides.add(`${p.left.count}/${p.right.count}`)
      for (const side of [p.left, p.right]) {
        // Each stretch inside your car, front first, apart from the next one; the cover is their sum.
        let end = -1
        let sum = 0
        for (const g of side.segs) {
          expect(g.from, at).toBeGreaterThan(end)
          expect(g.to, at).toBeGreaterThan(g.from)
          expect(g.to, at).toBeLessThanOrEqual(1)
          end = g.to
          sum += g.to - g.from
        }
        if (!side.unknown) expect(side.cover, at).toBeCloseTo(sum, 6)
        if (side.count === 0) expect(side.segs, at).toEqual([])
        if (side.count > 0 && side.segs.length > 0) filled++
        if (side.unknown) unknown++
        if (side.cover >= 1 && !side.unknown) full++
      }
    }
    // «Cercanía» (5c): full on a side iRacing counts, between empty and full for a car held on its
    // side as it gets away, and never more.
    let closing = 0
    for (const { s: t, payload: p } of run.spotter) {
      if (!p.active) continue
      for (const side of [p.left, p.right]) {
        if (side.count > 0) expect(side.close, `t=${t.toFixed(2)}`).toBe(1)
        expect(side.close).toBeGreaterThanOrEqual(0)
        expect(side.close).toBeLessThanOrEqual(1)
        if (side.count === 0 && side.close > 0 && side.close < 1) closing++
      }
    }
    expect(closing).toBeGreaterThan(0)
    // CarLeft, CarRight, both, two left, two right (scripts.ts), and clear.
    for (const k of ['1/0', '0/1', '1/1', '2/0', '0/2', '0/0']) expect(sides.has(k), k).toBe(true)
    expect(full).toBeGreaterThan(0)
    // The mock's cars are matched: a side iRacing counts is placed, almost never "somewhere".
    expect(unknown).toBeLessThan(filled / 20)
    // Quantised and sent on change only: far fewer messages than its 60 Hz ticks.
    expect(run.spotter.length).toBeGreaterThan(50)
    expect(run.spotter.length).toBeLessThan(RUN_S * 60 * 0.25)
  })

  it('standings: the player class first, sane positions and gaps growing down the order', () => {
    const { cast } = run.series.current
    let checked = 0
    for (const { s, payload } of run.standings) {
      const mine = playerClass(payload)
      expect(mine?.isPlayerClass, `t=${s}`).toBe(true)
      expect(mine?.className).toBe('GT3')
      expect(payload.classes.slice(1).every((c) => !c.isPlayerClass)).toBe(true)
      const rows = mine?.rows ?? []
      const positions = rows.map((r) => r.classPosition)
      expect(positions.every((p, i) => p >= 1 && (i === 0 || p > (positions[i - 1] ?? 0)))).toBe(
        true
      )
      expect(rows.filter((r) => r.isPlayer)).toHaveLength(1)
      expect(rows[0]?.classPosition).toBe(1)
      expect(rows[0]?.interval).toBeNull()
      if (s < WARM_UP_S) continue
      const racing = (r: (typeof rows)[number] | undefined): boolean =>
        r?.status === 'running' && !r.outLap
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        const above = rows[i - 1]
        if (!row || !above) continue
        const at = `t=${s.toFixed(2)} P${row.classPosition}`
        const gap = seconds(row.gapToLeader)
        const interval = seconds(row.interval)
        if (interval !== null) expect(interval, at).toBeGreaterThanOrEqual(0)
        const prevGap = i === 1 ? 0 : seconds(above.gapToLeader)
        // Cars in the pit lane have no comparable gaps (each is an estimate of its own).
        if (gap === null || prevGap === null || !racing(row) || !racing(above)) continue
        // Same lap: the gap to the leader grows down the order...
        expect(gap, at).toBeGreaterThanOrEqual(prevGap - 0.2)
        // ...by the interval, give or take the pace difference over the time between the lines
        // the two gaps were taken at.
        if (row.gapBefore || interval === null || !racing(rows[0])) continue
        expect(Math.abs(gap - prevGap - interval), at).toBeLessThanOrEqual(0.15 + 0.05 * interval)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(1000)
    // The scripted battle cars sit around the player, within 1.5 s.
    const last = run.standings.at(-1)?.payload
    const rows = (last && playerClass(last)?.rows) ?? []
    const at = rows.findIndex((r) => r.isPlayer)
    expect(rows[at - 1]?.carIdx).toBe(cast.battleAhead)
    expect(rows[at + 1]?.carIdx).toBe(cast.battleBehind)
    expect(seconds(rows[at]?.interval)).toBeLessThan(1.5)
    expect(seconds(rows[at + 1]?.interval)).toBeLessThan(1.5)
  })

  it('standings header: laps left in the timed race, iRating and SR in this official race', () => {
    for (const { payload } of run.standings) {
      const h = payload.header
      expect(h.sessionType).toBe('Race')
      expect(h.iRating).not.toBeNull()
      expect(h.safetyRating).not.toBeNull()
      expect(Number.isInteger(h.iRating?.iRatingDelta)).toBe(true)
      expect(h.safetyRating?.current).toBeCloseTo(3.27, 2)
      // The neutral position is a real class position.
      expect(h.iRating?.breakEvenPosition).toBeGreaterThanOrEqual(1)
      // The player laps in ~139 s; the race ends at the overall leader's first crossing after
      // the clock runs out (~127 s laps), then the player's lap in progress counts too.
      const rem = h.timeRemainingS ?? 0
      expect(h.lapsRemaining).toBeGreaterThanOrEqual(Math.floor(rem / 140))
      expect(h.lapsRemaining).toBeLessThanOrEqual(Math.ceil((rem + 130) / 138) + 1)
    }
    const first = run.standings[0]?.payload.header.safetyRating
    // The model joined at lap ~15: the corners cover the whole session like the incidents do,
    // and the margin is measured over the whole race, so a clean driver starts with one.
    expect(first?.corners).toBeGreaterThan(10 * 15)
    expect(first?.incidents).toBe(0)
    expect(first?.incidentBudget).toBeGreaterThan(0)
    const last = run.standings.at(-1)?.payload.header
    // 40:00 at the start, ten minutes run, sent as whole seconds.
    expect(last?.timeRemainingS).toBeGreaterThanOrEqual(1799)
    expect(last?.timeRemainingS).toBeLessThanOrEqual(1800)
    // Scripted incidents at 90 s and 300 s: 1 + 2 points, over ~19 laps (the SR still rises).
    expect(last?.safetyRating?.incidents).toBe(3)
    expect(last?.safetyRating?.projected).toBeLessThan(first?.projected ?? 0)
    expect(last?.safetyRating?.incidentBudget).toBeLessThan(first?.incidentBudget ?? 0)
    // The player's row shows the same projected change as the header.
    const me = run.standings.at(-1)?.payload
    expect(me && playerRow(me)?.iRatingDelta).toBe(last?.iRating?.iRatingDelta)
    // Default columns: nobody else's change is sent.
    const others = me?.classes.flatMap((c) => c.rows).filter((r) => !r.isPlayer) ?? []
    expect(others.every((r) => r.iRatingDelta === null)).toBe(true)
  })

  it('battle: both scripted rivals, with the trend in the intended direction', () => {
    const { cast } = run.series.current
    // Both close in over the player's first ~2.4 laps (~330 s); until ~180 s the car with the
    // meatball still drops back through them.
    const closing = run.battle.filter((b) => b.s > 180 && b.s < 320)
    expect(closing.length).toBeGreaterThan(5)
    for (const { s, payload } of closing) {
      expect(payload.visible).toBe(true)
      // The car ahead is caught at ~0.15 s/lap: in your favour (+).
      expect(payload.ahead?.carIdx, `t=${s}`).toBe(cast.battleAhead)
      expect(payload.ahead?.trendSPerLap ?? 0, `t=${s}`).toBeGreaterThan(0.05)
      expect(payload.ahead?.catchesBeforeEnd).toBe(true)
      // The car behind closes at ~0.1 s/lap: against you (-), it catches you.
      expect(payload.behind?.carIdx, `t=${s}`).toBe(cast.battleBehind)
      expect(payload.behind?.trendSPerLap ?? 0, `t=${s}`).toBeLessThan(-0.05)
      expect(payload.behind?.lapsToCatch).toBeGreaterThan(0)
      for (const o of [payload.ahead, payload.behind]) {
        expect(o?.gapS).toBeGreaterThanOrEqual(0)
        expect(o?.gapS).toBeLessThanOrEqual(1.5)
        expect(o?.iRatingAtStake).toBeGreaterThan(0)
        expect(o?.inPits).toBe(false)
        // Whole laps, as shown.
        if (o?.lapsToCatch != null) expect(Number.isInteger(o.lapsToCatch)).toBe(true)
      }
      expect(Number.isInteger(payload.lapsRemaining)).toBe(true)
    }
    // Once known, the sector comparison of the car ahead stays (no row blinking at each line).
    const ahead = run.battle.filter((b) => b.payload.ahead?.carIdx === cast.battleAhead)
    const firstSectors = ahead.findIndex((b) => b.payload.ahead?.sectorDeltas != null)
    expect(firstSectors).toBeGreaterThanOrEqual(0)
    const after = ahead.slice(firstSectors).filter((b) => b.s < 320)
    expect(after.length).toBeGreaterThan(5)
    for (const b of after) expect(b.payload.ahead?.sectorDeltas, `t=${b.s}`).toHaveLength(3)
    const last = run.battle.at(-1)?.payload
    expect(last?.playerLastLaps).toHaveLength(3)
    expect(last?.lapsRemaining).toBeGreaterThan(10)
  })

  it('traffic: the LMP2s lapping the GT3 player, with a positive ETA and where you meet', () => {
    const { behindS, maxEntries } = DEFAULTS.traffic
    const faster = entries(run.traffic, 'faster')
    expect(faster.length).toBeGreaterThan(20)
    for (const { s, e } of faster) {
      const at = `t=${s.toFixed(2)} #${e.driver.carNumber}`
      expect(e.className, at).toBe('LMP2')
      expect(e.kind).toBe('faster')
      // Behind you, inside the window (plus the hold at its edge).
      expect(e.gapS, at).toBeLessThanOrEqual(0)
      expect(e.gapS, at).toBeGreaterThanOrEqual(-behindS - 0.5)
      if (e.etaS === null) continue
      // 0.0 s when it is alongside.
      expect(e.etaS, at).toBeGreaterThanOrEqual(0)
      expect(e.meetPct, at).toBeGreaterThanOrEqual(0)
      expect(e.meetPct, at).toBeLessThan(1)
      expect([1, 2, 3]).toContain(e.meetSector)
    }
    // ~12 s a lap quicker: the ETA is a minute or more at the window's edge, seconds when it
    // is about to pass.
    const etas = faster.map((x) => x.e.etaS).filter((x): x is number => x !== null)
    expect(etas.length).toBeGreaterThan(faster.length / 2)
    expect(etas.filter((x) => x > 0).length).toBeGreaterThan(etas.length / 2)
    expect(Math.min(...etas)).toBeLessThan(10)
    expect(Math.max(...etas)).toBeGreaterThan(60)
    // The LMP2s are laps up after 15 laps of racing.
    expect(faster.some((x) => x.e.lapping)).toBe(true)
    // No class is slower than GT3: the slower traffic is GT3 backmarkers you are lapping
    // (classmates on your lap are rivals, not traffic).
    const slower = entries(run.traffic, 'slower')
    expect(slower.length).toBeGreaterThan(0)
    for (const { s, e } of slower) {
      const at = `t=${s.toFixed(2)} #${e.driver.carNumber}`
      expect(e, at).toMatchObject({ kind: 'slower', className: 'GT3', lapping: true })
      // Ahead of you (0.0 s as you pass it).
      expect(e.gapS, at).toBeGreaterThanOrEqual(0)
      expect(e.gapS, at).toBeLessThanOrEqual(DEFAULTS.traffic.aheadS + 0.5)
      expect(e.etaS, at).toBeGreaterThanOrEqual(0)
    }
    for (const { payload } of run.traffic) {
      const n = payload.faster.length + payload.slower.length + payload.hazards.length
      expect(n > 0).toBe(payload.visible)
      expect(payload.faster.length).toBeLessThanOrEqual(maxEntries)
    }
    // 4 Hz at most, and only on change.
    expect(run.traffic.length).toBeLessThan(RUN_S * 4)
  })

  it('alerts: the blue flag while an LMP2 laps you; no limiter off pit road', () => {
    const blue = flagSpans(run.alerts, 'blue')
    expect(blue.length).toBeGreaterThan(0)
    const faster = entries(run.traffic, 'faster')
    for (const [from] of blue) {
      // A lapping car is close behind when the blue flag comes out.
      const near = faster.filter((x) => x.e.lapping && Math.abs(x.s - from) < 1)
      expect(near.length, `blue at t=${from}`).toBeGreaterThan(0)
    }
    for (const { payload } of run.alerts) {
      expect(payload.pitLimiter).toBeNull()
      expect(payload.speedKmh).toBe(0)
      expect(payload.pitLimitKmh).toBe(MOCK_PIT_SPEED_LIMIT_KMH)
      expect(payload.visible).toBe(payload.flags.length > 0 || payload.incident !== null)
    }
    // 10 Hz at most, and only on change.
    expect(run.alerts.length).toBeLessThan(RUN_S * 2)
  })

  it('incidents: the header count with the next limit, and each one in the alerts', () => {
    // Every standings header counts your incidents, with the session's next limit (17x).
    const counts = run.standings.map((x) => x.payload.header.incidents)
    expect(counts[0]).toEqual({ mine: 0, team: null, limit: { kind: 'penalty', at: 17 } })
    expect(counts.at(-1)?.mine).toBe(3)
    // One alert per timeline incident: what, where and on what, for a few seconds.
    const [first, second] = MOCK_TIMELINE.playerIncidents.map(([atS]) =>
      run.alerts.filter((x) => x.payload.incident !== null && x.s >= atS && x.s < atS + 10)
    )
    const off = first?.[0]
    expect(off?.s).toBeCloseTo(MOCK_TIMELINE.playerIncidents[0]?.[0] ?? 0, 0)
    expect(off?.payload.incident).toMatchObject({ points: 1, kind: 'off-track', surface: 'grass' })
    expect(off?.payload.incident?.lap).toBeGreaterThan(1)
    expect([1, 2, 3]).toContain(off?.payload.incident?.sector)
    // The 2x one: an off-track upgraded a moment later to a loss of control, one incident.
    expect(second?.map((x) => x.payload.incident?.points)).toEqual([1, 2])
    expect(second?.at(-1)?.payload.incident).toMatchObject({
      kind: 'loss-of-control',
      surface: 'gravel'
    })
    // Gone a few seconds after its last point (the next message clears it).
    const after = run.alerts.find((x) => x.s > (second?.at(-1)?.s ?? 0))
    expect(after?.payload.incident).toBeNull()
    expect((after?.s ?? 0) - (second?.at(-1)?.s ?? 0)).toBeGreaterThan(5)
    expect((after?.s ?? 0) - (second?.at(-1)?.s ?? 0)).toBeLessThan(7)
  })

  it('delta: a classmate lap until your first clean one, then yours; predictions are your laps', () => {
    // 30 Hz at most, and only on change: the mock laps are within a few tenths of each other.
    expect(run.delta.length).toBeGreaterThan(20)
    expect(run.delta.length).toBeLessThan(RUN_S * 30)
    // Nothing to compare with until a lap of your class has been timed whole.
    expect(run.delta[0]?.payload.visible).toBe(false)
    const shown = run.delta.filter((x) => x.payload.visible)
    const ownAt = shown.findIndex((x) => x.payload.reference !== 'class')
    expect(ownAt).toBeGreaterThan(0)
    for (const { payload: p } of shown.slice(0, ownAt)) {
      expect(p.refSelf).toBe(false)
      expect(p.refDriver).toMatch(/^#\d+ \p{Lu}\. \S/u)
      expect(p.refLapTime).toBeGreaterThan(130)
      expect(p.refLapTime).toBeLessThan(150)
    }
    // Your first clean lap: the one with the 90 s incident (off track) does not count, so it
    // ends a whole lap later. It is your session best at the line...
    const own = shown[ownAt]
    expect(own?.payload).toMatchObject({ reference: 'session', refDriver: '', refSelf: false })
    expect(own?.s).toBeGreaterThan((MOCK_TIMELINE.playerIncidents[0]?.[0] ?? 0) + 130)
    const lapThen = run.standings.filter((x) => x.s <= (own?.s ?? 0)).at(-1)?.payload
    expect(own?.payload.refLapTime).toBeCloseTo((lapThen && playerRow(lapThen)?.lastLap) ?? 0, 2)
    // ...and your record a few seconds later (stored once its official time could arrive). A
    // classmate's lap is never the reference again.
    const rest = shown.slice(ownAt)
    expect(rest.every((x) => x.payload.reference !== 'class')).toBe(true)
    const pb = rest.find((x) => x.payload.reference === 'pb')
    expect(pb?.payload).toMatchObject({ refDriver: '', refSelf: false })
    expect((pb?.s ?? Infinity) - (own?.s ?? 0)).toBeLessThan(10)
    expect(pb?.payload.refLapTime).toBe(own?.payload.refLapTime)
    // A faster clean lap later becomes the new record.
    const records = new Set(rest.map((x) => x.payload.refLapTime))
    expect(records.size).toBeGreaterThanOrEqual(2)
    expect(Math.min(...[...records].map((r) => r ?? Infinity))).toBeLessThan(
      own?.payload.refLapTime ?? 0
    )
    expect(checkOwnDelta(rest, playerLaps(run.standings, 0))).toBeGreaterThanOrEqual(1)
  })

  it('inputs: one active payload per tick, in range, clutch as pedal travel, timestamped', () => {
    expect(run.inputs).toHaveLength(run.ticks)
    let fullThrottle = 0
    let hardBraking = 0
    let clutchDown = 0
    let lastT = -Infinity
    // 36 000 payloads: checked with plain comparisons (one expect per payload would take
    // seconds), the first one out of range reported whole.
    const inRange = (v: number, min: number, max: number): boolean => v >= min && v <= max
    let firstBad: unknown = null
    for (const { payload: p } of run.inputs) {
      const ok =
        p.active &&
        inRange(p.throttle, 0, 1) &&
        inRange(p.brake, 0, 1) &&
        inRange(p.clutch, 0, 1) &&
        Math.abs(p.steering) <= 1 &&
        inRange(p.gear, 1, 7) &&
        p.speedKmh > 30 &&
        p.speedKmh < 330 &&
        p.t > lastT
      if (!ok && firstBad === null) firstBad = { ...p, previousT: lastT }
      lastT = p.t
      if (p.throttle === 1) fullThrottle++
      if (p.brake > 0.5) hardBraking++
      if (p.clutch > 0) clutchDown++
    }
    expect(firstBad).toBeNull()
    const n = run.inputs.length
    expect(fullThrottle / n).toBeGreaterThan(0.3)
    expect(hardBraking).toBeGreaterThan(0)
    // Clutch = 1 (engaged) in the sim is a released pedal: pressed only on the downshift blips.
    expect(clutchDown).toBeGreaterThan(0)
    expect(clutchDown / n).toBeLessThan(0.1)
  })
})

describe('mock race end to end: the optimal references over the first ten minutes at 30 Hz', () => {
  const RUN_S = 600
  /** A reference in use this long unchanged has settled: past the switching window of a lap. */
  const SETTLED_S = DELTA.switchS + 1
  const runs = new Map<DeltaReference, Run>()

  beforeAll(async () => {
    // The same deterministic race once per reference, without fallback.
    for (const reference of ['session', 'optimal', 'class', 'classOptimal'] as const) {
      const config = defaultTelemetryConfig()
      config.enabledWidgets = reference === 'optimal' ? ['delta', 'standings'] : ['delta']
      config.delta = { ...config.delta, ...everySession(reference), fallback: false }
      const ticks = RUN_S * 30
      runs.set(reference, await runLoop(new MockSeries(), 1 / 30, (r) => r.ticks >= ticks, config))
    }
  }, 30_000)

  function sentFor(reference: DeltaReference): Sent<'delta'>[] {
    const run = runs.get(reference)
    expect(run?.logs).toEqual([])
    return run?.delta ?? []
  }

  /** refLapTime in use at each whole second where it had settled (null: none shown then). */
  function settled(sent: readonly Sent<'delta'>[]): Map<number, number | null> {
    const out = new Map<number, number | null>()
    let i = -1
    let changedAt = 0
    let value: number | null = null
    for (let s = 0; s <= RUN_S; s++) {
      while (i + 1 < sent.length && (sent[i + 1]?.s ?? Infinity) <= s) {
        i++
        const p = sent[i]?.payload
        const next = p?.visible ? (p.refLapTime ?? null) : null
        if (next !== value) changedAt = sent[i]?.s ?? s
        value = next
      }
      if (s - changedAt >= SETTLED_S) out.set(s, value)
    }
    return out
  }

  /**
   * A shown reference only changes before the first sector line of a lap (no sector of the new
   * payload done yet), never mid-lap. Returns how many changes were checked.
   */
  function switchesAtLapStart(sent: readonly Sent<'delta'>[]): number {
    let n = 0
    let prev: WidgetPayloads['delta'] | null = null
    for (const { s, payload: p } of sent) {
      if (prev?.visible && p.visible && p.refLapTime !== prev.refLapTime) {
        n++
        expect(
          p.sectors.every((v) => v === null),
          `t=${s.toFixed(2)}`
        ).toBe(true)
      }
      prev = p
    }
    return n
  }

  /** Pairs of settled values of two runs at the same second, both shown. */
  function pairs(a: DeltaReference, b: DeltaReference): [number, number][] {
    const x = settled(sentFor(a))
    const y = settled(sentFor(b))
    const out: [number, number][] = []
    for (const [s, v] of x) {
      const w = y.get(s)
      if (v !== null && w !== undefined && w !== null) out.push([v, w])
    }
    return out
  }

  it('optimal: nobody’s lap, never slower than your session best; the delta is against it', () => {
    const sent = sentFor('optimal')
    const shown = sent.filter((x) => x.payload.visible)
    expect(shown.length).toBeGreaterThan(20)
    for (const { payload: p } of shown) {
      expect(p).toMatchObject({ reference: 'optimal', refDriver: '', refSelf: false })
    }
    // The mock's slow pace noise moves the sectors of a lap together: its best lap is often
    // the best in every sector too, so the optimal may equal the session best (exactly: a lap
    // best everywhere is the optimal), never exceed it.
    const both = pairs('optimal', 'session')
    expect(both.length).toBeGreaterThan(200)
    for (const [optimal, best] of both) {
      expect(optimal).toBeLessThanOrEqual(best)
      expect(optimal).toBeGreaterThan(best - 1)
    }
    const laps = playerLaps(runs.get('optimal')?.standings ?? [], 0)
    expect(checkOwnDelta(sent, laps)).toBeGreaterThanOrEqual(1)
    expect(switchesAtLapStart(sent)).toBeGreaterThanOrEqual(1)
  })

  it('class optimal: nobody’s lap, never slower than the class best or your optimal', () => {
    const sent = sentFor('classOptimal')
    expect(switchesAtLapStart(sent)).toBeGreaterThanOrEqual(2)
    const shown = sent.filter((x) => x.payload.visible)
    expect(shown.length).toBeGreaterThan(20)
    for (const { payload: p } of shown) {
      expect(p).toMatchObject({ reference: 'classOptimal', refDriver: '', refSelf: false })
      // A classmate's laps of the mock GT3s.
      expect(p.refLapTime).toBeGreaterThan(120)
    }
    const vsBest = pairs('classOptimal', 'class')
    expect(vsBest.length).toBeGreaterThan(300)
    for (const [optimal, best] of vsBest) {
      expect(optimal).toBeLessThanOrEqual(best)
      expect(optimal).toBeGreaterThan(best - 1)
    }
    const vsYours = pairs('classOptimal', 'optimal')
    expect(vsYours.length).toBeGreaterThan(200)
    for (const [cls, yours] of vsYours) expect(cls).toBeLessThanOrEqual(yours)
  })
})

describe('mock race end to end: late join, pit stop, finish and the next session at 30 Hz', () => {
  let run: Run
  let turns = 0
  beforeAll(async () => {
    const series = new MockSeries()
    turns = series.sessionInfo().WeekendInfo.TrackNumTurns
    const start = series.sessionTime
    // The overlay starts late: the series runs on its own until then.
    while (series.sessionTime - start < LATE_JOIN_S) series.step(0.1)
    const config = withRecord(defaultTelemetryConfig())
    config.rules.radar = {
      showIn: { practice: true, qualify: true, race: false },
      hideInPits: false,
      showOnSessionScreen: false
    }
    config.rules.inputs = { ...config.rules.inputs, hideInPits: true }
    run = await runLoop(
      series,
      1 / 30,
      (r) => {
        const next = r.series.sessionIndex >= 1
        return next && r.standings.filter((x) => x.session === 1).length > 100
      },
      config
    )
  }, 20_000)

  /** Session 0 from the player's own finish on. */
  function afterPlayerFinish(): number {
    const i = run.standings.findIndex(
      (x) =>
        x.session === 0 && x.payload.classes[0]?.rows.find((r) => r.isPlayer)?.status === 'finished'
    )
    expect(i).toBeGreaterThan(0)
    return run.standings[i]?.s ?? Infinity
  }

  it('runs without errors and reaches the next session', () => {
    expect(run.logs).toEqual([])
    expect(run.series.sessionIndex).toBe(1)
    expect(run.series.current.log.length).toBeGreaterThan(0)
  })

  it('SR on a late join: the whole session in both incidents and corners', () => {
    const sr = run.standings[0]?.payload.header.safetyRating
    // Incidents at 90, 300 and 960 s: 4 points, all before the overlay started.
    expect(sr?.incidents).toBe(4)
    // ~25 laps driven, seeded from the laps completed.
    expect(sr?.corners).toBeGreaterThan(20 * turns)
  })

  /** The player's stretch on pit road in session 0, from the inputs rule. */
  function pitStretch(): [number, number] {
    const pit = run.hidden.filter((h) => h.widget === 'inputs' && h.session === 0)
    return [pit[0]?.s ?? NaN, pit[1]?.s ?? NaN]
  }

  it('alerts: the caution, the green flag of the restart, white and chequered flags', () => {
    expect(LATE_JOIN_S).toBeLessThan(MOCK_TIMELINE.cautionS)
    const mine = run.alerts.filter((x) => x.session === 0)
    const caution = flagSpans(mine, 'caution')
    expect(caution).toHaveLength(1)
    const [from, to] = caution[0] ?? [NaN, NaN]
    const end = MOCK_TIMELINE.cautionS + MOCK_TIMELINE.cautionLengthS
    expect(from).toBeGreaterThanOrEqual(MOCK_TIMELINE.cautionS)
    expect(from).toBeLessThan(MOCK_TIMELINE.cautionS + 0.2)
    // Racing resumes under green: a start signal, shown for a few seconds, that also ends the
    // caution at once (instead of holding it holdS more).
    const green = flagSpans(mine, 'green')
    expect(green.length).toBeGreaterThanOrEqual(1)
    const [gFrom, gTo] = green[0] ?? [NaN, NaN]
    expect(gFrom).toBeGreaterThanOrEqual(end - 0.2)
    expect(gFrom).toBeLessThan(end + 0.5)
    expect(gTo - gFrom).toBeGreaterThanOrEqual(DEFAULTS.alerts.holdS - 0.2)
    expect(gTo - gFrom).toBeLessThan(10)
    expect(to).toBe(gFrom)
    // Last lap, then the flag.
    const white = flagSpans(mine, 'white')
    const checkered = flagSpans(mine, 'checkered')
    expect(white.length).toBeGreaterThanOrEqual(1)
    expect(checkered.length).toBeGreaterThanOrEqual(1)
    expect(white[0]?.[0] ?? Infinity).toBeLessThan(checkered[0]?.[0] ?? 0)
    // A flag is never listed with the one that says the same, more specifically.
    for (const { payload } of mine) {
      expect(payload.flags.includes('white') && payload.flags.includes('checkered')).toBe(false)
      expect(payload.flags.includes('yellow') && payload.flags.includes('caution')).toBe(false)
    }
  })

  it('alerts: the pit limiter through the stop: OFF, over the limit without and with it, on', () => {
    const stop = run.alerts.filter(
      (x) => x.session === 0 && x.s > MOCK_TIMELINE.playerPitS && x.payload.pitLimiter !== null
    )
    expect(stop.length).toBeGreaterThan(2)
    const states = stop.map((x) => x.payload.pitLimiter)
    // Consecutive repeats removed: the mock's late limiter.
    const seq = states.filter((v, i) => i === 0 || v !== states[i - 1])
    expect(seq).toEqual(['off', 'offSpeeding', 'speeding', 'on'])
    for (const { s, payload } of stop) {
      const at = `t=${s.toFixed(2)}`
      expect(payload.visible, at).toBe(true)
      expect(payload.pitLimitKmh).toBe(MOCK_PIT_SPEED_LIMIT_KMH)
      if (payload.pitLimiter === 'speeding' || payload.pitLimiter === 'offSpeeding') {
        expect(payload.speedKmh, at).toBeGreaterThan(MOCK_PIT_SPEED_LIMIT_KMH + 1)
      } else if (payload.pitLimiter === 'on' || payload.pitLimiter === 'off') {
        expect(payload.speedKmh, at).toBeLessThanOrEqual(MOCK_PIT_SPEED_LIMIT_KMH + 1)
      }
    }
    // The same stretch on pit road as the inputs rule sees.
    const [pitIn, pitOut] = pitStretch()
    expect(stop[0]?.s).toBeGreaterThanOrEqual(pitIn - 0.2)
    expect(stop.at(-1)?.s).toBeLessThanOrEqual(pitOut + 0.2)
    // Back on track the limiter line is gone.
    const last = stop.at(-1)?.s ?? Infinity
    const after = run.alerts.find((x) => x.session === 0 && x.s > last)
    expect(after?.payload.pitLimiter).toBeNull()
  })

  it('traffic: the car stopped ahead; nothing while you are in the pits or after your flag', () => {
    const hazards = entries(run.traffic, 'hazards').filter((x) => x.session === 0)
    const stopped = hazards.filter((x) => x.e.hazard === 'stopped')
    expect(stopped.length).toBeGreaterThan(5)
    for (const { s, e } of hazards) {
      const at = `t=${s.toFixed(2)} #${e.driver.carNumber} ${e.hazard}`
      expect(e.kind).toBe('hazard')
      expect(e.gapS, at).toBeGreaterThan(0)
      expect(e.gapS, at).toBeLessThanOrEqual(DEFAULTS.traffic.hazardS + 0.5)
      // You reach it in the time of the gap, at your pace.
      expect(e.etaS, at).toBe(e.gapS)
    }
    // The second stop of the timeline (the first is before the late join).
    const stopAt = MOCK_TIMELINE.hazardStopsS[1] ?? NaN
    expect(LATE_JOIN_S).toBeLessThan(stopAt)
    expect(stopped[0]?.s).toBeGreaterThan(stopAt)
    expect(stopped[0]?.s).toBeLessThan(stopAt + 300)
    // It comes closer as you approach it.
    const first = stopped[0]?.e.gapS ?? 0
    expect(Math.min(...stopped.map((x) => x.e.gapS))).toBeLessThan(first)

    const [pitIn, pitOut] = pitStretch()
    const inPits = run.traffic.filter((x) => x.session === 0 && x.s > pitIn + 0.3 && x.s < pitOut)
    expect(inPits.every((x) => !x.payload.visible)).toBe(true)
    const tFinish = afterPlayerFinish()
    const finished = run.traffic.filter((x) => x.session === 0 && x.s >= tFinish + 0.3)
    expect(finished.every((x) => !x.payload.visible)).toBe(true)
    // No ETAs under the caution: nobody closes at racing pace.
    const end = MOCK_TIMELINE.cautionS + MOCK_TIMELINE.cautionLengthS
    const underCaution = entries(run.traffic, 'faster').filter(
      (x) => x.session === 0 && x.s > MOCK_TIMELINE.cautionS + 0.3 && x.s < end
    )
    expect(underCaution.every((x) => x.e.etaS === null)).toBe(true)
  })

  it('rules: the radar is hidden all race, the inputs while you are in the pits', () => {
    expect(run.radar).toEqual([])
    const radar = run.hidden.filter((h) => h.widget === 'radar')
    expect(radar).toEqual([
      {
        session: 0,
        s: expect.any(Number),
        widget: 'radar',
        hidden: true,
        reason: 'race'
      }
    ])
    expect(radar[0]?.s).toBeLessThan(LATE_JOIN_S + 1)

    const inputs = run.hidden.filter((h) => h.widget === 'inputs' && h.session === 0)
    const pitIn = inputs[0]
    const pitOut = inputs[1]
    expect(pitIn).toMatchObject({ hidden: true, reason: 'pits' })
    expect(pitIn?.s).toBeGreaterThan(MOCK_TIMELINE.playerPitS)
    expect(pitIn?.s).toBeLessThan(MOCK_TIMELINE.playerPitS + 160)
    expect(pitOut).toMatchObject({ hidden: false, reason: null })
    // Pit lane at the 60 km/h limit plus 24 s in the box.
    const inPits = (pitOut?.s ?? 0) - (pitIn?.s ?? 0)
    expect(inPits).toBeGreaterThan(24)
    expect(inPits).toBeLessThan(120)
    // Not computed (so not sent) in between; sent again at once after.
    const during = run.inputs.filter(
      (x) => x.session === 0 && x.s > (pitIn?.s ?? 0) && x.s < (pitOut?.s ?? 0)
    )
    expect(during).toEqual([])
    expect(run.inputs.some((x) => x.s >= (pitOut?.s ?? 0) && x.s < (pitOut?.s ?? 0) + 0.1)).toBe(
      true
    )
  })

  it('finish: finishers marked, their gaps frozen, laps left 0', () => {
    const tFinish = afterPlayerFinish()
    const finished = run.standings.filter((x) => x.session === 0 && x.s >= tFinish)
    expect(finished.length).toBeGreaterThan(5)
    /** The first gap seen once both cars had finished, per pair. */
    const frozen = new Map<string, GapValue | null>()
    let pairs = 0
    const finalPosition = playerRow(finished[0]!.payload)?.classPosition
    for (const { s, payload } of finished) {
      const rows = playerClass(payload)?.rows ?? []
      const i = rows.findIndex((r) => r.isPlayer)
      const me = rows[i]
      const above = rows[i - 1]
      const leader = rows[0]
      expect(payload.header.lapsRemaining, `t=${s}`).toBe(0)
      expect(me?.status).toBe('finished')
      // Your classification is final: nobody still finishing can take it from you.
      expect(me?.classPosition, `t=${s}`).toBe(finalPosition)
      // A gap to every car ahead, live or frozen: never lost after the flag.
      expect(me?.gapToLeader, `t=${s}`).not.toBeNull()
      expect(me?.interval, `t=${s}`).not.toBeNull()
      // Through the cool-down, pit entries and finishers leaving the world.
      for (const [other, gap] of [
        [leader, me?.gapToLeader],
        [above, me?.interval]
      ] as const) {
        if (other?.status !== 'finished' || gap === undefined) continue
        const k = `${other.carIdx}`
        if (!frozen.has(k)) frozen.set(k, gap)
        expect(gap, `t=${s} vs car ${k}`).toEqual(frozen.get(k))
        pairs++
      }
      // A finisher who left the world is not "disconnected".
      expect(rows.filter((r) => r.status === 'disconnected')).toEqual([])
    }
    expect(pairs).toBeGreaterThan(5)
    // The class leader finished too (a lap more than you: it crossed before the overall leader's
    // flag), and still reads as finished after leaving the world.
    const last = finished.at(-1)?.payload
    expect(last && playerClass(last)?.rows[0]?.status).toBe('finished')
  })

  it('battle: never shown once you have taken the flag', () => {
    const tFinish = afterPlayerFinish()
    const after = run.battle.filter((x) => x.session === 0 && x.s >= tFinish)
    expect(after.every((x) => !x.payload.visible)).toBe(true)
    // It was a live card before the flag.
    expect(run.battle.some((x) => x.session === 0 && x.s < tFinish && x.payload.visible)).toBe(true)
  })

  it('delta: the pit stop does not count, your last lap stays after the flag, the record stays', () => {
    const mine = run.delta.filter((x) => x.session === 0)
    const laps = playerLaps(run.standings, 0)
    expect(checkOwnDelta(mine, laps)).toBeGreaterThanOrEqual(3)
    // On pit road the lap is not valid; at the line the in-lap shows with its real time.
    const [pitIn, pitOut] = pitStretch()
    const inPits = mine.filter((x) => x.s > pitIn + 0.1 && x.s < pitOut && x.payload.visible)
    expect(inPits.length).toBeGreaterThan(5)
    expect(inPits.every((x) => x.payload.lapState !== 'valid')).toBe(true)
    const inLap = mine.find((x) => x.s > pitIn && atLine(x.payload))?.payload
    expect(inLap?.lapState).toBe('invalid')
    expect(inLap?.predictedLap).toBeGreaterThan((inLap?.refLapTime ?? Infinity) + 5)
    // After your flag your last lap stays on show: nothing more to send.
    const tFinish = afterPlayerFinish()
    expect(mine.filter((x) => x.s >= tFinish).length).toBeLessThanOrEqual(1)
    const final = mine.filter((x) => x.s < tFinish).at(-1)?.payload
    expect(final && atLine(final)).toBe(true)
    expect(final?.lapState).toBe('valid')
    expect(Math.abs((final?.predictedLap ?? 0) - (laps.at(-1) ?? NaN))).toBeLessThan(0.01)
    // The next session (same car and track): your record from its first tick, before any lap.
    const record = mine.filter((x) => x.payload.reference === 'pb').at(-1)?.payload.refLapTime
    expect(record).toBeGreaterThan(130)
    const next = run.delta.filter((x) => x.session === 1)
    expect(next[0]?.payload).toMatchObject({ visible: true, reference: 'pb', delta: null })
    expect(next[0]?.payload.refLapTime).toBe(record)
  })

  it('the next session starts over: clock back at 40 min, the player racing again', () => {
    const next = run.standings.filter((x) => x.session === 1)
    expect(next.length).toBeGreaterThan(100)
    for (const { payload } of next) {
      expect(payload.header.timeRemainingS).toBeGreaterThan(2300)
      expect(playerRow(payload)?.status).not.toBe('finished')
    }
    // The radar rule still applies: no radar message about the new session.
    expect(run.hidden.filter((h) => h.widget === 'radar' && h.session === 1)).toEqual([])
  })
})
