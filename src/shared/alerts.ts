/**
 * Alerts widget: the flags that apply to you, the other alerts (wrong way, engine stalled, the
 * engine warning lights, the pit limiter reminder before the pit entry, tow, laps to go, an
 * engine running hot against your own average), most important first, the pit limiter while
 * you are on pit road (on / OFF / over the limit, with it off or on) and your last incident for
 * a few seconds. Runs at 10 Hz; the payload only changes when something shown changes (the speed
 * is 0 off pit road), so SKIP_EMIT drops the rest. The state (when each alert was last seen, the
 * green flag's start, the detectors in notices/, the incident tracker fed on every tick by
 * observe()) lives in one AlertsProvider per telemetry loop.
 */
import { arrayEqual, deepEqual } from './equal'
import { CAUTION_FLAGS, EngineWarning, SessionFlag } from './flags'
import { incidentAlert, incidentAlertEqual } from './incidents/alert'
import { IncidentTracker } from './incidents/tracker'
import { isValidPct, wrapPctDelta } from './lapDist'
import { EngineTrend } from './notices/engineTrend'
import { LAPS_TO_GO, LapsToGo } from './notices/lapsToGo'
import { PitEntryReminder } from './notices/pitEntry'
import { WrongWayDetector } from './notices/wrongWay'
import { finiteOr } from './num'
import type { RaceView } from './race/raceView'
import { resolvePlayerCarIdx } from './sessionInfo'
import { OPTION_SCHEMA } from './settingsSchema'
import { SessionState, TrackLocation } from './telemetry'
import type { TelemetryFrame } from './telemetry'
import type {
  AlertNotice,
  AlertsData,
  AlertsOptions,
  EngineWarningKind,
  FlagKind,
  NoticeKind,
  SessionMeta
} from './types'

export const ALERTS = {
  /** The green flag is a start signal: shown this long at least (s) after it appears. */
  greenMinS: 3,
  /** Over the pit speed limit by more than this (km/h): 'speeding' / 'offSpeeding'. */
  speedingMarginKmh: 1,
  /** No compute for longer than this (s): the widget was off, start the holds over. */
  staleS: 1,
  /** Close behind another car (the engine trend's slipstream hint): at most this far (s). */
  draftGapS: 1,
  /** Moving faster than this (m/s) counts as driving for the engine trend. */
  movingMs: 5
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
  'furled',
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
  furled: SessionFlag.Furled,
  blue: SessionFlag.Blue,
  white: SessionFlag.White,
  checkered: SessionFlag.Checkered,
  green: SessionFlag.Green
}

/**
 * Most important first: the pressures (the engine is about to fail) before the tow and the
 * temperatures (a light that can stay on for laps, and nothing to do about it at once).
 */
export const NOTICE_ORDER = [
  'wrongWay',
  'pitEntry',
  'stalled',
  'oilPressure',
  'fuelPressure',
  'tow',
  'water',
  'oilTemp',
  'lapsToGo',
  'engineTrend'
] as const satisfies readonly NoticeKind[]

export type AlertKind = FlagKind | NoticeKind

/**
 * Flags and the other alerts in one order, most important first: the band shows the first one
 * shown, the chips the next. Each list keeps its own order inside it (FLAG_ORDER, NOTICE_ORDER).
 * The temperature lights come after the yellow and the blue flags: they can stay on for laps,
 * and a flag that asks for something now must not shrink to a chip under them all that time.
 */
export const ALERT_ORDER = [
  'disqualified',
  'wrongWay',
  'black',
  'meatball',
  'red',
  'pitEntry',
  'stalled',
  'caution',
  'oilPressure',
  'fuelPressure',
  'tow',
  'yellow',
  'debris',
  'furled',
  'blue',
  'water',
  'oilTemp',
  'white',
  'lapsToGo',
  'checkered',
  'green',
  'engineTrend'
] as const satisfies readonly AlertKind[]

/** EngineWarnings bit of each warning light. */
export const ENGINE_WARNING_BITS: Readonly<Record<EngineWarningKind, number>> = {
  oilPressure: EngineWarning.OilPressure,
  water: EngineWarning.WaterTemp,
  oilTemp: EngineWarning.OilTemp,
  fuelPressure: EngineWarning.FuelPressure
}
const ENGINE_WARNINGS = Object.keys(ENGINE_WARNING_BITS) as EngineWarningKind[]

/** The pressures drop with the engine: not shown while it is stalled. */
const ENGINE_OFF_HIDES: ReadonlySet<EngineWarningKind> = new Set(['oilPressure', 'fuelPressure'])

