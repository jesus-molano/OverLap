/**
 * The automatic layout under thousands of car changes: the right layout applied once per real
 * change of car, never on a YAML update, a reconnect or during edit mode, a layout chosen by
 * hand kept until the next car, no apply loop, and nothing that grows with the changes (the
 * remembered cars and links stay capped, LayoutControl keeps a fixed state). The last part runs
 * the real telemetry loop over the mock with a car cycle (carCycle.ts), as the soak of the app.
 */
import { setFlagsFromString } from 'node:v8'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { linkCar, saveLayoutAs } from '@shared/layouts'
import { MAX_CAR_LINKS, MAX_SEEN_CARS } from '@shared/settings/layouts'
import type { TelemetryOutMessage } from '@shared/ipc'
import { createDefaultSettings, normalizeSettings } from '@shared/settings'
import type { CarRef, OverlaySettings } from '@shared/types'
import { WIDGET_IDS } from '@shared/widgets'
import { TelemetryLoop } from '../telemetry/loop'
import {
  DEFAULT_MOCK_CAR_STEPS,
  MOCK_CAR_A,
  MOCK_CAR_B,
  MOCK_CAR_C
} from '../telemetry/mock/carCycle'
import { MockSource } from '../telemetry/sources/MockSource'
import { LayoutControl } from './layoutControl'

const A: CarRef = { ...MOCK_CAR_A }
const B: CarRef = { ...MOCK_CAR_B }
const C: CarRef = { ...MOCK_CAR_C }

/** The process-wide gc() even without --expose-gc, or null if V8 refuses. */
function exposeGc(): (() => void) | null {
  try {
    setFlagsFromString('--expose-gc')
    const gc: unknown = runInNewContext('gc')
    return typeof gc === 'function' ? (gc as () => void) : null
  } catch {
    return null
  }
}

interface Soak {
  control: LayoutControl
  settings(): OverlaySettings
  /** Layouts applied by the car, in order. */
  autoApplied: string[]
  /** Store changes (each one a settings.json write and a broadcast in the app). */
  updates: number
  setEditing(on: boolean): void
}

function soak(initial: OverlaySettings): Soak {
  let current = normalizeSettings(initial)
  let editing = false
  const s: Soak = {
    control: undefined as unknown as LayoutControl,
    settings: () => current,
    autoApplied: [],
    updates: 0,
    setEditing: (on) => (editing = on)
  }
  s.control = new LayoutControl({
    getSettings: () => current,
    // A fresh object per change, as the store; not normalised again (thousands of them).
    update: (mutate) => {
      s.updates++
      const draft = structuredClone(current)
      mutate(draft)
      current = draft
    },
    // As main: every sync also gives the automatic mode its chance (it must not loop).
    sync: (prev) => s.control.afterChange(prev),
    reloadBounds: () => {},
    flushPendingSaves: () => {},
    isEditing: () => editing,
    notify: () => {},
    carChanged: () => {},
    files: () => {
      throw new Error('no files here')
    },
    importedName: () => 'Importada',
    log: (message) => {
      const m = /layout '(.+)' applied \(auto\)/.exec(message)
      if (m?.[1] !== undefined) s.autoApplied.push(m[1])
    }
  })
  return s
}

/** Principal (in use), 'A' linked to car A, 'B' linked to car B; the automatic mode on. */
function linked(): OverlaySettings {
  const s = createDefaultSettings()
  saveLayoutAs(s, 'A', 1)
  saveLayoutAs(s, 'B', 2)
  const n = normalizeSettings(s)
  const [principal, la, lb] = n.savedLayouts.list
  if (!principal || !la || !lb) throw new Error('three layouts expected')
  n.savedLayouts.activeId = principal.id
  linkCar(n, A, la.id)
  linkCar(n, B, lb.id)
  n.layouts.autoSwitch = true
  return normalizeSettings(n)
}

function idOf(s: Soak, name: string): string {
  const l = s.settings().savedLayouts.list.find((x) => x.name === name)
  if (!l) throw new Error(`no layout ${name}`)
  return l.id
}

