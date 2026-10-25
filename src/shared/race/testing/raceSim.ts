/**
 * Test fixtures of the race model: synthetic telemetry frames over time.
 * Only imported by tests.
 */
import { LAPS_REMAIN_UNLIMITED } from '../../flags'
import { SessionState, TELEMETRY_VARS, TELEMETRY_VAR_NAMES, TrackLocation } from '../../telemetry'
import type { TelemetryFrame } from '../../telemetry'
import type { DriverEntry, SessionMeta } from '../../types'
import { RaceModel } from '../raceModel'
import type { RaceCarState, RaceView } from '../raceView'

/** Per-car array length of current iRacing builds. */
export const N = 72
export const LAP_S = 30
/** Laps per second of a car lapping in LAP_S. */
export const V = 1 / LAP_S
export const RACE = 0
export const PRACTICE = 1

type Writable<T> = T extends readonly (infer U)[] ? U[] : never
export type MutableFrame = { [K in keyof TelemetryFrame]: Writable<TelemetryFrame[K]> }

/** Every telemetry variable (zero/false, per-car ones N long), nobody in the world. */
export function makeFrame(): MutableFrame {
  const raw: Record<string, number[] | boolean[]> = {}
  for (const name of TELEMETRY_VAR_NAMES) {
    const len = name.startsWith('CarIdx') ? N : 1
    raw[name] =
      TELEMETRY_VARS[name] === 'boolean'
        ? new Array<boolean>(len).fill(false)
        : new Array<number>(len).fill(0)
  }
  const f = raw as MutableFrame
  f.SessionNum[0] = RACE
  f.SessionState[0] = SessionState.Racing
  f.IsOnTrack[0] = true
  f.CarIdxLapDistPct.fill(-1)
  f.CarIdxLapCompleted.fill(-1)
  f.CarIdxTrackSurface.fill(TrackLocation.NotInWorld)
  f.CarIdxLastLapTime.fill(-1)
  f.CarIdxBestLapTime.fill(-1)
  f.SessionTimeRemain[0] = -1
  f.SessionLapsRemainEx[0] = LAPS_REMAIN_UNLIMITED
  f.PlayerTrackSurface[0] = TrackLocation.OnTrack
  return f
}

export function makeDriver(carIdx: number, o: Partial<DriverEntry> = {}): DriverEntry {
  return {
    carIdx,
    userName: `Piloto ${carIdx}`,
    teamName: '',
    carNumber: String(carIdx + 1),
    iRating: 1500,
    licString: 'B 3.00',
    licColor: null,
    classId: 1,
    classShortName: 'MX5',
    classColor: '#ffffff',
    classEstLapTime: LAP_S,
    isPaceCar: false,
    isSpectator: false,
    licLevel: 12,
    licSubLevel: 300,
    classRelSpeed: 0,
    userId: 100 + carIdx,
    teamId: 0,
    carId: 67,
    carName: 'Porsche 911 GT3 R',
    isAI: false,
    ...o
  }
}

export function makeSession(
  n: number,
  o: Partial<SessionMeta> = {},
  drivers: DriverEntry[] = Array.from({ length: n }, (_, i) => makeDriver(i))
): SessionMeta {
  return {
    playerCarIdx: 0,
    paceCarIdx: -1,
    driverCarEstLapTime: LAP_S,
    trackLengthM: 3000,
    trackName: 'Test',
    drivers: new Map(drivers.map((d) => [d.carIdx, d])),
    tyreCompounds: new Map(),
    sessionTypes: new Map([
      [RACE, 'Race'],
      [PRACTICE, 'Practice']
    ]),
    sessions: new Map([
      [RACE, { type: 'Race', name: 'RACE', laps: 10, timeS: null }],
      [PRACTICE, { type: 'Practice', name: 'PRACTICE', laps: null, timeS: 3600 }]
    ]),
    subSessionId: 1000,
    eventType: 'Race',
    official: true,
    trackNumTurns: 10,
    sectorStarts: [],
    grid: new Map(),
    teamRacing: false,
    pitSpeedLimitKmh: null,
    trackId: 219,
    trackConfig: 'Grand Prix',
    ...o
  }
}

export interface CarSpec {
  /** Race distance in laps (CarIdxLapCompleted + CarIdxLapDistPct). */
  d: number
  /** CarIdxLapCompleted, default floor(d). */
  lap?: number
  pit?: boolean
  surface?: number
  flags?: number
}
export type Cars = Record<number, CarSpec | null | undefined>

export class Sim {
  readonly model = new RaceModel()
  readonly frame = makeFrame()
  t = 0

  constructor(
    public session: SessionMeta,
    o: { sessionNum?: number; state?: number } = {}
  ) {
    this.frame.SessionNum[0] = o.sessionNum ?? RACE
    this.frame.SessionState[0] = o.state ?? SessionState.Racing
  }

  get view(): RaceView {
    return this.model.view
  }

  set state(s: number) {
    this.frame.SessionState[0] = s
  }

  tick(cars: Cars): void {
    const f = this.frame
    f.SessionTime[0] = this.t
    f.CarIdxLapDistPct.fill(-1)
    f.CarIdxLapCompleted.fill(-1)
    f.CarIdxTrackSurface.fill(TrackLocation.NotInWorld)
    f.CarIdxOnPitRoad.fill(false)
    f.CarIdxSessionFlags.fill(0)
    for (const [key, c] of Object.entries(cars)) {
      if (!c) continue
      const i = Number(key)
      // iRacing sends float32 pcts.
      f.CarIdxLapDistPct[i] = Math.fround(c.d - Math.floor(c.d))
      f.CarIdxLapCompleted[i] = c.lap ?? Math.floor(c.d)
      f.CarIdxTrackSurface[i] = c.surface ?? TrackLocation.OnTrack
      f.CarIdxOnPitRoad[i] = c.pit ?? false
      f.CarIdxSessionFlags[i] = c.flags ?? 0
    }
    this.model.update(f, this.session)
  }

  /** Advances `seconds` at `hz`; `cars(t)` gives every car at SessionTime t. */
  run(seconds: number, hz: number, cars: (t: number) => Cars, each?: (t: number) => void): void {
    const start = this.t
    const n = Math.round(seconds * hz)
    for (let k = 1; k <= n; k++) {
      this.t = start + k / hz
      this.tick(cars(this.t))
      each?.(this.t)
    }
  }

  /** Advances at 60 Hz until `done()` holds after a tick. */
  runUntil(done: () => boolean, cars: (t: number) => Cars, each?: (t: number) => void): void {
    const start = this.t
    for (let k = 1; !done(); k++) {
      if (k > 60 * 600) throw new Error('runUntil: never reached')
      this.t = start + k / 60
      this.tick(cars(this.t))
      each?.(this.t)
    }
  }
}

export function car(view: RaceView, idx: number): RaceCarState {
  const c = view.car(idx)
  if (!c) throw new Error(`car ${idx} missing`)
  return c
}

/** Overall positions of every car, sorted: [1..n] when they form a permutation. */
export function sortedOverall(view: RaceView): number[] {
  return view
    .cars()
    .map((c) => c.overallPosition)
    .sort((a, b) => a - b)
}