/** The on/off options of AlertsOptions. */
export type AlertToggle = {
  [K in keyof AlertsOptions]: AlertsOptions[K] extends boolean ? K : never
}[keyof AlertsOptions]

/** The option that shows each notice. */
export const NOTICE_OPTION: Readonly<Record<NoticeKind, AlertToggle>> = {
  wrongWay: 'showWrongWay',
  pitEntry: 'showPitEntry',
  stalled: 'showStalled',
  oilPressure: 'showEngineWarnings',
  water: 'showEngineWarnings',
  oilTemp: 'showEngineWarnings',
  fuelPressure: 'showEngineWarnings',
  tow: 'showTow',
  lapsToGo: 'showLapsToGo',
  engineTrend: 'showEngineTrend'
}

/** Flags with their own option besides showFlags. */
export const FLAG_OPTION: Readonly<Partial<Record<FlagKind, AlertToggle>>> = {
  furled: 'showFurled',
  blue: 'showBlue'
}

/** Every on/off option, in the schema's (settings page) order. */
export const ALERT_TOGGLES: readonly AlertToggle[] = (
  Object.keys(OPTION_SCHEMA.alerts) as (keyof AlertsOptions)[]
).filter((k): k is AlertToggle => OPTION_SCHEMA.alerts[k].kind === 'bool')

/** Options that only refine another one: they do nothing while it is off (greyed out then). */
export const OPTION_PARENT: Readonly<Partial<Record<AlertToggle, AlertToggle>>> = {
  showBlue: 'showFlags',
  showFurled: 'showFlags',
  showPitOverspeed: 'showPitLimiter'
}

/**
 * No option that shows something by itself is on, so the widget never shows: an option that
 * refines another (OPTION_PARENT) counts only with that one on.
 */
export function showsNothing(o: Readonly<Pick<AlertsOptions, AlertToggle>>): boolean {
  return ALERT_TOGGLES.every((k) => {
    const parent = OPTION_PARENT[k]
    return !o[k] || (parent !== undefined && !o[parent])
  })
}

/**
 * Notices held holdS like the flags, so a flicker is readable. The others follow their own
 * timing: the tow counts down, the reminder ends on pit road, laps to go and the trend last
 * long enough by themselves.
 */
const HELD: ReadonlySet<NoticeKind> = new Set<NoticeKind>([
  'wrongWay',
  'stalled',
  'oilPressure',
  'water',
  'oilTemp',
  'fuelPressure'
])

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

/**
 * On pit road: limiter on / off / off and over the limit / on but over the limit; null off pit
 * road or unknown. `offOverspeed` false: over the limit with the limiter off is plain 'off'.
 */
export function pitLimiterState(
  onPitRoad: boolean,
  warnings: number | undefined,
  speedKmh: number,
  limitKmh: number | null,
  offOverspeed = true
): AlertsData['pitLimiter'] {
  // Without EngineWarnings there is no telling: never a false "OFF".
  if (!onPitRoad || warnings === undefined || !Number.isFinite(warnings)) return null
  const over = limitKmh !== null && speedKmh > limitKmh + ALERTS.speedingMarginKmh
  // Bit fields arrive as signed Int32.
  if (((warnings >>> 0) & EngineWarning.PitSpeedLimiter) === 0) {
    return over && offOverspeed ? 'offSpeeding' : 'off'
  }
  return over ? 'speeding' : 'on'
}

/** Whether a car is within ALERTS.draftGapS ahead of the player on track. */
function closeBehind(frame: TelemetryFrame, race: RaceView, player: number): boolean {
  const me = race.car(player)
  const pace = me?.pace ?? null
  const myPct = frame.CarIdxLapDistPct[player]
  if (!me || !me.inWorld || me.inPits || pace === null || !(pace > 0) || !isValidPct(myPct)) {
    return false
  }
  // race.cars() leaves out the pace car and spectators.
  for (const car of race.cars()) {
    if (car.carIdx === player || !car.inWorld || car.inPits) continue
    const pct = frame.CarIdxLapDistPct[car.carIdx]
    if (!isValidPct(pct)) continue
    const ahead = wrapPctDelta(pct, myPct)
    if (ahead > 0 && ahead * pace <= ALERTS.draftGapS) return true
  }
  return false
}

/**
 * One per telemetry loop. compute() runs at the widget rate, observe() on every tick; reset()
 * on a reconnect or a new session (a gap in the computes only starts the holds over: the
 * laps-to-go marks already shown, the engine reference and the incidents are the session's).
 */