/** LayoutControl's own state: what it keeps between calls (the auto switch's three fields). */
function controlState(c: LayoutControl): string {
  return JSON.stringify(c, (_k, v: unknown) => (typeof v === 'function' ? undefined : v))
}

// Each change copies the whole settings, as the store does (~1 ms with three full layouts).
describe('the automatic layout, thousands of car changes', { timeout: 60_000 }, () => {
  it('A -> B -> an unlinked car -> A: each real change applies once, nothing else does', () => {
    const s = soak(linked())
    const la = idOf(s, 'A')
    const lb = idOf(s, 'B')
    const CYCLES = 1_000
    const stateAfterOne: string[] = []
    for (let i = 0; i < CYCLES; i++) {
      s.control.onCar(A)
      // The YAML again and again in the same car, the menus in between, a reconnect.
      s.control.onCar(A)
      s.control.onCar(null)
      s.control.onCar(A)
      expect(s.settings().savedLayouts.activeId).toBe(la)
      s.control.onCar(B)
      s.control.onCar(B)
      expect(s.settings().savedLayouts.activeId).toBe(lb)
      // No link: the last layout stays.
      s.control.onCar(C)
      s.control.onCar(null)
      s.control.onCar(C)
      expect(s.settings().savedLayouts.activeId).toBe(lb)
      if (i === 0 || i === CYCLES - 1) stateAfterOne.push(controlState(s.control))
    }
    expect(s.autoApplied).toHaveLength(2 * CYCLES)
    expect(s.autoApplied.slice(0, 4)).toEqual(['A', 'B', 'A', 'B'])
    // Constant: the same state after the first cycle and the last.
    expect(stateAfterOne[1]).toBe(stateAfterOne[0])
    expect(s.settings().savedLayouts.seenCars.map((c) => c.carId)).toEqual([
      C.carId,
      B.carId,
      A.carId
    ])
  })

  it('the same car with endless YAML updates applies once', () => {
    const s = soak(linked())
    for (let i = 0; i < 10_000; i++) s.control.onCar({ ...A })
    expect(s.autoApplied).toEqual(['A'])
    // The car is remembered once: no store change per update.
    expect(s.updates).toBe(2)
  })

  it('a change during edit mode waits, then applies once when it ends', () => {
    const s = soak(linked())
    for (let i = 0; i < 1_000; i++) {
      s.setEditing(true)
      s.control.onCar(i % 2 === 0 ? A : B)
      for (let k = 0; k < 5; k++) s.control.onCar(i % 2 === 0 ? A : B)
      expect(s.autoApplied).toHaveLength(i)
      s.setEditing(false)
      s.control.onEditEnd()
      // Ending it again (the tray and the shortcut) does nothing more.
      s.control.onEditEnd()
      expect(s.autoApplied).toHaveLength(i + 1)
    }
    expect(s.autoApplied.slice(0, 3)).toEqual(['A', 'B', 'A'])
  })

  it('a layout chosen by hand stays until the car changes', () => {
    const s = soak(linked())
    const principal = idOf(s, 'Principal')
    for (let i = 0; i < 1_000; i++) {
      s.control.onCar(i % 2 === 0 ? A : B)
      s.control.choose(principal)
      // YAML updates, the menus, iRacing closed and opened: still the one chosen.
      s.control.onCar(i % 2 === 0 ? A : B)
      s.control.onCar(null)
      s.control.onCar(i % 2 === 0 ? A : B)
      expect(s.settings().savedLayouts.activeId).toBe(principal)
    }
    expect(s.autoApplied).toHaveLength(1_000)
  })

  it('a layout chosen by hand during edit mode beats the one waiting', () => {
    const s = soak(linked())
    const principal = idOf(s, 'Principal')
    for (let i = 0; i < 500; i++) {
      s.setEditing(true)
      s.control.onCar(i % 2 === 0 ? A : B)
      s.control.choose(principal)
      s.setEditing(false)
      s.control.onEditEnd()
      expect(s.settings().savedLayouts.activeId).toBe(principal)
    }
    expect(s.autoApplied).toEqual([])
  })

  it('keeps the remembered cars at 40 and the links at 200, whatever it sees', async () => {
    const s = soak(linked())
    const la = idOf(s, 'A')
    for (let i = 0; i < 3_000; i++)
      s.control.onCar({ carId: 5_000 + (i % 60), carName: `Car ${i % 60}` })
    expect(s.settings().savedLayouts.seenCars).toHaveLength(MAX_SEEN_CARS)
    for (let i = 0; i < MAX_CAR_LINKS + 100; i++) {
      await s.control.command({
        type: 'layout-link-car',
        car: { carId: 9_000 + i, carName: `Linked ${i}` },
        layoutId: la
      })
    }
    expect(s.settings().savedLayouts.links).toHaveLength(MAX_CAR_LINKS)
  })

  it('holds no memory per change', () => {
    const gc = exposeGc()
    if (!gc) return
    const s = soak(linked())
    const round = (n: number): void => {
      for (let i = 0; i < n; i++) {
        s.control.onCar(A)
        s.control.onCar(B)
        s.control.onCar(C)
        s.control.onCar(null)
      }
    }
    round(200)
    gc()
    const before = process.memoryUsage().heapUsed
    round(1_000)
    gc()
    const after = process.memoryUsage().heapUsed
    // 4 000 more changes: far less than a few hundred bytes each would add.
    expect(after - before).toBeLessThan(1_000_000)
  })
})

