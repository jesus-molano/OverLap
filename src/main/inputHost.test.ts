import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ControllerInfo } from '@shared/controllers'
import { InputHost, MAX_QUICK_CRASHES, UNAVAILABLE_RETRY_MS } from './inputHost'

const fork = vi.hoisted(() => vi.fn())
vi.mock('electron', () => ({ utilityProcess: { fork } }))
// Never load the real entry: it is the utilityProcess that reads the controllers.
vi.mock('../input/index?modulePath', () => ({ default: 'input.js' }))

class FakeChild extends EventEmitter {
  readonly stdout = new PassThrough()
  readonly stderr = new PassThrough()
  readonly pid = 4321
  readonly postMessage = vi.fn()
  readonly kill = vi.fn(() => true)
}

const G29: ControllerInfo = { id: 'joy:046d:c24f:0', name: 'G29', buttons: 25 }

let children: FakeChild[]
let lists: (readonly ControllerInfo[] | null)[]
let presses: string[]
let host: InputHost

function child(i: number): FakeChild {
  const c = i < 0 ? children[children.length + i] : children[i]
  if (!c) throw new Error(`no child #${i}`)
  return c
}

beforeEach(() => {
  children = []
  fork.mockReset()
  fork.mockImplementation(() => {
    const c = new FakeChild()
    children.push(c)
    return c
  })
  vi.useFakeTimers()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  lists = []
  presses = []
  host = new InputHost({
    onDevices: (list) => lists.push(list),
    onPress: (device, button, first) => presses.push(`${device}:${button}${first ? '*' : ''}`)
  })
})

afterEach(() => {
  host.dispose()
  vi.useRealTimers()
})

