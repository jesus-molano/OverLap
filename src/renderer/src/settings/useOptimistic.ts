import { computed, shallowRef, type ComputedRef } from 'vue'

export interface Optimistic<T> {
  /** The value to show: the latest one sent while main has not answered it, else `source()`. */
  readonly value: ComputedRef<T>
  /**
   * Shows `next` at once and sends it. Each call goes out immediately (discrete actions, no
   * throttle), so build `next` from `value` and every action includes the ones before it.
   * Settles (never rejects) when the reply has arrived.
   */
  run(next: T, send: () => Promise<unknown>): Promise<void>
}

/**
 * Optimistic value for discrete edits (reorder, toggle) that must not be throttled: unlike a
 * throttled draft, an older pending value can never be resent after a newer one. The local
 * value is dropped once the reply to the latest send has arrived (main's settings then show).
 */
export function useOptimistic<T>(source: () => T): Optimistic<T> {
  const local = shallowRef<{ readonly v: T } | null>(null)
  return {
    value: computed(() => (local.value !== null ? local.value.v : source())),
    run(next, send) {
      const mine = { v: next }
      local.value = mine
      let sent: Promise<unknown>
      try {
        sent = send()
      } catch (err) {
        sent = Promise.reject(err)
      }
      const settle = (): void => {
        if (local.value === mine) local.value = null
      }
      return sent.then(settle, settle)
    }
  }
}
