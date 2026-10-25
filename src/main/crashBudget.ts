/**
 * How many times an overlay window may be recovered (renderer crash, failed load, GPU loss)
 * before main gives up on it: more than MAX_CRASHES within CRASH_WINDOW_MS. Keyed by display.
 * Pure: the caller passes the time.
 */
export const MAX_CRASHES = 5
export const CRASH_WINDOW_MS = 60_000

export class CrashBudget<K> {
  private readonly times = new Map<K, number[]>()

  constructor(
    private readonly max = MAX_CRASHES,
    private readonly windowMs = CRASH_WINDOW_MS
  ) {}

  /** Records one crash at `now`; false once there were more than `max` within the window. */
  record(key: K, now: number): boolean {
    const recent = (this.times.get(key) ?? []).filter((t) => now - t < this.windowMs)
    recent.push(now)
    this.times.set(key, recent)
    return recent.length <= this.max
  }

  reset(key: K): void {
    this.times.delete(key)
  }

  clear(): void {
    this.times.clear()
  }
}
