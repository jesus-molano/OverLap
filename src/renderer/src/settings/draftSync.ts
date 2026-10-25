/**
 * Keeps one settings control in sync with main without flooding IPC. Pure (no Vue, no DOM).
 *
 * - `input(v)`: intermediate value (slider being dragged). Shown as a local draft and applied
 *   at most once per `intervalMs`, leading and trailing edge, so the latest value always goes out.
 * - `commit(v)`: final value (slider released, checkbox toggled, number entered). Applied through
 *   the same throttle; once main has answered it, the draft is dropped and the control shows the
 *   settings main sent back (validated and clamped), or the old value if the update failed.
 *
 * Main is the source of truth: the draft only exists between the first input and that answer.
 */
export interface DraftSyncOptions<T> {
  /** Sends the value to main. Settles when main has answered; a rejection counts as answered. */
  apply: (value: T) => Promise<unknown>
  /** Show this value instead of the settings one. */
  onDraft: (value: T) => void
  /** Show the settings value again. */
  onClear: () => void
  intervalMs: number
}

export interface DraftSync<T> {
  input(value: T): void
  commit(value: T): void
  /** Stops the throttle; a value still waiting for the trailing edge is applied now. */
  dispose(): void
}

export function createDraftSync<T>(opts: DraftSyncOptions<T>): DraftSync<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  /** Latest value waiting for the trailing edge. */
  let pending: { value: T } | null = null
  let lastSent: { value: T } | null = null
  /** Settles (never rejects) when the latest `apply` has. */
  let latest: Promise<void> = Promise.resolve()
  let sendSeq = 0
  /** Bumped by every input/commit, so a stale answer never drops a newer draft. */
  let gen = 0
  let committedGen = -1

  function whenLatestSettles(): void {
    const seq = sendSeq
    void latest.then(() => {
      if (seq === sendSeq) maybeClear()
    })
  }

  // The latest send has settled. If nothing happened since the commit, that send carried
  // the committed value (commit either reused it, sent it or queued it as `pending`).
  function maybeClear(): void {
    if (committedGen !== gen || pending !== null) return
    committedGen = -1
    opts.onClear()
  }

  function deliver(value: T): boolean {
    if (lastSent !== null && Object.is(lastSent.value, value)) {
      whenLatestSettles()
      return false
    }
    lastSent = { value }
    sendSeq++
    let result: Promise<unknown>
    try {
      result = opts.apply(value)
    } catch (err) {
      result = Promise.reject(err)
    }
    latest = result.then(noop, noop)
    whenLatestSettles()
    return true
  }

  function startTimer(): void {
    timer = setTimeout(() => {
      timer = null
      const next = pending
      pending = null
      if (next !== null && deliver(next.value)) startTimer()
    }, opts.intervalMs)
  }

  function push(value: T): void {
    if (timer !== null) {
      pending = { value }
      return
    }
    if (deliver(value)) startTimer()
  }

  return {
    input(value) {
      gen++
      opts.onDraft(value)
      push(value)
    },
    commit(value) {
      gen++
      committedGen = gen
      opts.onDraft(value)
      push(value)
    },
    dispose() {
      if (timer !== null) clearTimeout(timer)
      timer = null
      const next = pending
      pending = null
      if (next !== null) deliver(next.value)
    }
  }
}

const noop = (): undefined => undefined
