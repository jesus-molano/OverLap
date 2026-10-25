/**
 * Alerts widget: the flags that apply to you, most important first, the pit limiter while
 * you are on pit road (on / OFF / over the limit) and your last incident for a few seconds.
 * Runs at 10 Hz; the payload only changes when something shown changes (the speed is 0 off pit
 * road), so SKIP_EMIT drops the rest. The state (when each flag was last seen, the green flag's
 * start, the incident tracker fed on every tick by observe()) lives in one AlertsProvider per
 * telemetry loop.
 */
import { arrayEqual } from './equal'
import { CAUTION_FLAGS, EngineWarning, SessionFlag } from './flags'
import { incidentAlert, incidentAlertEqual } from './incidents/alert'
import { IncidentTracker } from './incidents/tracker'
import { finiteOr } from './num'
import type { RaceView } from './race/raceView'
import { resolvePlayerCarIdx } from './sessionInfo'
import type { TelemetryFrame } from './telemetry'
import type { AlertsData, AlertsOptions, FlagKind, SessionMeta } from './types'

export const ALERTS = {
  /** The green flag is a start signal: shown this long at least (s) after it appears. */
  greenMinS: 3,
  /** Over the pit speed limit by more than this (km/h) with the limiter on: 'speeding'. */
  speedingMarginKmh: 1,
  /** No compute for longer than this (s): the widget was off, start the holds over. */
  staleS: 1
} as const

/** Most important first: the order of the FlagKind union. */
export const FLAG_ORDER = [
  'disqualified',
  'black',
  'meatball',
  'red',
  'caution',
  'yellow',
  'debris',
  'blue',
  'white',
  'checkered',
  'green'
] as const satisfies readonly FlagKind[]

/** irsdk_Flags bits of each flag (CarIdxSessionFlags of the player | SessionFlags). */
export const FLAG_BITS: Readonly<Record<FlagKind, number>> = {
  disqualified: SessionFlag.Disqualify,
  black: SessionFlag.Black,
  meatball: SessionFlag.Repair,
  red: SessionFlag.Red,
  caution: CAUTION_FLAGS,
  yellow: SessionFlag.Yellow | SessionFlag.YellowWaving,
  debris: SessionFlag.Debris,
  blue: SessionFlag.Blue,
  white: SessionFlag.White,
  checkered: SessionFlag.Checkered,
  green: SessionFlag.Green
}

const GREEN = FLAG_ORDER.indexOf('green')

/**
 * A flag the list leaves out while another one says the same or ends it: a local yellow under a
 * full-course caution, the white flag once the chequered is out, a caution or a red flag still
 * held when the green of the restart comes out (green only shows once their bits are gone).
 */
const COVERED_BY: Partial<Record<FlagKind, FlagKind>> = {
  yellow: 'caution',
  white: 'checkered',
  caution: 'green',
  red: 'green'
}

/** On pit road: limiter on / off / on but over the limit; null off pit road or unknown. */
export function pitLimiterState(
  onPitRoad: boolean,
  warnings: number | undefined,
  speedKmh: number,
  limitKmh: number | null
): AlertsData['pitLimiter'] {
  // Without EngineWarnings there is no telling: never a false "OFF".
  if (!onPitRoad || warnings === undefined || !Number.isFinite(warnings)) return null
  if ((warnings & EngineWarning.PitSpeedLimiter) === 0) return 'off'
  return limitKmh !== null && speedKmh > limitKmh + ALERTS.speedingMarginKmh ? 'speeding' : 'on'
}

/**
 * One per telemetry loop. compute() runs at the widget rate, observe() on every tick; reset()
 * on a reconnect or a new session.
 */
export class AlertsProvider {
  /** SessionTime each flag was last seen, by FLAG_ORDER index (NaN = not seen). */
  private readonly lastSeen = new Array<number>(FLAG_ORDER.length).fill(Number.NaN)
  /** The green bit last tick, null right after a (re)start: the first tick sets no edge. */
  private greenWas: boolean | null = null
  private greenSince = Number.NaN
  private lastT = Number.NaN
  private readonly incidents = new IncidentTracker()