export class AlertsProvider {
  /** SessionTime each flag was last seen, by FLAG_ORDER index (NaN = not seen). */
  private readonly lastSeen = new Array<number>(FLAG_ORDER.length).fill(Number.NaN)
  /** Each HELD notice as last seen, and when (SessionTime). */
  private readonly noticeSeen = new Map<NoticeKind, { at: number; notice: AlertNotice }>()
  /** The green bit last tick, null right after a (re)start: the first tick sets no edge. */
  private greenWas: boolean | null = null
  private greenSince = Number.NaN
  private lastT = Number.NaN
  private readonly wrongWay = new WrongWayDetector()
  private readonly pitEntry = new PitEntryReminder()
  private readonly lapsToGo = new LapsToGo()
  private readonly engineTrend = new EngineTrend()
  private readonly incidents = new IncidentTracker()

  reset(): void {
    this.resume()
    this.lapsToGo.reset()
    this.engineTrend.reset()
    this.incidents.reset()
  }

  /** Every tick, whatever the widget's rate or rules: an incident's report may last one tick. */
  observe(frame: TelemetryFrame, session: SessionMeta, race: RaceView): void {
    this.incidents.observe(frame, session, race)
  }

  /**
   * After a gap in the computes or the clock going back: nothing held is valid. The incident
   * tracker follows every tick, computed or not, so it is not touched.
   */
  private resume(): void {
    this.lastSeen.fill(Number.NaN)
    this.noticeSeen.clear()
    this.greenWas = null
    this.greenSince = Number.NaN
    this.lastT = Number.NaN
    this.wrongWay.resume()
    this.pitEntry.resume()
    this.lapsToGo.resume()
    this.engineTrend.resume()
  }

  compute(
    frame: TelemetryFrame,
    session: SessionMeta,
    race: RaceView,
    opts: AlertsOptions
  ): AlertsData {
    const now = finiteOr(frame.SessionTime[0], Number.NaN)
    // The clock went back (a replay) or the widget was off for a while: nothing held is valid.
    if (!(now >= this.lastT && now - this.lastT <= ALERTS.staleS)) this.resume()
    this.lastT = now
    const holdS = Math.max(0, finiteOr(opts.holdS, 0))

    const player = resolvePlayerCarIdx(frame, session)
    const flags = this.flags(frame, player, now, holdS, opts)

    const speedKmh = Math.round(Math.abs(finiteOr(frame.Speed[0], 0)) * 3.6)
    const limit = session.pitSpeedLimitKmh
    const limitKmh = limit !== null && Number.isFinite(limit) && limit > 0 ? limit : null
    const onPitRoad =
      frame.OnPitRoad[0] ?? (player >= 0 ? frame.CarIdxOnPitRoad[player] : undefined) ?? false
    const pitLimiter = opts.showPitLimiter
      ? pitLimiterState(
          onPitRoad,
          frame.EngineWarnings[0],
          speedKmh,
          limitKmh,
          opts.showPitOverspeed
        )
      : null
    const notices = this.notices(frame, session, race, player, onPitRoad, now, holdS, opts)
    const incident = opts.showIncidents ? incidentAlert(this.incidents.latest, now, holdS) : null

    return {
      visible: flags.length > 0 || notices.length > 0 || pitLimiter !== null || incident !== null,
      flags,
      notices,
      pitLimiter,
      // Only shown with the limiter: off pit road a changing speed would re-send at 10 Hz.
      speedKmh: pitLimiter !== null ? speedKmh : 0,
      pitLimitKmh: limitKmh,
      incident
    }
  }

