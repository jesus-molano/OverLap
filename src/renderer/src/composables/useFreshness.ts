import { onScopeDispose, shallowRef, watch, type Ref, type ShallowRef } from 'vue'

/**
 * One self-rescheduling stale check. At most one timer is pending, and none once stale or
 * cancelled: nothing ticks while no payload arrives.
 */
export interface StaleTimer {
  /** A fresh sample arrived at `now` (ms). */
  touch(now: number): void
  /** Drops the pending check (no `onStale` call). */
  cancel(): void
  /** Cancels and ignores every later `touch`. */
  dispose(): void
}

export interface StaleTimerOptions {
  staleMs: number
  now: () => number
  onStale: () => void
  setTimer?: (cb: () => void, ms: number) => ReturnType<typeof setTimeout>
  clearTimer?: (id: ReturnType<typeof setTimeout>) => void
}

export function createStaleTimer(o: StaleTimerOptions): StaleTimer {
  const setTimer = o.setTimer ?? ((cb: () => void, ms: number) => setTimeout(cb, ms))
  const clearTimer = o.clearTimer ?? ((id: ReturnType<typeof setTimeout>) => clearTimeout(id))
  let lastAt = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false

  function check(): void {
    const idle = o.now() - lastAt
    if (idle >= o.staleMs) {
      timer = undefined
      o.onStale()
    } else {
      timer = setTimer(check, o.staleMs - idle)
    }
  }

  function cancel(): void {
    if (timer !== undefined) clearTimer(timer)
    timer = undefined
  }

  return {
    touch(now) {
      if (disposed) return
      lastAt = now
      timer ??= setTimer(check, o.staleMs)
    },
    cancel,
    dispose() {
      disposed = true
      cancel()
    }
  }
}

export interface Freshness {
  /** Samples arrive (true from a touch until `staleMs` without one). */
  fresh: Readonly<ShallowRef<boolean>>
  touch(): void
  /** Stale now (e.g. the player left the car). */
  expire(): void
}

/**
 * Freshness of a payload stream (the SDK can go silent for a while before the connection is
 * declared lost). With `data`, every non-null payload accepted by `isActive` touches it and
 * anything else expires it; `touch`/`expire` drive it by hand. One timer, cleared with the
 * component (or effect scope).
 */
export function useFreshness<T>(
  data: Readonly<Ref<T | null>> | null,
  staleMs: number,
  isActive?: (d: T) => boolean
): Freshness {
  const fresh = shallowRef(false)
  const timer = createStaleTimer({
    staleMs,
    now: () => performance.now(),
    onStale: () => (fresh.value = false)
  })
  function touch(): void {
    fresh.value = true
    timer.touch(performance.now())
  }
  function expire(): void {
    timer.cancel()
    fresh.value = false
  }
  if (data !== null) {
    // 'sync': each payload counts, even two delivered in the same task.
    watch(
      data,
      (d) => {
        if (d !== null && (isActive === undefined || isActive(d))) touch()
        else expire()
      },
      { flush: 'sync', immediate: data.value !== null }
    )
  }
  onScopeDispose(() => timer.dispose())
  return { fresh, touch, expire }
}
