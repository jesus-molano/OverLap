/**
 * Fuel widget ('Combustible'): the fuel you have and the laps it lasts, litres per lap, what you
 * need to the flag and what to add at the next stop (next to what the pit menu adds), the pit
 * window and the stops, the litres per lap that would save a stop, the last tyre reading and
 * the fast repairs and tyre sets left. Runs at 2 Hz on what the FuelTracker measured on every
 * tick; readings are quantised to what the widget shows, so SKIP_EMIT drops the ticks where
 * nothing shown changed. fuelAlertInput() gives the alerts band the same plan.
 *
 * The laps left are the RaceModel's (RaceView.lapsRemaining: the overall leader's pace in timed
 * races); an unlimited session has none, so only the fuel and the consumption are drawn. The
 * plan starts from the fuel the lap in progress had at the S/F line, less the average for the
 * part of the lap driven (FuelTracker.lapStart), so it holds still through a lap; the fuel and
 * its laps on the hero line are the fuel of the moment. A replay shows nothing: its car is the
 * one on camera, the fuel only ever yours.
 */
import { deepEqual } from '../equal'
import { isFiniteNumber } from '../num'
import type { RaceView } from '../race/raceView'
import { clampOption, OPTION_SCHEMA } from '../settingsSchema'
import { isReplayPlaying } from '../simScreen'
import type { TelemetryFrame } from '../telemetry'
import type { FuelData, FuelFinish, FuelOptions, SessionMeta } from '../types'
import type { FuelAlertInput } from '../notices/fuel'
import { tankLitres } from './spec'
import { fuelStrategy } from './strategy'
import type { FuelSamples, FuelTracker } from './tracker'

export const FUEL = {
  /** FastRepairAvailable / TireSetsAvailable for "no limit". */
  unlimited: 255,
  /** irsdk_PitSvFlags FuelFill: the pit menu's fuel box is ticked. */
  fuelFillFlag: 0x10
} as const

const round1 = (v: number): number => Math.round(v * 10) / 10 || 0
const round2 = (v: number): number => Math.round(v * 100) / 100 || 0

/** What to plan with: the average and the most of the last `avgLaps` clean laps. */
export interface Consumption {
  readonly avgL: number | null
  readonly maxL: number | null
  readonly samples: number
  readonly carried: boolean
}

export function consumption(s: FuelSamples, avgLaps: number): Consumption {
  const n = clampOption(OPTION_SCHEMA.fuel.avgLaps, avgLaps)
  const laps = s.laps.slice(0, n)
  if (laps.length === 0) return { avgL: null, maxL: null, samples: 0, carried: false }
  let sum = 0
  let max = 0
  for (const l of laps) {
    sum += l
    max = Math.max(max, l)
  }
  return { avgL: sum / laps.length, maxL: max, samples: laps.length, carried: s.carried }
}

interface Plan {
  readonly fuelL: number | null
  readonly tankL: number | null
  readonly cons: Consumption
  readonly finish: FuelFinish | null
}

function planOf(
  frame: TelemetryFrame,
  session: SessionMeta,
  race: RaceView,
  tracker: FuelTracker,
  opts: FuelOptions
): Plan {
  const raw = frame.FuelLevel[0]
  const fuelL = isFiniteNumber(raw) && raw >= 0 ? raw : null
  const tankL = tankLitres(session.pitSpec, fuelL, frame.FuelLevelPct[0])
  const cons = consumption(tracker.samples, opts.avgLaps)
  const avgL = cons.avgL
  const player = race.playerCarIdx
  const d = player >= 0 ? (race.car(player)?.distance ?? Number.NaN) : Number.NaN
  const left = player >= 0 && Number.isFinite(d) ? race.lapsRemaining(player) : null
  const start = tracker.lapStart
  const finish =
    fuelL !== null && avgL !== null && left !== null
      ? fuelStrategy({
          fuelL:
            start !== null && start.lap === Math.floor(d)
              ? Math.max(0, start.fuelL - (d - start.lap) * avgL)
              : fuelL,
          avgL,
          tankL,
          distance: d,
          lapsRemaining: left,
          marginLaps: clampOption(OPTION_SCHEMA.fuel.marginLaps, opts.marginLaps)
        })
      : null
  return { fuelL, tankL, cons, finish }
}

