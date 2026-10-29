/**
 * Alerts widget: the flags that apply to you, the other alerts (tow, wrong way, mandatory repairs,
 * engine stalled, low oil pressure, the pit limiter reminder before the pit entry, the stop and
 * the low fuel of the fuel plan in notices/fuel.ts, laps to go), most important first, the pit
 * limiter while you are on pit road (on / OFF / over the limit, with it off or on) and your last
 * incident for a few seconds. Runs at 10 Hz; the payload only changes when something shown
 * changes (the speed is 0 off pit road), so SKIP_EMIT drops the rest. The state (when each alert
 * was last seen, the green and chequered flags' start, the detectors in notices/ and the incident
 * tracker, fed on every tick by observe()) lives in one AlertsProvider per telemetry loop.
 *
 * Out of the car no flag is shown (the replay, the session screen, the garage: nothing there is
 * yours to act on). Of the engine's lights the band keeps the critical ones; the warning lights
 * strip (lights.ts) has them all, the temperatures and their trend included. Both read the loop's
 * EngineMonitor (notices/engine.ts), so both follow the same rules: quiet while towed, in the
 * box, out of the world and as you get in the car, the pressure only with the engine running.
 */
import { arrayEqual, deepEqual } from './equal'
import { CAUTION_FLAGS, EngineWarning, SessionFlag } from './flags'
import { incidentAlert, incidentAlertEqual } from './incidents/alert'
import { IncidentTracker } from './incidents/tracker'
import { EngineMonitor, type EngineState } from './notices/engine'
import { fuelNotices, type FuelAlertInput } from './notices/fuel'
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
  FlagKind,
  NoticeKind,
  SessionMeta
} from './types'

