/**
 * At most one pending timeout per key, all cancellable at once. Used for the
 * per-widget shrink delay and the debounced bounds commit, so no widget can
 * ever pile up timers.
 */
export class KeyedTimer<K> {
  private readonly timers = new Map<K, ReturnType<typeof setTimeout>>()

  constructor(
    private readonly delayMs: number,
    private readonly fire: (key: K) => void
  ) {}

  /** Starts the timer for `key` unless one is already pending. */
  start(key: K): void {
    if (!this.timers.has(key)) this.set(key)
  }

  /** Starts the timer for `key` again from now (debounce). */
  restart(key: K): void {
    this.cancel(key)
    this.set(key)
  }

  cancel(key: K): void {
    const timer = this.timers.get(key)
    if (timer === undefined) return
    clearTimeout(timer)
    this.timers.delete(key)
  }

  has(key: K): boolean {
    return this.timers.has(key)
  }

  /** Fires every pending timer now, in the order they were started. */
  flush(): void {
    const keys = [...this.timers.keys()]
    this.dispose()
    for (const key of keys) this.fire(key)
  }

  /** Cancels every pending timer without firing it. */
  dispose(): void {
    for (const timer of this.timers.values()) clearTimeout(timer)
    this.timers.clear()
  }

  private set(key: K): void {
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key)
        this.fire(key)
      }, this.delayMs)
    )
  }
}
