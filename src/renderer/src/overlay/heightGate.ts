/**
 * Fit-to-content gate of one auto-height panel (ux §3.2): which content height the panel
 * applies. Growth is applied at once, so no row is ever cut off; a smaller height only once the
 * content stayed smaller for SHRINK_DELAY_MS, so a row that comes and goes does not make the
 * panel flicker. The first report, and any report while the panel is not drawn, applies at once
 * (there is nothing on screen to protect). At most one timer. Pure: the timers are injected.
 */
import { SHRINK_DELAY_MS } from '@shared/panelGeometry'
import { GLOBAL_TIMERS, type Timers } from './timers'

export interface HeightGateOptions {
  /** `applied` changed (null after `reset`). Called synchronously, only on a change. */
  onChange(applied: number | null): void
  delayMs?: number
  timers?: Timers
}

export interface HeightGate {
  /** Content height the panel applies now; null before the first report (or after reset). */
  readonly applied: number | null
  /**
   * Latest content height the widget wants (whole px). `offscreen`: the panel is not drawn, so
   * a smaller height waits for nothing.
   */
  report(desired: number, offscreen: boolean): void
  /**
   * Forgets every height (auto height turned off): the next report applies at once, so the panel
   * never jumps to an old height first.
   */
  reset(): void
  /** Stops the timer; later reports are ignored. */
  dispose(): void
}

export function createHeightGate(o: HeightGateOptions): HeightGate {
  const timers = o.timers ?? GLOBAL_TIMERS
  const delayMs = o.delayMs ?? SHRINK_DELAY_MS
  let applied: number | null = null
  let desired: number | null = null
  let timer: unknown = null
  let disposed = false

  function cancel(): void {
    if (timer === null) return
    timers.clearTimeout(timer)
    timer = null
  }

  function apply(h: number | null): void {
    if (h === applied) return
    applied = h
    o.onChange(h)
  }

  function shrinkNow(): void {
    timer = null
    apply(desired)
  }

  return {
    get applied() {
      return applied
    },
    report(next, offscreen) {
      if (disposed) return
      desired = next
      if (applied === null || next > applied || offscreen) {
        cancel()
        apply(next)
      } else if (next === applied) {
        // Back to the applied height: a pending shrink is moot.
        cancel()
      } else if (timer === null) {
        // Not restarted by further shrinks: it fires DELAY after the content got smaller and
        // then applies the latest height.
        timer = timers.setTimeout(shrinkNow, delayMs)
      }
    },
    reset() {
      cancel()
      desired = null
      apply(null)
    },
    dispose() {
      disposed = true
      cancel()
      desired = null
    }
  }
}
