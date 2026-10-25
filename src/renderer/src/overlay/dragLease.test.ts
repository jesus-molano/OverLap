import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DRAG_HEARTBEAT_MS } from '@shared/ipc'
import { createDragLease } from './dragLease'

let sent: boolean[]

beforeEach(() => {
  vi.useFakeTimers()
  sent = []
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createDragLease', () => {
  it('says true at once, repeats it every 500 ms while dragging, and false at the end', () => {
    expect(DRAG_HEARTBEAT_MS).toBe(500)
    const lease = createDragLease({ send: (on) => sent.push(on) })
    lease.setDragging(true)
    expect(sent).toEqual([true])
    expect(lease.dragging).toBe(true)
    vi.advanceTimersByTime(499)
    expect(sent).toEqual([true])
    vi.advanceTimersByTime(1)
    expect(sent).toEqual([true, true])
    vi.advanceTimersByTime(1000)
    expect(sent).toEqual([true, true, true, true])
    lease.setDragging(false)
    expect(sent).toEqual([true, true, true, true, false])
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(5000)
    expect(sent).toHaveLength(5)
    lease.dispose()
  })

  it('sends nothing while no drag runs, and ignores repeats', () => {
    const lease = createDragLease({ send: (on) => sent.push(on) })
    lease.setDragging(false)
    expect(sent).toEqual([])
    lease.setDragging(true)
    lease.setDragging(true)
    expect(sent).toEqual([true])
    expect(vi.getTimerCount()).toBe(1)
    lease.setDragging(false)
    lease.setDragging(false)
    expect(sent).toEqual([true, false])
    lease.dispose()
  })

  it('ends a running lease on dispose and leaves no timers', () => {
    const lease = createDragLease({ send: (on) => sent.push(on) })
    lease.setDragging(true)
    lease.dispose()
    expect(sent).toEqual([true, false])
    expect(vi.getTimerCount()).toBe(0)
    lease.setDragging(true)
    vi.advanceTimersByTime(2000)
    expect(sent).toEqual([true, false])
  })

  it('uses the injected timers', () => {
    const handles: string[] = []
    let tick: (() => void) | null = null
    const lease = createDragLease({
      send: (on) => sent.push(on),
      timers: {
        setInterval: (cb, ms) => {
          expect(ms).toBe(DRAG_HEARTBEAT_MS)
          tick = cb
          return 'h1'
        },
        clearInterval: (h) => void handles.push(String(h))
      }
    })
    lease.setDragging(true)
    ;(tick as (() => void) | null)?.()
    lease.setDragging(false)
    expect(sent).toEqual([true, true, false])
    expect(handles).toEqual(['h1'])
  })
})
