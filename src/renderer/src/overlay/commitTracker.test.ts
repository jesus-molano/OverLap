import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COMMIT_EXPIRY_MS, createCommitTracker, type CommitTracker } from './commitTracker'

let settled: string[]
let expired: [string, number][]

function makeTracker(): CommitTracker<string> {
  return createCommitTracker<string>({
    onSettled: (k) => settled.push(k),
    onExpired: (k, seq) => expired.push([k, seq])
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  settled = []
  expired = []
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createCommitTracker', () => {
  it('numbers commits from 1', () => {
    const t = makeTracker()
    expect([t.nextSeq(), t.nextSeq(), t.nextSeq()]).toEqual([1, 2, 3])
  })

  it('settles what main acknowledged, keeps the rest, and has a timer only while pending', () => {
    const t = makeTracker()
    expect(vi.getTimerCount()).toBe(0)
    t.hold('radar', t.nextSeq())
    t.hold('inputs', t.nextSeq())
    expect(vi.getTimerCount()).toBe(1)
    t.ack(1)
    expect(settled).toEqual(['radar'])
    expect(t.isPending('radar')).toBe(false)
    expect(t.isPending('inputs')).toBe(true)
    t.ack(1) // nothing new
    expect(settled).toEqual(['radar'])
    t.ack(5)
    expect(settled).toEqual(['radar', 'inputs'])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a newer commit of the same key replaces the older one', () => {
    const t = makeTracker()
    t.hold('radar', t.nextSeq())
    t.hold('radar', t.nextSeq())
    t.ack(1)
    expect(settled).toEqual([])
    t.ack(2)
    expect(settled).toEqual(['radar'])
  })

  it('drops a commit never acknowledged, and only that one', () => {
    const t = makeTracker()
    t.hold('radar', t.nextSeq())
    vi.advanceTimersByTime(COMMIT_EXPIRY_MS / 2)
    t.hold('inputs', t.nextSeq())
    vi.advanceTimersByTime(COMMIT_EXPIRY_MS / 2)
    expect(expired).toEqual([['radar', 1]])
    expect(settled).toEqual(['radar'])
    expect(t.isPending('inputs')).toBe(true)
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(COMMIT_EXPIRY_MS / 2)
    expect(expired).toEqual([
      ['radar', 1],
      ['inputs', 2]
    ])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('forget drops silently; dispose leaves no timer and settles nothing more', () => {
    const t = makeTracker()
    t.hold('radar', t.nextSeq())
    t.forget('radar')
    expect(t.isPending('radar')).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    t.hold('inputs', t.nextSeq())
    t.dispose()
    expect(vi.getTimerCount()).toBe(0)
    t.ack(10)
    t.hold('delta', 11)
    vi.advanceTimersByTime(COMMIT_EXPIRY_MS * 2)
    expect(settled).toEqual([])
    expect(expired).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })
})