  reset(): void {
    this.resetHolds()
    this.incidents.reset()
  }

  /** Every tick, whatever the widget's rate or rules: an incident's report may last one tick. */
  observe(frame: TelemetryFrame, session: SessionMeta, race: RaceView): void {
    this.incidents.observe(frame, session, race)
  }

  /** The flags' holds only: the incident tracker follows every tick, computed or not. */
  private resetHolds(): void {
    this.lastSeen.fill(Number.NaN)
    this.greenWas = null
    this.greenSince = Number.NaN
    this.lastT = Number.NaN
  }

  compute(
    frame: TelemetryFrame,
    session: SessionMeta,
    _race: RaceView,
    opts: AlertsOptions
  ): AlertsData {
    const now = finiteOr(frame.SessionTime[0], Number.NaN)
    // The clock went back (a replay) or the widget was off for a while: nothing held is valid.
    if (!(now >= this.lastT && now - this.lastT <= ALERTS.staleS)) this.resetHolds()
    this.lastT = now

    const player = resolvePlayerCarIdx(frame, session)
    // `|` turns a missing or NaN value into 0.
    const bits =
      (frame.SessionFlags[0] ?? 0) | (player >= 0 ? (frame.CarIdxSessionFlags[player] ?? 0) : 0)

    // The green flag counts from the tick its bit appears (a start or a restart) and stays for a
    // while even if the bit is only a pulse; a caution or a red flag ends it.
    const green = (bits & SessionFlag.Green) !== 0
    if (green && this.greenWas === false) this.greenSince = now
    if ((bits & (CAUTION_FLAGS | SessionFlag.Red)) !== 0) this.greenSince = Number.NaN
    this.greenWas = green

    const holdS = Math.max(0, finiteOr(opts.holdS, 0))
    const flags: FlagKind[] = []
    if (opts.showFlags) {
      const greenS = Math.max(holdS, ALERTS.greenMinS)
      for (let i = 0; i < FLAG_ORDER.length; i++) {
        const kind = FLAG_ORDER[i] as FlagKind
        if (kind === 'blue' && !opts.showBlue) continue
        let on: boolean
        if (i === GREEN) {
          on = now - this.greenSince < greenS
        } else {
          if ((bits & FLAG_BITS[kind]) !== 0) this.lastSeen[i] = now
          const seen = this.lastSeen[i] ?? Number.NaN
          on = now - seen < holdS || seen === now
        }
        if (on) flags.push(kind)
      }
      for (let i = flags.length - 1; i >= 0; i--) {
        const by = COVERED_BY[flags[i] as FlagKind]
        if (by !== undefined && flags.includes(by)) flags.splice(i, 1)
      }
    }

    const speedKmh = Math.round(Math.abs(finiteOr(frame.Speed[0], 0)) * 3.6)
    const limit = session.pitSpeedLimitKmh
    const limitKmh = limit !== null && Number.isFinite(limit) && limit > 0 ? limit : null
    const onPitRoad =
      frame.OnPitRoad[0] ?? (player >= 0 ? frame.CarIdxOnPitRoad[player] : undefined) ?? false
    const pitLimiter = opts.showPitLimiter
      ? pitLimiterState(onPitRoad, frame.EngineWarnings[0], speedKmh, limitKmh)
      : null

    const incident = opts.showIncidents ? incidentAlert(this.incidents.latest, now, holdS) : null

    return {
      visible: flags.length > 0 || pitLimiter !== null || incident !== null,
      flags,
      pitLimiter,
      // Only shown with the limiter: off pit road a changing speed would re-send at 10 Hz.
      speedKmh: pitLimiter !== null ? speedKmh : 0,
      pitLimitKmh: limitKmh,
      incident
    }
  }
}

/** Structural equality of two payloads (for SKIP_EMIT). */
export function alertsEqual(a: AlertsData, b: AlertsData): boolean {
  return (
    a.visible === b.visible &&
    a.pitLimiter === b.pitLimiter &&
    a.speedKmh === b.speedKmh &&
    a.pitLimitKmh === b.pitLimitKmh &&
    arrayEqual(a.flags, b.flags) &&
    incidentAlertEqual(a.incident, b.incident)
  )
}