/** What is left of a session limit: the telemetry's count (255 = none), else the YAML's limit. */
function leftOf(available: unknown, used: unknown, limit: number | null): number | null {
  if (isFiniteNumber(available)) {
    return available >= 0 && available < FUEL.unlimited ? Math.round(available) : null
  }
  if (limit === null || !isFiniteNumber(used) || used < 0) return null
  return Math.max(0, limit - Math.round(used))
}

/** PitSvFuel while the fuel box is ticked, 0 when unticked, null when unknown. */
function boxLitres(frame: TelemetryFrame): number | null {
  const flags = frame.PitSvFlags[0]
  const litres = frame.PitSvFuel[0]
  if (!isFiniteNumber(flags) || !isFiniteNumber(litres)) return null
  // Bit fields arrive as signed Int32.
  return ((flags >>> 0) & FUEL.fuelFillFlag) !== 0 ? round1(Math.max(0, litres)) : 0
}

export function computeFuel(
  frame: TelemetryFrame,
  session: SessionMeta,
  race: RaceView,
  tracker: FuelTracker,
  opts: FuelOptions
): FuelData {
  const plan = planOf(frame, session, race, tracker, opts)
  const { fuelL, cons } = plan
  const spec = session.pitSpec
  const last = tracker.lastLapL
  return {
    // Out of the car an empty tank is no reading (the garage, a teammate's stint).
    visible:
      fuelL !== null && !isReplayPlaying(frame) && (frame.IsOnTrack[0] === true || fuelL > 0),
    fuelL: fuelL === null ? null : round1(fuelL),
    tankL: plan.tankL === null ? null : round1(plan.tankL),
    lapsOfFuel: fuelL !== null && cons.avgL !== null ? round1(fuelL / cons.avgL) : null,
    avgL: cons.avgL === null ? null : round2(cons.avgL),
    lastL: last === null ? null : round2(last),
    maxL: cons.maxL === null ? null : round2(cons.maxL),
    samples: cons.samples,
    carried: cons.carried,
    finish: plan.finish,
    boxL: boxLitres(frame),
    tyres: tracker.tyres,
    fastRepairs: leftOf(
      frame.FastRepairAvailable[0],
      frame.FastRepairUsed[0],
      spec?.fastRepairsLimit ?? null
    ),
    tyreSets: leftOf(frame.TireSetsAvailable[0], frame.TireSetsUsed[0], spec?.tyreSetLimit ?? null)
  }
}

/**
 * The plan as the alerts band reads it; null without a fuel reading or in a replay. The window
 * only closes in a race under way: nobody has to reach the end of a practice.
 */
export function fuelAlertInput(
  frame: TelemetryFrame,
  session: SessionMeta,
  race: RaceView,
  tracker: FuelTracker,
  opts: FuelOptions
): FuelAlertInput | null {
  if (isReplayPlaying(frame)) return null
  const plan = planOf(frame, session, race, tracker, opts)
  if (plan.fuelL === null) return null
  const avg = plan.cons.avgL
  const f = plan.finish
  return {
    lapsOfFuel: avg === null ? null : plan.fuelL / avg,
    short: f === null ? null : f.short,
    closesThisLap: race.racing && f !== null && f.window !== null && f.window.to === f.lap
  }
}

/** Structural equality of two payloads (for SKIP_EMIT). */
export function fuelEqual(a: FuelData, b: FuelData): boolean {
  return (
    a.visible === b.visible &&
    a.fuelL === b.fuelL &&
    a.tankL === b.tankL &&
    a.lapsOfFuel === b.lapsOfFuel &&
    a.avgL === b.avgL &&
    a.lastL === b.lastL &&
    a.maxL === b.maxL &&
    a.samples === b.samples &&
    a.carried === b.carried &&
    a.boxL === b.boxL &&
    a.fastRepairs === b.fastRepairs &&
    a.tyreSets === b.tyreSets &&
    deepEqual(a.finish, b.finish) &&
    deepEqual(a.tyres, b.tyres)
  )
}