export const ALERTS = {
  /** The green flag is a start signal: shown this long at least (s) after it appears. */
  greenMinS: 3,
  /**
   * The chequered flag is shown this long at least (s) after it appears: its bit stays on until
   * the session changes, minutes later.
   */
  checkeredMinS: 10,
  /** Over the pit speed limit by more than this (km/h): 'speeding' / 'offSpeeding'. */
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
 * Most important first: the tow (being towed, nothing else can be acted on), damage, then the
 * stall and the oil pressure (the engine is about to fail). The stop the fuel needs this lap
 * comes right after the pressure, the low fuel after it (neither is on while towed).
 */
export const NOTICE_ORDER = [
  'tow',
  'wrongWay',
  'damage',
  'pitEntry',
  'stalled',
  'oilPressure',
  'boxThisLap',
  'fuelLow',
  'lapsToGo'
] as const satisfies readonly NoticeKind[]

export type AlertKind = FlagKind | NoticeKind

/**
 * Flags and the other alerts in one order, most important first: the band shows the first one
 * shown, the chips the next. Each list keeps its own order inside it (FLAG_ORDER, NOTICE_ORDER).
 * The tow countdown comes before the meatball it is taking you in for. The low fuel comes after
 * the yellow and the blue flags: it can stay on for laps, and a flag that asks for something now
 * must not shrink to a chip under it all that time; the stop the fuel needs this lap does not
 * wait behind a passing flag.
 */
export const ALERT_ORDER = [
  'disqualified',
  'tow',
  'wrongWay',
  'black',
  'meatball',
  'red',
  'damage',
  'pitEntry',
  'stalled',
  'caution',
  'oilPressure',
  'boxThisLap',
  'yellow',
  'debris',
  'furled',
  'blue',
  'fuelLow',
  'white',
  'lapsToGo',
  'checkered',
  'green'
] as const satisfies readonly AlertKind[]

/** The notices read from the engine's lights: none while they are quiet (EngineState.quiet). */
const ENGINE_NOTICES: ReadonlySet<NoticeKind> = new Set<NoticeKind>(['stalled', 'oilPressure'])

/** The on/off options of AlertsOptions. */
export type AlertToggle = {
  [K in keyof AlertsOptions]: AlertsOptions[K] extends boolean ? K : never
}[keyof AlertsOptions]

/** The option that shows each notice. */
export const NOTICE_OPTION: Readonly<Record<NoticeKind, AlertToggle>> = {
  wrongWay: 'showWrongWay',
  pitEntry: 'showPitEntry',
  stalled: 'showStalled',
  oilPressure: 'showOilPressure',
  tow: 'showTow',
  damage: 'showDamage',
  boxThisLap: 'showBoxThisLap',
  fuelLow: 'showFuelLow',
  lapsToGo: 'showLapsToGo'
}

/** Flags with their own option besides showFlags. */
export const FLAG_OPTION: Readonly<Partial<Record<FlagKind, AlertToggle>>> = {
  furled: 'showFurled',
  blue: 'showBlue'
}

/**
 * The switch that shows an alert of `kind` (its eye in Avisos › Personalizar, R12): a notice's
 * own, the blue and furled flags' own, and the flags' for every other flag.
 */
export function alertToggleOf(kind: AlertKind): AlertToggle {
  const own =
    (NOTICE_OPTION as Readonly<Partial<Record<AlertKind, AlertToggle>>>)[kind] ??
    (FLAG_OPTION as Readonly<Partial<Record<AlertKind, AlertToggle>>>)[kind]
  return own ?? 'showFlags'
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
 * timing: the tow counts down, damage lasts until repaired, the reminder ends on pit road, laps
 * to go last long enough by themselves.
 */
const HELD: ReadonlySet<NoticeKind> = new Set<NoticeKind>(['wrongWay', 'stalled', 'oilPressure'])

const GREEN = FLAG_ORDER.indexOf('green')
const CHECKERED = FLAG_ORDER.indexOf('checkered')
const WHITE = FLAG_ORDER.indexOf('white')

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

/**
 * One per telemetry loop, sharing the loop's EngineMonitor with the warning lights (or, built
 * alone, with one of its own that it feeds and resets). compute() runs at the widget rate,
 * observe() on every tick; reset() on a reconnect or a new session (a gap in the computes only
 * starts the holds over: the laps-to-go marks already shown and the incidents are the session's).
 */
export class AlertsProvider {
  /** SessionTime each flag was last seen, by FLAG_ORDER index (NaN = not seen). */
  private readonly lastSeen = new Array<number>(FLAG_ORDER.length).fill(Number.NaN)
  /** Each HELD notice as last seen, and when (SessionTime). */
  private readonly noticeSeen = new Map<NoticeKind, { at: number; notice: AlertNotice }>()
  /** The green bit last tick, null right after a (re)start: the first tick sets no edge. */
  private greenWas: boolean | null = null
  private greenSince = Number.NaN
  /** The same for the chequered flag. */
  private checkeredWas: boolean | null = null
  private checkeredSince = Number.NaN
  private lastT = Number.NaN
  private readonly engine: EngineMonitor
  /** Built without a shared monitor: this one feeds and resets its own. */
  private readonly ownsEngine: boolean
  private readonly wrongWay = new WrongWayDetector()
  private readonly pitEntry = new PitEntryReminder()
  private readonly lapsToGo = new LapsToGo()
  private readonly incidents = new IncidentTracker()

  constructor(engine?: EngineMonitor) {
    this.ownsEngine = engine === undefined
    this.engine = engine ?? new EngineMonitor()
  }

  reset(): void {
    this.resume()
    this.lapsToGo.reset()
    this.incidents.reset()
    if (this.ownsEngine) this.engine.reset()
  }

  /**
   * Every tick, whatever the widget's rate or rules: an incident's report may last one tick (and
   * the engine's own monitor, when it has one, follows getting in the car and the tows).
   */
  observe(frame: TelemetryFrame, session: SessionMeta, race: RaceView): void {
    this.incidents.observe(frame, session, race)
    if (this.ownsEngine) this.engine.observe(frame)
  }

  /**
   * After a gap in the computes or the clock going back: nothing held is valid. The incident
   * tracker and the engine monitor go on, computed or not, so they are not touched.
   */
  private resume(): void {
    this.lastSeen.fill(Number.NaN)
    this.noticeSeen.clear()
    this.greenWas = null
    this.greenSince = Number.NaN
    this.checkeredWas = null
    this.checkeredSince = Number.NaN
    this.lastT = Number.NaN
    this.wrongWay.resume()
    this.pitEntry.resume()
    this.lapsToGo.resume()
  }

  /** `fuel`: the fuel plan (fuel/provider.ts fuelAlertInput), null without one. */
  compute(
    frame: TelemetryFrame,
    session: SessionMeta,
    race: RaceView,
    opts: AlertsOptions,
    fuel: FuelAlertInput | null = null
  ): AlertsData {
    const now = finiteOr(frame.SessionTime[0], Number.NaN)
    // The clock went back (a replay) or the widget was off for a while: nothing held is valid.
    if (!(now >= this.lastT && now - this.lastT <= ALERTS.staleS)) this.resume()
    this.lastT = now
    const holdS = Math.max(0, finiteOr(opts.holdS, 0))

    const player = resolvePlayerCarIdx(frame, session)
    const flags = this.flags(frame, race, player, now, holdS, opts)
    const towing = finiteOr(frame.PlayerCarTowTime[0], 0) > 0
    // The tow puts the car in its box at once, and counts down there.
    const inBox = towing || frame.PlayerTrackSurface[0] === TrackLocation.InPitStall
    const engine = this.engine.read(frame, session, race)

    const speedKmh = Math.round(Math.abs(finiteOr(frame.Speed[0], 0)) * 3.6)
    const limit = session.pitSpeedLimitKmh
    const limitKmh = limit !== null && Number.isFinite(limit) && limit > 0 ? limit : null
    const onPitRoad =
      frame.OnPitRoad[0] ?? (player >= 0 ? frame.CarIdxOnPitRoad[player] : undefined) ?? false
    // Towed, or just put in the box by a tow or a reset: nothing to drive with a limiter yet.
    const pitLimiter =
      opts.showPitLimiter && engine.limiterRead
        ? pitLimiterState(
            onPitRoad,
            frame.EngineWarnings[0],
            speedKmh,
            limitKmh,
            opts.showPitOverspeed
          )
        : null
    const notices = this.notices(frame, session, race, player, onPitRoad, now, holdS, opts, {
      flags,
      engine,
      fuel
    })
    const incident = opts.showIncidents ? incidentAlert(this.incidents.latest, now, holdS) : null

    return {
      visible: flags.length > 0 || notices.length > 0 || pitLimiter !== null || incident !== null,
      flags,
      notices,
      pitLimiter,
      // Only shown with the limiter: off pit road a changing speed would re-send at 10 Hz.
      speedKmh: pitLimiter !== null ? speedKmh : 0,
      pitLimitKmh: limitKmh,
      incident,
      inBox
    }
  }

  private flags(
    frame: TelemetryFrame,
    race: RaceView,
    player: number,
    now: number,
    holdS: number,
    opts: AlertsOptions
  ): FlagKind[] {
    // `|` turns a missing or NaN value into 0; bit fields arrive as signed Int32.
    let bits =
      ((frame.SessionFlags[0] ?? 0) |
        (player >= 0 ? (frame.CarIdxSessionFlags[player] ?? 0) : 0)) >>>
      0
    // Online a car that took its flag can still get the furled flag: nothing to act on any more.
    if (player >= 0 && race.car(player)?.finished === true) {
      bits = (bits & ~SessionFlag.Furled) >>> 0
    }

    // The green flag counts from the tick its bit appears (a start or a restart) and stays for a
    // while even if the bit is only a pulse; a caution or a red flag ends it.
    const green = (bits & SessionFlag.Green) !== 0
    if (green && this.greenWas === false) this.greenSince = now
    if ((bits & (CAUTION_FLAGS | SessionFlag.Red)) !== 0) this.greenSince = Number.NaN
    this.greenWas = green
    // The chequered flag counts from its tick too: its bit stays until the session changes.
    const checkered = (bits & SessionFlag.Checkered) !== 0
    if (checkered && this.checkeredWas === false) this.checkeredSince = now
    this.checkeredWas = checkered

    const flags: FlagKind[] = []
    // Out of the car no flag is yours to act on (the replay, the session screen, the garage).
    if (!opts.showFlags || frame.IsOnTrack[0] !== true) return flags
    const greenS = Math.max(holdS, ALERTS.greenMinS)
    const checkeredS = Math.max(holdS, ALERTS.checkeredMinS)
    for (let i = 0; i < FLAG_ORDER.length; i++) {
      const kind = FLAG_ORDER[i] as FlagKind
      const own = FLAG_OPTION[kind]
      if (own !== undefined && !opts[own]) continue
      let on: boolean
      if (i === GREEN) {
        on = now - this.greenSince < greenS
      } else if (i === CHECKERED) {
        on = now - this.checkeredSince < checkeredS
      } else {
        // The last lap is over once the chequered flag is out, shown or not any more.
        if (i === WHITE && checkered) this.lastSeen[i] = Number.NaN
        else if ((bits & FLAG_BITS[kind]) !== 0) this.lastSeen[i] = now
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
   * mid-session already knows the session (the marks shown).
   */
  private notices(
    frame: TelemetryFrame,
    session: SessionMeta,
    race: RaceView,
    player: number,
    onPitRoad: boolean,
    now: number,
    holdS: number,
    opts: AlertsOptions,
    seen: NoticeInputs
  ): AlertNotice[] {
    const raw = this.detect(frame, session, race, player, onPitRoad, now, holdS, seen)
    const quiet = seen.engine.quiet
    const out: AlertNotice[] = []
    for (const kind of NOTICE_ORDER) {
      if (!opts[NOTICE_OPTION[kind]]) continue
      // The meatball, once out, says what the repairs do.
      if (kind === 'damage' && seen.flags.includes('meatball')) continue
      const notice = raw.get(kind)
      if (!HELD.has(kind)) {
        if (notice) out.push(notice)
        continue
      }
      // A light held from before the tow or the reset says nothing about the engine now.
      if (quiet && ENGINE_NOTICES.has(kind)) {
        this.noticeSeen.delete(kind)
        continue
      }
      if (notice) this.noticeSeen.set(kind, { at: now, notice })
      const held = this.noticeSeen.get(kind)
      if (held && (now - held.at < holdS || held.at === now)) out.push(held.notice)
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
    holdS: number,
    { engine, fuel }: NoticeInputs
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
    const towS = finiteOr(frame.PlayerCarTowTime[0], 0)

    // The engine's critical lights, by the monitor's rules (quiet, the engine running).
    if (engine.stalled) add(STALLED)
    if (engine.oilPressure) add(OIL_PRESSURE)
    // In your box, towed there or not, no "pit for repairs": you are there.
    if (engine.repair && !engine.quiet) add(DAMAGE)

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

    if (towS > 0) add({ kind: 'tow', seconds: Math.ceil(towS) })
    for (const n of fuelNotices(fuel, onPitRoad, inCar && towS <= 0)) add(n)

    const state = finiteOr(frame.SessionState[0], Number.NaN)
    const left =
      race.racing && player >= 0 && state < SessionState.Checkered
        ? race.lapsRemaining(player)
        : null
    const laps = this.lapsToGo.update(now, left, Math.max(holdS, LAPS_TO_GO.showS))
    if (laps !== null) add({ kind: 'lapsToGo', laps })
    return on
  }
}

/** What the notices read besides the frame: the flags shown, the engine and the fuel plan. */
interface NoticeInputs {
  readonly flags: readonly FlagKind[]
  readonly engine: EngineState
  readonly fuel: FuelAlertInput | null
}

const STALLED: AlertNotice = Object.freeze({ kind: 'stalled' })
const OIL_PRESSURE: AlertNotice = Object.freeze({ kind: 'oilPressure' })
const DAMAGE: AlertNotice = Object.freeze({ kind: 'damage' })

/** Structural equality of two payloads (for SKIP_EMIT). */
export function alertsEqual(a: AlertsData, b: AlertsData): boolean {
  return (
    a.visible === b.visible &&
    a.pitLimiter === b.pitLimiter &&
    a.speedKmh === b.speedKmh &&
    a.pitLimitKmh === b.pitLimitKmh &&
    a.inBox === b.inBox &&
    arrayEqual(a.flags, b.flags) &&
    arrayEqual(a.notices, b.notices, deepEqual) &&
    incidentAlertEqual(a.incident, b.incident)
  )
}