describe('the automatic layout from the mock, through the telemetry loop', () => {
  it('follows the car cycle: once per real change, nothing on YAML updates, subsessions, reconnects', async () => {
    const s = soak(linked())
    let t = 0
    const PERIOD_MS = 500
    const CYCLES = 150
    const STEPS = DEFAULT_MOCK_CAR_STEPS.length * CYCLES
    const source = new MockSource({
      seed: 1,
      now: () => t,
      carCycle: {
        periodMs: PERIOD_MS,
        steps: DEFAULT_MOCK_CAR_STEPS.map((x) => (x.kind === 'drop' ? { ...x, ms: 250 } : x))
      }
    })
    const cars: (CarRef | null)[] = []
    let loop: TelemetryLoop | null = null
    loop = new TelemetryLoop(
      source,
      (msg: TelemetryOutMessage) => {
        if (msg.type !== 'player-car') return
        cars.push(msg.car)
        s.control.onCar(msg.car)
      },
      {
        now: () => t,
        sleep: (ms) => {
          t += ms
          return Promise.resolve()
        },
        yieldToEventLoop: () => {
          t += 1000 / 60
          if ((source.carCycle?.steps ?? 0) >= STEPS) loop?.stop()
          return Promise.resolve()
        },
        retryMs: 100,
        // The car is what this follows: inert widgets and race model keep it fast.
        createProviders: () => ({
          run: Object.fromEntries(WIDGET_IDS.map((id) => [id, () => null])) as never,
          reset: () => {}
        }),
        createRaceModel: () => ({
          view: undefined as never,
          update: () => {},
          reset: () => {},
          breakContinuity: () => {}
        })
      }
    )
    await loop.start()

    const ids = cars.map((c) => (c === null ? null : c.carId))
    // The series' own car first, then per cycle: A, B, C, out (iRacing closed), C again. The
    // loop does not follow the car while the mock plays its replay of the tape: a few go unseen.
    expect(ids.slice(1, 6)).toEqual([A.carId, B.carId, C.carId, null, C.carId])
    expect(cars.length).toBeLessThanOrEqual(1 + 5 * CYCLES)
    expect(cars.length).toBeGreaterThanOrEqual(Math.floor(0.95 * 5 * CYCLES))
    // Exactly what the cars told call for: a layout each time you get in another linked car.
    const expected: string[] = []
    let last: number | null = null
    let active = 'Principal'
    for (const id of ids) {
      if (id === null || id === last) continue
      last = id
      const name = id === A.carId ? 'A' : id === B.carId ? 'B' : null
      if (name !== null && name !== active) expected.push((active = name))
    }
    expect(s.autoApplied).toEqual(expected)
    expect(s.autoApplied.length).toBeGreaterThanOrEqual(Math.floor(0.95 * 2 * CYCLES))
    expect(s.settings().savedLayouts.seenCars.length).toBeLessThanOrEqual(MAX_SEEN_CARS)
  }, 60_000)
})
