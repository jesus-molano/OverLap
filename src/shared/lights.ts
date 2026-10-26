/**
 * Warning lights widget (Testigos): the engine's lights as a dashboard strip, each lit by its
 * severity (LightLevel), from the state the alerts band reads too (notices/engine.ts), so both
 * follow the same rules: oil and fuel pressure, a stall, mandatory and optional repairs with the
 * time they take, the water and oil temperature lights (orange) or, before them, the trend above
 * your own average (yellow), and the limiters for those who want them. Runs at 10 Hz; the payload
 * only changes when a light, a reading shown or a repair time changes, so SKIP_EMIT drops the
 * rest. A flickering engine light stays lit LIGHTS.holdS, so it can be read; none is held while
 * the engine's lights are quiet (towed, in the box...). Out of the car it sends nothing to show.
 */
import { arrayEqual, deepEqual } from './equal'
import { EngineMonitor, type EngineState } from './notices/engine'
import type { TrendNotice } from './notices/engineTrend'
import { finiteOr } from './num'
import type { RaceView } from './race/raceView'
import type { TelemetryFrame } from './telemetry'
import type {
  LightKind,
  LightLevel,
  LightReading,
  LightsData,
  LightsOptions,
  SessionMeta
} from './types'

export const LIGHTS = {
  /** A lit engine light stays lit at least this long (s), so a flicker is readable. */
  holdS: 1,
  /** No compute for longer than this (s): the widget was off, nothing held is valid. */
  staleS: 1
} as const

/** The strip's order: the critical lights first, then the repairs, the temperatures, the limiters. */
export const LIGHT_ORDER = [
  'oilPressure',
  'fuelPressure',
  'stalled',
  'repair',
  'repairOptional',
  'water',
  'oilTemp',
  'pitLimiter',
  'revLimiter'
] as const satisfies readonly LightKind[]

/** The on/off options of LightsOptions. */
export type LightToggle = {
  [K in keyof LightsOptions]: LightsOptions[K] extends boolean ? K : never
}[keyof LightsOptions]

/** The option that shows each light. */
export const LIGHT_OPTION: Readonly<Record<LightKind, LightToggle>> = {
  oilPressure: 'showOilPressure',
  fuelPressure: 'showFuelPressure',
  stalled: 'showStalled',
  repair: 'showRepair',
  repairOptional: 'showRepairOptional',
  water: 'showWater',
  oilTemp: 'showOilTemp',
  pitLimiter: 'showPitLimiter',
  revLimiter: 'showRevLimiter'
}

/** The level of each light when its own bit is on (the trend is 'caution', below 'warn'). */
export const LIT_LEVEL: Readonly<Record<LightKind, Exclude<LightLevel, 'off' | 'caution'>>> = {
  oilPressure: 'alarm',
  fuelPressure: 'alarm',
  stalled: 'alarm',
  repair: 'alarm',
  repairOptional: 'warn',
  water: 'warn',
  oilTemp: 'warn',
  pitLimiter: 'info',
  revLimiter: 'info'
}

/**
 * Held after a flicker: the engine's own lights. The repairs are steady until repaired; the
 * limiters are a state the driver sets, read at once.
 */
const HELD: ReadonlySet<LightKind> = new Set<LightKind>([
  'oilPressure',
  'fuelPressure',
  'stalled',
  'water',
  'oilTemp'
])

/** Whether the engine's state has a light on now, before the hold. */
function isOn(e: EngineState, kind: LightKind): boolean {
  return e[kind]
}

/** The trend of a temperature light's fluid; null for the other lights. */
function trendOf(e: EngineState, kind: LightKind): TrendNotice | null {
  if (kind === 'water') return e.waterTrend
  if (kind === 'oilTemp') return e.oilTrend
  return null
}

/** The reading of a temperature light (°C); null for the other lights or unknown. */
function tempOf(e: EngineState, kind: LightKind): number | null {
  if (kind === 'water') return e.waterC
  if (kind === 'oilTemp') return e.oilC
  return null
}

