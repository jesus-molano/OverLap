/**
 * The controllers' buttons, from whatever reads them (rawInput.ts on Windows, a fake in the
 * tests): which controllers are connected and when a button goes down. Pure: the source and
 * the timer are injected.
 */
import type { ControllerInfo } from '@shared/controllers'

/** What a source reports when it is drained (ControllerSource.poll). */
export type SourceEvent =
  /** A controller is there: at start for each one, then when plugged in. Again: no-op. */
  | { kind: 'arrival'; handle: string; device: ControllerInfo }
  /** A controller went away (unplugged, or its driver restarted). */
  | { kind: 'removal'; handle: string }
  /**
   * One input report: the buttons down in it (`reportId` tells reports with different
   * contents apart: a controller may send its buttons in several). Only the source knows
   * whether two reports are the same, so it may leave unchanged ones out.
   */
  | { kind: 'report'; handle: string; reportId: number; pressed: readonly number[] }

/** Something that reads controllers. `poll` reports whatever happened since the last call. */
export interface ControllerSource {
  poll(emit: (event: SourceEvent) => void): void
  close(): void
}

/** How often the source is drained: the delay a press may wait. */
export const POLL_MS = 10

interface Connected {
  device: ControllerInfo
  /** reportId -> the buttons down in that report's last copy. */
  reports: Map<number, ReadonlySet<number>>
}

/**
 * One press per button going down: a held button is not pressed again however many reports
 * repeat it (a direct drive base sends 1000 a second while driving), and it can be pressed
 * again only once it was let go. Each connected controller (handle) is followed apart, so two
 * identical ones (same id) press independently; the list has each id once.
 */
export class ButtonTracker {
  private readonly connected = new Map<string, Connected>()
  private lastList = ''

  constructor(
    private readonly onPress: (device: string, button: number, first: boolean) => void,
    private readonly onDevices: (list: ControllerInfo[]) => void
  ) {}

  /** Each id once, by name then id. */
  list(): ControllerInfo[] {
    const byId = new Map<string, ControllerInfo>()
    for (const { device } of this.connected.values()) {
      if (!byId.has(device.id)) byId.set(device.id, { ...device })
    }
    return [...byId.values()].sort((a, b) =>
      a.name === b.name ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.name < b.name ? -1 : 1
    )
  }

  /**
   * Sends the list when it differs from the last one sent (or `force`): called after each
   * drain, so a burst of arrivals makes one list.
   */
  publish(force = false): void {
    const list = this.list()
    const key = JSON.stringify(list)
    if (!force && key === this.lastList) return
    this.lastList = key
    this.onDevices(list)
  }

  handle(event: SourceEvent): void {
    switch (event.kind) {
      case 'arrival':
        if (!this.connected.has(event.handle)) {
          this.connected.set(event.handle, { device: { ...event.device }, reports: new Map() })
        }
        break
      case 'removal':
        this.connected.delete(event.handle)
        break
      case 'report':
        this.report(event.handle, event.reportId, event.pressed)
        break
    }
  }

  /**
   * The buttons of a report that were not down before are pressed. In the first copy of a
   * report since the controller arrived they are `first`: nothing was known before it, so a
   * button may simply be resting down (a rotary's position, a latched toggle) next to the one
   * the user pressed (main/index.ts: recording ignores them).
   */
  private report(handle: string, reportId: number, pressed: readonly number[]): void {
    const c = this.connected.get(handle)
    if (!c) return
    const first = !c.reports.has(reportId)
    const before = this.down(c)
    c.reports.set(reportId, new Set(pressed))
    const seen = new Set<number>()
    for (const button of pressed) {
      if (seen.has(button)) continue
      seen.add(button)
      if (!before.has(button)) this.onPress(c.device.id, button, first)
    }
  }

  /** The buttons down on a controller, every report together. */
  private down(c: Connected): Set<number> {
    const out = new Set<number>()
    for (const set of c.reports.values()) for (const b of set) out.add(b)
    return out
  }
}

export interface ButtonReaderOptions {
  source: ControllerSource
  /** `first`: in the first report since the controller arrived (ButtonTracker.report). */
  onPress(device: string, button: number, first: boolean): void
  onDevices(list: ControllerInfo[]): void
  /** A source that threw while polling: the reader stops (the process exits and restarts). */
  onError(err: unknown): void
  setInterval?: (fn: () => void, ms: number) => ReturnType<typeof setInterval>
  clearInterval?: (timer: ReturnType<typeof setInterval>) => void
}

/** Drains the source every POLL_MS into a ButtonTracker. */
export class ButtonReader {
  private readonly tracker: ButtonTracker
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(private readonly opts: ButtonReaderOptions) {
    this.tracker = new ButtonTracker(opts.onPress, opts.onDevices)
  }

  /** Reads what is there now, sends the list (even an empty one), then keeps polling. */
  start(): void {
    if (this.timer !== null) return
    if (!this.tick()) return
    this.tracker.publish(true)
    const every = this.opts.setInterval ?? setInterval
    this.timer = every(() => void this.tick(), POLL_MS)
  }

  stop(): void {
    if (this.timer !== null) (this.opts.clearInterval ?? clearInterval)(this.timer)
    this.timer = null
    try {
      this.opts.source.close()
    } catch {
      // Closing anyway.
    }
  }

  private tick(): boolean {
    try {
      this.opts.source.poll((event) => this.tracker.handle(event))
      if (this.timer !== null) this.tracker.publish()
      return true
    } catch (err) {
      this.stop()
      this.opts.onError(err)
      return false
    }
  }
}