describe('InputHost', () => {
  it('runs no process until it is wanted', () => {
    expect(fork).not.toHaveBeenCalled()
    host.setWanted(true)
    expect(fork).toHaveBeenCalledTimes(1)
    expect(fork.mock.calls[0]?.[0]).toBe('input.js')
    expect(host.running).toBe(true)
    // Wanted again: still one.
    host.setWanted(true)
    expect(fork).toHaveBeenCalledTimes(1)
  })

  it('passes on the controllers and the presses', () => {
    host.setWanted(true)
    child(0).emit('message', { type: 'devices', list: [G29] })
    child(0).emit('message', { type: 'press', device: G29.id, button: 7 })
    child(0).emit('message', { type: 'press', device: G29.id, button: 8, first: true })
    child(0).emit('message', { type: 'press', device: 'bad', button: 7 })
    expect(lists).toEqual([[G29]])
    expect(presses).toEqual(['joy:046d:c24f:0:7', 'joy:046d:c24f:0:8*'])
  })

  it('stops the process when no longer wanted (killed if it does not exit)', () => {
    host.setWanted(true)
    const c = child(0)
    host.setWanted(false)
    expect(host.running).toBe(false)
    expect(c.postMessage).toHaveBeenCalledWith({ type: 'shutdown' })
    expect(lists.at(-1)).toBeNull()
    // Its late messages are ignored.
    c.emit('message', { type: 'press', device: G29.id, button: 7 })
    expect(presses).toEqual([])
    vi.advanceTimersByTime(1_000)
    expect(c.kill).toHaveBeenCalled()
    c.emit('exit', 0)
    // Not restarted.
    vi.advanceTimersByTime(20_000)
    expect(fork).toHaveBeenCalledTimes(1)
  })

  it('restarts a process that dies while wanted, with backoff', () => {
    host.setWanted(true)
    child(0).emit('spawn')
    child(0).emit('exit', 1)
    expect(lists.at(-1)).toBeNull()
    expect(fork).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(500)
    expect(fork).toHaveBeenCalledTimes(2)
    child(1).emit('exit', 1)
    vi.advanceTimersByTime(500)
    expect(fork).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(500)
    expect(fork).toHaveBeenCalledTimes(3)
  })

  it('tries one that cannot read controllers once more, then waits to be wanted again', () => {
    host.setWanted(true)
    child(0).emit('message', { type: 'unavailable', detail: 'not Windows' })
    expect(lists).toEqual([[]])
    expect(child(0).postMessage).toHaveBeenCalledWith({ type: 'shutdown' })
    child(0).emit('exit', 0)
    vi.advanceTimersByTime(UNAVAILABLE_RETRY_MS - 1)
    expect(fork).toHaveBeenCalledTimes(1)
    // Still [] (the shortcuts stay unavailable), not null.
    expect(lists.at(-1)).toEqual([])
    vi.advanceTimersByTime(1)
    expect(fork).toHaveBeenCalledTimes(2)
    child(1).emit('message', { type: 'unavailable', detail: 'not Windows' })
    child(1).emit('exit', 0)
    vi.advanceTimersByTime(10 * UNAVAILABLE_RETRY_MS)
    expect(fork).toHaveBeenCalledTimes(2)
    host.setWanted(false)
    host.setWanted(true)
    expect(fork).toHaveBeenCalledTimes(3)
  })

  it('retry() starts at once one that could not read controllers', () => {
    host.setWanted(true)
    child(0).emit('message', { type: 'unavailable', detail: 'refused' })
    child(0).emit('exit', 0)
    host.retry()
    expect(fork).toHaveBeenCalledTimes(2)
    // Running: nothing more.
    host.retry()
    expect(fork).toHaveBeenCalledTimes(2)
    // The once-more try was replaced, not added.
    vi.advanceTimersByTime(UNAVAILABLE_RETRY_MS)
    expect(fork).toHaveBeenCalledTimes(2)
  })

  it('gives up after crashing quickly again and again, until retry()', () => {
    host.setWanted(true)
    for (let i = 0; i < MAX_QUICK_CRASHES; i++) {
      child(-1).emit('spawn')
      vi.advanceTimersByTime(100)
      child(-1).emit('exit', 1)
      vi.advanceTimersByTime(10_000)
    }
    expect(fork).toHaveBeenCalledTimes(MAX_QUICK_CRASHES)
    // Not readable: the buttons show as not working, not as unknown.
    expect(lists.at(-1)).toEqual([])
    vi.advanceTimersByTime(60_000)
    expect(fork).toHaveBeenCalledTimes(MAX_QUICK_CRASHES)
    // Not wanted: retry() does nothing.
    host.setWanted(false)
    host.retry()
    expect(fork).toHaveBeenCalledTimes(MAX_QUICK_CRASHES)
    host.setWanted(true)
    expect(fork).toHaveBeenCalledTimes(MAX_QUICK_CRASHES + 1)
  })

  it('counts only quick crashes in a row: one that ran a while starts the count again', () => {
    host.setWanted(true)
    for (let i = 0; i < 3 * MAX_QUICK_CRASHES; i++) {
      child(-1).emit('spawn')
      // Every other one ran long enough to count as healthy.
      vi.advanceTimersByTime(i % 2 === 0 ? 100 : 10_000)
      child(-1).emit('exit', 1)
      vi.advanceTimersByTime(10_000)
    }
    expect(fork).toHaveBeenCalledTimes(3 * MAX_QUICK_CRASHES + 1)
  })

  it('retry() after giving up starts it afresh', () => {
    host.setWanted(true)
    for (let i = 0; i < MAX_QUICK_CRASHES; i++) {
      child(-1).emit('exit', 1)
      vi.advanceTimersByTime(10_000)
    }
    expect(fork).toHaveBeenCalledTimes(MAX_QUICK_CRASHES)
    host.retry()
    expect(fork).toHaveBeenCalledTimes(MAX_QUICK_CRASHES + 1)
    // Counted afresh: one crash restarts after the shortest wait.
    child(-1).emit('exit', 1)
    vi.advanceTimersByTime(500)
    expect(fork).toHaveBeenCalledTimes(MAX_QUICK_CRASHES + 2)
  })

  it('never starts again once disposed', () => {
    host.setWanted(true)
    host.dispose()
    expect(child(0).postMessage).toHaveBeenCalledWith({ type: 'shutdown' })
    host.setWanted(true)
    expect(fork).toHaveBeenCalledTimes(1)
  })
})