  private flags(
    frame: TelemetryFrame,
    player: number,
    now: number,
    holdS: number,
    opts: AlertsOptions
  ): FlagKind[] {
    // `|` turns a missing or NaN value into 0; bit fields arrive as signed Int32.
    const bits =
      ((frame.SessionFlags[0] ?? 0) |
        (player >= 0 ? (frame.CarIdxSessionFlags[player] ?? 0) : 0)) >>>
      0

    // The green flag counts from the tick its bit appears (a start or a restart) and stays for a
    // while even if the bit is only a pulse; a caution or a red flag ends it.
    const green = (bits & SessionFlag.Green) !== 0
    if (green && this.greenWas === false) this.greenSince = now
    if ((bits & (CAUTION_FLAGS | SessionFlag.Red)) !== 0) this.greenSince = Number.NaN
    this.greenWas = green

    const flags: FlagKind[] = []
    if (!opts.showFlags) return flags
    const greenS = Math.max(holdS, ALERTS.greenMinS)
    for (let i = 0; i < FLAG_ORDER.length; i++) {
      const kind = FLAG_ORDER[i] as FlagKind
      const own = FLAG_OPTION[kind]
      if (own !== undefined && !opts[own]) continue
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
    return flags
  }

  /**
   * The notices, in NOTICE_ORDER. Every detector runs whatever the options say, so one turned on
   * mid-session already knows the session (the engine reference, the marks shown).
   */
  private notices(
    frame: TelemetryFrame,
    session: SessionMeta,
    race: RaceView,
    player: number,
    onPitRoad: boolean,
    now: number,
    holdS: number,
    opts: AlertsOptions
  ): AlertNotice[] {
    const raw = this.detect(frame, session, race, player, onPitRoad, now, holdS)
    const out: AlertNotice[] = []
    for (const kind of NOTICE_ORDER) {
      if (!opts[NOTICE_OPTION[kind]]) continue
      const notice = raw.get(kind)
      if (!HELD.has(kind)) {
        if (notice) out.push(notice)
        continue
      }
      if (notice) this.noticeSeen.set(kind, { at: now, notice })
      const seen = this.noticeSeen.get(kind)
      if (seen && (now - seen.at < holdS || seen.at === now)) out.push(seen.notice)
    }
    return out
  }

  /** Each notice that is on right now, before options and holds. */
  private detect(
    frame: TelemetryFrame,
    session: SessionMeta,
    race: RaceView,
    player: number,
    onPitRoad: boolean,
    now: number,
    holdS: number
  ): Map<NoticeKind, AlertNotice> {
    const on = new Map<NoticeKind, AlertNotice>()
    const add = (n: AlertNotice): void => {
      on.set(n.kind, n)
    }
    const raw = frame.EngineWarnings[0]
    const warnings = raw !== undefined && Number.isFinite(raw) ? raw >>> 0 : null
    const inCar = frame.IsOnTrack[0] === true
    const speedMs = Math.abs(finiteOr(frame.Speed[0], 0))
    const surface = frame.PlayerTrackSurface[0]

    const stalled = inCar && warnings !== null && (warnings & EngineWarning.Stalled) !== 0
    if (stalled) add({ kind: 'stalled' })
    let warning = false
    if (inCar && warnings !== null) {
      for (const kind of ENGINE_WARNINGS) {
        if ((warnings & ENGINE_WARNING_BITS[kind]) === 0) continue
        warning = true
        if (!(stalled && ENGINE_OFF_HIDES.has(kind))) add({ kind })
      }
    }

    const limiterOn = warnings === null ? null : (warnings & EngineWarning.PitSpeedLimiter) !== 0
    if (this.pitEntry.update(surface, onPitRoad, limiterOn)) add({ kind: 'pitEntry' })

    const wrong = this.wrongWay.update({
      pct: frame.LapDistPct[0] ?? (player >= 0 ? frame.CarIdxLapDistPct[player] : undefined),
      speedMs,
      gear: finiteOr(frame.Gear[0], 0),
      onPitRoad,
      inCar,
      trackLengthM: session.trackLengthM
    })
    if (wrong) add({ kind: 'wrongWay' })

    const towS = finiteOr(frame.PlayerCarTowTime[0], 0)
    if (towS > 0) add({ kind: 'tow', seconds: Math.ceil(towS) })

    const state = finiteOr(frame.SessionState[0], Number.NaN)
    const left =
      race.racing && player >= 0 && state < SessionState.Checkered
        ? race.lapsRemaining(player)
        : null
    const laps = this.lapsToGo.update(now, left, Math.max(holdS, LAPS_TO_GO.showS))
    if (laps !== null) add({ kind: 'lapsToGo', laps })

    const trend = this.engineTrend.update({
      now,
      lapsCompleted:
        player >= 0 ? finiteOr(frame.CarIdxLapCompleted[player], Number.NaN) : Number.NaN,
      water: finiteOr(frame.WaterTemp[0], Number.NaN),
      oil: finiteOr(frame.OilTemp[0], Number.NaN),
      driving:
        inCar && !onPitRoad && surface !== TrackLocation.InPitStall && speedMs > ALERTS.movingMs,
      closeBehind: player >= 0 && closeBehind(frame, race, player),
      warning,
      lapClean: (lap) => race.car(player)?.laps.find((l) => l.lap === lap)?.clean ?? null
    })
    if (trend) add(trend)
    return on
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
    arrayEqual(a.notices, b.notices, deepEqual) &&
    incidentAlertEqual(a.incident, b.incident)
  )
}
