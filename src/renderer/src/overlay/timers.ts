/**
 * Timer and frame scheduling the overlay host uses, injected so its modules stay pure and
 * testable with fake timers.
 */

export interface Timers {
  setTimeout(cb: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

export const GLOBAL_TIMERS: Timers = {
  setTimeout: (cb, ms) => setTimeout(cb, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)
}

export interface Frames {
  request(cb: () => void): number
  cancel(id: number): void
}

export const ANIMATION_FRAMES: Frames = {
  request: (cb) => requestAnimationFrame(cb),
  cancel: (id) => cancelAnimationFrame(id)
}
