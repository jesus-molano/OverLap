/**
 * Sequence numbers of an overlay window's `BoundsCommit`s and the commits still awaiting main's
 * acknowledgement (`OverlayLayout.ackSeq`). A panel keeps drawing what it committed until then,
 * so it never flashes back to its old place; a commit main never acknowledges is dropped after
 * EXPIRY_MS (the panel then draws main's rect again). `seq` starts at 1 in every document.
 * One timer for the whole window, armed only while something is pending. Pure: time and timers
 * are injected.
 */
import { GLOBAL_TIMERS, type Timers } from './timers'

/** A commit not acknowledged after this long is dropped (main lost it, or ignored it). */
export const COMMIT_EXPIRY_MS = 2_000

export interface CommitTrackerOptions<K> {
  /** `key`'s pending commit is over: acknowledged or expired (not called by `forget`). */
  onSettled(key: K): void
  /** `key`'s commit `seq` expired unacknowledged (before `onSettled`). */
  onExpired?(key: K, seq: number): void
  expiryMs?: number
  now?: () => number
  timers?: Timers
}

export interface CommitTracker<K> {
  /** The next sequence number: 1, 2, 3... */
  nextSeq(): number
  /** `key` awaits the acknowledgement of `seq` (replaces an older pending commit of `key`). */
  hold(key: K, seq: number): void
  isPending(key: K): boolean
  /** Main processed every commit up to `ackSeq`: those pending are settled. */
  ack(ackSeq: number): void
  /** `key` is gone (its panel unmounted): drops its pending commit silently. */
  forget(key: K): void
  /** Stops the timer and forgets everything; nothing is called afterwards. */
  dispose(): void
}

interface Pending {
  seq: number
  at: number
}

export function createCommitTracker<K>(o: CommitTrackerOptions<K>): CommitTracker<K> {
  const timers = o.timers ?? GLOBAL_TIMERS
  const now = o.now ?? Date.now
  const expiryMs = o.expiryMs ?? COMMIT_EXPIRY_MS
  const pending = new Map<K, Pending>()
  let seq = 0
  let timer: unknown = null
  let disposed = false

  function disarm(): void {
    if (timer === null) return
    timers.clearTimeout(timer)
    timer = null
  }

  /** Arms the timer for the oldest pending commit (none: no timer). */
  function arm(): void {
    disarm()
    if (disposed) return
    let oldest = Infinity
    for (const p of pending.values()) oldest = Math.min(oldest, p.at)
    if (oldest === Infinity) return
    timer = timers.setTimeout(expire, Math.max(0, oldest + expiryMs - now()))
  }

  function expire(): void {
    timer = null
    const t = now()
    for (const [key, p] of [...pending]) {
      if (t - p.at < expiryMs) continue
      pending.delete(key)
      o.onExpired?.(key, p.seq)
      o.onSettled(key)
    }
    arm()
  }

  return {
    nextSeq() {
      seq += 1
      return seq
    },
    hold(key, s) {
      if (disposed) return
      pending.set(key, { seq: s, at: now() })
      if (timer === null) arm()
    },
    isPending(key) {
      return pending.has(key)
    },
    ack(ackSeq) {
      if (disposed || pending.size === 0) return
      let settled = false
      for (const [key, p] of [...pending]) {
        if (p.seq > ackSeq) continue
        pending.delete(key)
        settled = true
        o.onSettled(key)
      }
      if (settled) arm()
    },
    forget(key) {
      if (pending.delete(key)) arm()
    },
    dispose() {
      disposed = true
      disarm()
      pending.clear()
    }
  }
}
