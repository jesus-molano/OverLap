import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ControllerInfo } from '@shared/controllers'
import { ButtonReader, POLL_MS, type ControllerSource, type SourceEvent } from './buttons'

const G29: ControllerInfo = {
  id: 'joy:046d:c24f:0',
  name: 'G29 Driving Force Racing Wheel',
  buttons: 25
}
/** Two boxes of one maker: same name, other product ids. */
const BOX_A: ControllerInfo = { id: 'joy:1dd2:2201:0', name: 'BU0836X Interface', buttons: 32 }
const BOX_B: ControllerInfo = { id: 'joy:1dd2:2202:0', name: 'BU0836X Interface', buttons: 32 }
/** A 128-button box. */
const BIG: ControllerInfo = { id: 'joy:16d0:0f3a:0', name: 'SimBox 128', buttons: 128 }

/** A controller source fed by the test: events queue up until the reader polls. */
class FakeSource implements ControllerSource {
  readonly queue: SourceEvent[] = []
  closed = false
  failNext = false

  poll(emit: (e: SourceEvent) => void): void {
    if (this.failNext) throw new Error('device gone wrong')
    for (const e of this.queue.splice(0)) emit(e)
  }

  close(): void {
    this.closed = true
  }

  plug(handle: string, device: ControllerInfo): void {
    this.queue.push({ kind: 'arrival', handle, device })
  }

  unplug(handle: string): void {
    this.queue.push({ kind: 'removal', handle })
  }

  /** One report of `handle` with these buttons down. */
  report(handle: string, pressed: number[], reportId = 0): void {
    this.queue.push({ kind: 'report', handle, reportId, pressed })
  }
}

let source: FakeSource
let presses: string[]
let lists: ControllerInfo[][]
let errors: unknown[]
let reader: ButtonReader

function tick(): void {
  vi.advanceTimersByTime(POLL_MS)
}

beforeEach(() => {
  vi.useFakeTimers()
  source = new FakeSource()
  presses = []
  lists = []
  errors = []
  reader = new ButtonReader({
    source,
    onPress: (device, button) => presses.push(`${device}:${button}`),
    onDevices: (list) => lists.push(list),
    onError: (err) => errors.push(err)
  })
})

afterEach(() => {
  reader.stop()
  vi.useRealTimers()
})

