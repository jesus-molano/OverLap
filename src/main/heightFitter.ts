import type { Rect } from '@shared/types'
import { KeyedTimer } from './keyedTimer'
import { SHRINK_DELAY_MS } from './windowMath'

export interface HeightFitterHost<K> {
  /** Auto height is on for this widget (otherwise heights are only remembered). */
  active(id: K): boolean
  /** The window is not on screen: there is no flicker to avoid, so shrinking waits for nothing. */
  offscreen(id: K): boolean
  /** Bounds the window needs for this content height; null when it already has them. */
  target(id: K, desired: number): Rect | null
  current(id: K): Rect
  apply(id: K, rect: Rect): void
}

/**
 * Fit-to-content for auto-height widgets. Growth is applied at once, so no row
 * is ever cut off; a smaller height only once the content stayed smaller for
 * SHRINK_DELAY_MS, so a row that comes and goes does not make the window
 * flicker (a window not on screen, e.g. before its first show, gets it at
 * once). Resizes are never animated. At most one timer per widget.
 */
export class HeightFitter<K> {
  private readonly desired = new Map<K, number>()
  private readonly shrink: KeyedTimer<K>

  constructor(
    private readonly host: HeightFitterHost<K>,
    delayMs = SHRINK_DELAY_MS
  ) {
    this.shrink = new KeyedTimer(delayMs, (id) => this.refit(id))
  }

  /** Latest (untrimmed) content height reported by the widget's renderer. */
  report(id: K, desired: number): void {
    // First report since the window appeared or auto height was turned on:
    // there is no previous fit to protect from flicker, so apply it either way.
    const fresh = !this.desired.has(id)
    this.desired.set(id, desired)
    if (!this.host.active(id)) return
    const next = this.host.target(id, desired)
    if (!next) {
      // Back to the current height: a pending shrink is moot.
      this.shrink.cancel(id)
    } else if (fresh || next.height > this.host.current(id).height || this.host.offscreen(id)) {
      this.shrink.cancel(id)
      this.host.apply(id, next)
    } else {
      // Not restarted by further shrinks: it fires 1.5 s after the content got smaller.
      this.shrink.start(id)
    }
  }

  /**
   * Applies the latest content height now, in either direction: after the
   * window moved (another work area), was restored or auto height turned on.
   */
  refit(id: K): void {
    this.shrink.cancel(id)
    const desired = this.desired.get(id)
    if (desired === undefined || !this.host.active(id)) return
    const next = this.host.target(id, desired)
    if (next) this.host.apply(id, next)
  }

  /**
   * Auto height turned off: drops the pending shrink and the remembered height
   * (the renderer stops reporting while off and reports again when turned back
   * on, so an old height would only make the window jump first).
   */
  pause(id: K): void {
    this.shrink.cancel(id)
    this.desired.delete(id)
  }

  /** The widget's window is gone: its next renderer reports again. */
  forget(id: K): void {
    this.shrink.cancel(id)
    this.desired.delete(id)
  }

  dispose(): void {
    this.shrink.dispose()
    this.desired.clear()
  }
}
