/**
 * Test-only: the player changing car on a schedule, for the automatic layout (main's
 * LayoutControl follows the 'player-car' message the loop sends from the session YAML). From the
 * OVERLAY_MOCK_CAR_CYCLE env var or MockSourceOptions.carCycle, never from the settings: the
 * soak and leak checks run the real app with it.
 *
 * Every `periodMs` the next step of the script happens, round and round:
 * - car: the player gets in this car model (DriverInfo CarID and CarScreenName of their entry);
 * - fresh: a car model not seen for a while (60 of them in turn: more than seenCars keeps);
 * - yaml: a new YAML version with the same car (iRacing rewrites it often in a session);
 * - session: a new subsession (SubSessionID and SessionID move on), the same car;
 * - drop: iRacing closed for `ms`, then open again with the same session and car.
 *
 * Pure: MockSource feeds it its clock and passes the YAML through it.
 */
import type { MockSessionInfo } from './sessionInfo'

export type MockCarStep =
  | { kind: 'car'; carId: number; carName: string }
  | { kind: 'fresh' }
  | { kind: 'yaml' }
  | { kind: 'session' }
  | { kind: 'drop'; ms: number }

export interface MockCarScript {
  periodMs: number
  steps: readonly MockCarStep[]
}

export const MOCK_CAR_A = { carId: 119, carName: 'Mazda MX-5 Cup' } as const
export const MOCK_CAR_B = { carId: 132, carName: 'Porsche 911 GT3 R (992)' } as const
export const MOCK_CAR_C = { carId: 143, carName: 'Ferrari 296 GT3' } as const

/** A, the YAML again, B, a new subsession, C, iRacing closed and opened, back to A. */
export const DEFAULT_MOCK_CAR_STEPS: readonly MockCarStep[] = [
  { kind: 'car', ...MOCK_CAR_A },
  { kind: 'yaml' },
  { kind: 'car', ...MOCK_CAR_B },
  { kind: 'session' },
  { kind: 'car', ...MOCK_CAR_C },
  { kind: 'drop', ms: 2_500 }
]

const FRESH_CARS = 60
const FRESH_FIRST_ID = 5_000
const PERIOD_MIN_MS = 50
const PERIOD_MAX_MS = 3_600_000
/** Far from the series' own subsessions (one more per finished mock race). */
const SESSION_STRIDE = 1_000

/**
 * `3000` (the default script every 3 s) or `3000;car:67:Mazda MX-5 Cup,yaml,session,fresh,
 * drop:2500`. Null when missing or not valid: no cycle.
 */
export function parseMockCarCycle(raw: string | undefined): MockCarScript | null {
  const text = raw?.trim() ?? ''
  if (text === '') return null
  const [periodText = '', stepsText] = text.split(';', 2)
  const periodMs = Number(periodText.trim())
  if (!Number.isInteger(periodMs) || periodMs < PERIOD_MIN_MS || periodMs > PERIOD_MAX_MS) {
    return null
  }
  if (stepsText === undefined) return { periodMs, steps: DEFAULT_MOCK_CAR_STEPS }
  const steps: MockCarStep[] = []
  for (const part of stepsText.split(',')) {
    const step = parseStep(part.trim())
    if (step === null) return null
    steps.push(step)
  }
  return steps.length > 0 ? { periodMs, steps } : null
}

function parseStep(text: string): MockCarStep | null {
  if (text === 'yaml' || text === 'session' || text === 'fresh') return { kind: text }
  if (text.startsWith('drop:')) {
    const ms = Number(text.slice(5))
    return Number.isInteger(ms) && ms > 0 ? { kind: 'drop', ms } : null
  }
  if (text.startsWith('car:')) {
    const rest = text.slice(4)
    const colon = rest.indexOf(':')
    const carId = Number(colon < 0 ? rest : rest.slice(0, colon))
    const carName = colon < 0 ? '' : rest.slice(colon + 1)
    return Number.isInteger(carId) && carId > 0 ? { kind: 'car', carId, carName } : null
  }
  return null
}

export class MockCarCycle {
  private nextAt: number
  private index = 0
  private car: { carId: number; carName: string } | null = null
  private sessionOffset = 0
  private fresh = 0
  private dropUntil = -Infinity
  /** Changes with every YAML change of the cycle's own, and with every one of the series'. */
  private revision = 1
  private base: number | null = null
  /** Steps run so far (tests, logs). */
  steps = 0

  constructor(
    private readonly script: MockCarScript,
    startMs: number
  ) {
    this.nextAt = startMs + script.periodMs
  }

  /** The car the YAML says the player is in (null: the series' own). */
  get currentCar(): { carId: number; carName: string } | null {
    return this.car
  }

  /** Runs the steps due by `nowMs` (one per period, none skipped). */
  update(nowMs: number): void {
    while (nowMs >= this.nextAt) {
      const at = this.nextAt
      this.nextAt += this.script.periodMs
      this.run(at)
    }
  }

  /** iRacing is closed now (a drop step). */
  dropped(nowMs: number): boolean {
    return nowMs < this.dropUntil
  }

  /** The YAML version: the series' (`base`) and the cycle's changes together. */
  version(base: number): number {
    if (base !== this.base) {
      this.base = base
      this.revision++
    }
    return this.revision
  }

  /** The series' YAML with the cycle's car and subsession. */
  apply(info: MockSessionInfo): MockSessionInfo {
    const car = this.car
    const offset = this.sessionOffset * SESSION_STRIDE
    if (car === null && offset === 0) return info
    const player = info.DriverInfo.DriverCarIdx
    return {
      ...info,
      WeekendInfo: {
        ...info.WeekendInfo,
        SessionID: info.WeekendInfo.SessionID + offset,
        SubSessionID: info.WeekendInfo.SubSessionID + offset
      },
      DriverInfo: {
        ...info.DriverInfo,
        Drivers: info.DriverInfo.Drivers.map((d) =>
          car !== null && d.CarIdx === player
            ? {
                ...d,
                CarID: car.carId,
                CarScreenName: car.carName,
                CarScreenNameShort: car.carName
              }
            : d
        )
      }
    }
  }

  private run(at: number): void {
    const step = this.script.steps[this.index]
    this.index = (this.index + 1) % this.script.steps.length
    this.steps++
    if (step === undefined) return
    switch (step.kind) {
      case 'car':
        this.car = { carId: step.carId, carName: step.carName }
        break
      case 'fresh': {
        const n = this.fresh
        this.fresh = (n + 1) % FRESH_CARS
        this.car = { carId: FRESH_FIRST_ID + n, carName: `Mock car ${n + 1}` }
        break
      }
      case 'yaml':
        break
      case 'session':
        this.sessionOffset++
        break
      case 'drop':
        this.dropUntil = at + step.ms
        // Nothing in the YAML changes: the same session and car when iRacing is back.
        return
    }
    this.revision++
  }
}