describe('ButtonReader', () => {
  it('sends the controllers there at start, once, even when there are none', () => {
    reader.start()
    expect(lists).toEqual([[]])
    reader.stop()
    source = new FakeSource()
    source.plug('1', G29)
    lists = []
    reader = new ButtonReader({
      source,
      onPress: () => {},
      onDevices: (list) => lists.push(list),
      onError: () => {}
    })
    reader.start()
    tick()
    expect(lists).toEqual([[G29]])
  })

  it('reports a press once, not while it is held, and again after a release', () => {
    source.plug('1', G29)
    reader.start()
    source.report('1', [7])
    tick()
    expect(presses).toEqual(['joy:046d:c24f:0:7'])
    // Held: the wheel keeps sending reports (an axis moves) with 7 still down.
    for (let i = 0; i < 50; i++) source.report('1', [7])
    tick()
    expect(presses).toHaveLength(1)
    // Another button while 7 is held: only that one.
    source.report('1', [7, 3])
    tick()
    expect(presses).toEqual(['joy:046d:c24f:0:7', 'joy:046d:c24f:0:3'])
    // Released, then pressed again.
    source.report('1', [])
    source.report('1', [7])
    tick()
    expect(presses).toEqual(['joy:046d:c24f:0:7', 'joy:046d:c24f:0:3', 'joy:046d:c24f:0:7'])
  })

  it('reports nothing on a release', () => {
    source.plug('1', G29)
    reader.start()
    source.report('1', [1, 2])
    tick()
    presses = []
    source.report('1', [1])
    source.report('1', [])
    tick()
    expect(presses).toEqual([])
  })

  it('keeps the buttons of each report apart (a controller sending them in several)', () => {
    source.plug('1', BIG)
    reader.start()
    source.report('1', [5], 1)
    // Report 2 carries other buttons (or none): 5 stays down.
    source.report('1', [70], 2)
    source.report('1', [], 2)
    source.report('1', [5], 1)
    tick()
    expect(presses).toEqual(['joy:16d0:0f3a:0:5', 'joy:16d0:0f3a:0:70'])
  })

  it('reads more than 32 buttons', () => {
    source.plug('1', BIG)
    reader.start()
    source.report('1', [33])
    source.report('1', [33, 64, 128])
    tick()
    expect(presses).toEqual(['joy:16d0:0f3a:0:33', 'joy:16d0:0f3a:0:64', 'joy:16d0:0f3a:0:128'])
  })

  it('forgets an unplugged controller and reads it again once plugged back', () => {
    source.plug('1', G29)
    reader.start()
    tick()
    source.report('1', [7])
    tick()
    source.unplug('1')
    tick()
    expect(lists.at(-1)).toEqual([])
    // A report racing the removal is dropped.
    source.report('1', [8])
    tick()
    expect(presses).toEqual(['joy:046d:c24f:0:7'])
    // Back (Windows gives it a new handle): 7 down again is a new press.
    source.plug('2', G29)
    source.report('2', [7])
    tick()
    expect(lists.at(-1)).toEqual([G29])
    expect(presses).toEqual(['joy:046d:c24f:0:7', 'joy:046d:c24f:0:7'])
  })

  it('sends one list for a burst of arrivals, and none when nothing changed', () => {
    reader.start()
    lists = []
    source.plug('1', G29)
    source.plug('2', BOX_A)
    source.plug('1', G29)
    tick()
    expect(lists).toHaveLength(1)
    tick()
    source.plug('2', BOX_A)
    tick()
    expect(lists).toHaveLength(1)
  })

  it('tells two controllers with the same name apart by their ids', () => {
    source.plug('1', BOX_A)
    source.plug('2', BOX_B)
    reader.start()
    tick()
    expect(lists.at(-1)).toEqual([BOX_A, BOX_B])
    source.report('2', [4])
    source.report('1', [4])
    tick()
    expect(presses).toEqual(['joy:1dd2:2202:0:4', 'joy:1dd2:2201:0:4'])
  })

  it('lists two identical controllers once, and follows their buttons apart', () => {
    source.plug('1', G29)
    source.plug('2', G29)
    reader.start()
    tick()
    expect(lists.at(-1)).toEqual([G29])
    source.report('1', [7])
    // The other one's 7 goes down while the first is held: a press of its own.
    source.report('2', [7])
    tick()
    expect(presses).toEqual(['joy:046d:c24f:0:7', 'joy:046d:c24f:0:7'])
    // One unplugged: the id is still there.
    source.unplug('1')
    tick()
    expect(lists.at(-1)).toEqual([G29])
  })

  it('ignores reports of controllers it does not know', () => {
    reader.start()
    source.report('9', [1])
    tick()
    expect(presses).toEqual([])
  })

  it('stops and reports a source that throws; stop closes the source', () => {
    reader.start()
    source.failNext = true
    tick()
    expect(errors).toHaveLength(1)
    expect(source.closed).toBe(true)
    // No more polling.
    source.failNext = false
    source.plug('1', G29)
    tick()
    expect(lists).toEqual([[]])
  })

  it('polls every POLL_MS (10 ms) and nothing once stopped', () => {
    const poll = vi.spyOn(source, 'poll')
    reader.start()
    expect(poll).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(100)
    expect(poll).toHaveBeenCalledTimes(11)
    reader.stop()
    vi.advanceTimersByTime(100)
    expect(poll).toHaveBeenCalledTimes(11)
  })
})