/** How long the repairs of a repair light take (s); null for the other lights or none. */
function secondsOf(e: EngineState, kind: LightKind): number | null {
  if (kind === 'repair') return e.repairS
  if (kind === 'repairOptional') return e.optRepairS
  return null
}

const NOTHING: LightsData = Object.freeze({ visible: false, lights: Object.freeze([]) as [] })

/**
 * One per telemetry loop, sharing the loop's EngineMonitor with the alerts band (or, built
 * alone, with one of its own that it feeds). compute() runs at the widget rate; observe() on
 * every tick; reset() on a reconnect or a new session.
 */
export class LightsProvider {
  private readonly engine: EngineMonitor
  /** Built without a shared monitor: this one feeds and resets its own. */
  private readonly ownsEngine: boolean
  /** SessionTime each held light was last seen on. */
  private readonly seenAt = new Map<LightKind, number>()
  private lastT = Number.NaN

  constructor(engine?: EngineMonitor) {
    this.ownsEngine = engine === undefined
    this.engine = engine ?? new EngineMonitor()
  }

  reset(): void {
    this.resume()
    if (this.ownsEngine) this.engine.reset()
  }

  /** Every tick (only feeds a monitor of its own: a shared one is fed by its owner). */
  observe(frame: TelemetryFrame): void {
    if (this.ownsEngine) this.engine.observe(frame)
  }

  private resume(): void {
    this.seenAt.clear()
    this.lastT = Number.NaN
  }

  compute(
    frame: TelemetryFrame,
    session: SessionMeta,
    race: RaceView,
    opts: LightsOptions
  ): LightsData {
    const now = finiteOr(frame.SessionTime[0], Number.NaN)
    // The clock went back (a replay) or the widget was off for a while: nothing held is valid.
    if (!(now >= this.lastT && now - this.lastT <= LIGHTS.staleS)) this.resume()
    this.lastT = now
    const e = this.engine.read(frame, session, race)
    if (!e.inCar) {
      this.seenAt.clear()
      return NOTHING
    }
    const lights: LightReading[] = []
    for (const kind of LIGHT_ORDER) {
      // Followed whatever the options say, so a light turned on mid-flicker is already held.
      const on = this.held(kind, isOn(e, kind), now, e.quiet)
      if (!opts[LIGHT_OPTION[kind]]) continue
      const light = reading(e, kind, on, opts)
      if (light.level === 'off' && opts.onlyWhenLit) continue
      lights.push(light)
    }
    return lights.length === 0 ? NOTHING : { visible: true, lights }
  }

  /** `on` now, or within LIGHTS.holdS of when it last was (held lights only, never quiet). */
  private held(kind: LightKind, on: boolean, now: number, quiet: boolean): boolean {
    if (!HELD.has(kind)) return on
    // A light held from before the tow or the reset says nothing about the engine now.
    if (quiet) {
      this.seenAt.delete(kind)
      return false
    }
    if (on) {
      this.seenAt.set(kind, now)
      return true
    }
    const at = this.seenAt.get(kind)
    return at !== undefined && now - at >= 0 && now - at < LIGHTS.holdS
  }
}

/** One light as sent: its level, and the readings its options show. */
function reading(e: EngineState, kind: LightKind, on: boolean, opts: LightsOptions): LightReading {
  const trend = opts.showTrend ? trendOf(e, kind) : null
  const level: LightLevel = on ? LIT_LEVEL[kind] : trend !== null ? 'caution' : 'off'
  const temp = opts.showTemps ? tempOf(e, kind) : null
  const seconds = on && opts.showRepairTime ? secondsOf(e, kind) : null
  return {
    kind,
    level,
    tempC: temp === null ? null : Math.round(temp),
    riseC: trend === null ? null : trend.deltaC,
    draft: trend?.draft ?? false,
    seconds: seconds === null ? null : Math.ceil(seconds)
  }
}

/** Structural equality of two payloads (for SKIP_EMIT). */
export function lightsEqual(a: LightsData, b: LightsData): boolean {
  return a.visible === b.visible && arrayEqual(a.lights, b.lights, deepEqual)
}
