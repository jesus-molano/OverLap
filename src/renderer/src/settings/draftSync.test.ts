import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDraftSync, type DraftSync } from './draftSync'

interface Deferred {
  value: number
  resolve: () => void
  reject: (err: unknown) => void
}

interface Harness {
  sync: DraftSync<number>
  calls: Deferred[]
  draft: { value: number | null }
  sent: () => number[]
  settleAll: () => Promise<void>
}

function setup(intervalMs = 100): Harness {
  const calls: Deferred[] = []
  const draft: { value: number | null } = { value: null }
  const sync = createDraftSync<number>({
    intervalMs,
    apply: (value) =>
      new Promise<void>((resolve, reject) => {
        calls.push({ value, resolve, reject })
      }),
    onDraft: (value) => {
      draft.value = value
    },
    onClear: () => {
      draft.value = null
    }
  })
  const sent = (): number[] => calls.map((c) => c.value)
  const settleAll = async (): Promise<void> => {
    for (const c of calls) c.resolve()
    await flushMicrotasks()
  }
  return { sync, calls, draft, sent, settleAll }
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createDraftSync', () => {
  it('applies the first input at once and the latest one at the trailing edge', () => {
    const { sync, sent, draft } = setup()
    sync.input(1)
    expect(sent()).toEqual([1])
    sync.input(2)
    sync.input(3)
    expect(sent()).toEqual([1])
    expect(draft.value).toBe(3)
    vi.advanceTimersByTime(100)
    expect(sent()).toEqual([1, 3])
  })

  it('sends at most ~10 updates per second while dragging', () => {
    const { sync, sent } = setup()
    // One input per "pixel" every 4 ms for one second.
    for (let i = 0; i < 250; i++) {
      sync.input(i)
      vi.advanceTimersByTime(4)
    }
    vi.advanceTimersByTime(100)
    expect(sent().length).toBeLessThanOrEqual(11)
    expect(sent().at(-1)).toBe(249)
  })

  it('keeps the draft until main has answered the committed value', async () => {
    const { sync, sent, draft, calls } = setup()
    sync.input(10)
    sync.input(20)
    sync.commit(25)
    expect(sent()).toEqual([10])
    vi.advanceTimersByTime(100)
    expect(sent()).toEqual([10, 25])

    calls[0]?.resolve()
    await flushMicrotasks()
    expect(draft.value).toBe(25)

    calls[1]?.resolve()
    await flushMicrotasks()
    expect(draft.value).toBeNull()
  })

  it('does not send the committed value again when it was the last one sent', async () => {
    const { sync, sent, draft, settleAll } = setup()
    sync.input(40)
    sync.commit(40)
    vi.advanceTimersByTime(500)
    expect(sent()).toEqual([40])
    await settleAll()
    expect(draft.value).toBeNull()
  })

  it('applies a commit right away when idle (checkbox, stepper)', async () => {
    const { sync, sent, draft, settleAll } = setup()
    sync.commit(1)
    expect(sent()).toEqual([1])
    expect(draft.value).toBe(1)
    await settleAll()
    expect(draft.value).toBeNull()
  })

  it('coalesces quick commits and still applies the last one', async () => {
    const { sync, sent, draft, settleAll } = setup()
    sync.commit(1)
    sync.commit(0)
    expect(sent()).toEqual([1])
    vi.advanceTimersByTime(100)
    expect(sent()).toEqual([1, 0])
    await settleAll()
    expect(draft.value).toBeNull()
  })

  it('drops the draft when the update fails, so the control shows the settings value', async () => {
    const { sync, draft, calls } = setup()
    sync.commit(7)
    calls[0]?.reject(new Error('rejected by main'))
    await flushMicrotasks()
    expect(draft.value).toBeNull()
  })

  it('treats an apply that throws like a failed update', async () => {
    const draft: { value: number | null } = { value: null }
    const sync = createDraftSync<number>({
      intervalMs: 100,
      apply: () => {
        throw new Error('boom')
      },
      onDraft: (v) => (draft.value = v),
      onClear: () => (draft.value = null)
    })
    sync.commit(3)
    await flushMicrotasks()
    expect(draft.value).toBeNull()
  })

  it('keeps a newer draft when an older commit is answered', async () => {
    const { sync, draft, calls, sent } = setup()
    sync.commit(5)
    sync.input(6)
    calls[0]?.resolve()
    await flushMicrotasks()
    expect(draft.value).toBe(6)
    vi.advanceTimersByTime(100)
    expect(sent()).toEqual([5, 6])
  })

  it('applies a pending value on dispose', () => {
    const { sync, sent } = setup()
    sync.input(1)
    sync.input(2)
    sync.dispose()
    expect(sent()).toEqual([1, 2])
    vi.advanceTimersByTime(1000)
    expect(sent()).toEqual([1, 2])
  })
})
