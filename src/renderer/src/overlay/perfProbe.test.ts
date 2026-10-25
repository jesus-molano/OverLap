import { describe, expect, it } from 'vitest'
import type { WidgetDataMessage } from '@shared/types'
import { PERF_INTERVAL_MS, startPerfProbe, type PerfProbeDeps } from './perfProbe'

interface Harness {
  deps: PerfProbeDeps
  lines: string[]
  /** Moves the clock without drawing. */
  advance(ms: number): void
  /** Runs the pending frame `ms` after the current time. */
  frame(ms: number): void
  /** Fires the interval. */
  tick(): void
  data(widget: WidgetDataMessage['widget'], times: number): void
  longTasks(n: number): void
  live(): { frames: number; interval: boolean; data: number; longTasks: number }
}

function harness(): Harness {
  let t = 1_000
  let nextId = 1
  const frames = new Map<number, () => void>()
  let interval: (() => void) | null = null
  const dataCbs = new Set<(msg: WidgetDataMessage) => void>()
  let longTaskCb: ((n: number) => void) | null = null
  const lines: string[] = []
  const deps: PerfProbeDeps = {
    frames: {
      request: (cb) => {
        frames.set(nextId, cb)
        return nextId++
      },
      cancel: (id) => void frames.delete(id)
    },
    now: () => t,
    setInterval: (cb) => {
      interval = cb
      return 1
    },
    clearInterval: () => {
      interval = null
    },
    log: (line) => void lines.push(line),
    onData: (cb) => {
      dataCbs.add(cb)
      return () => void dataCbs.delete(cb)
    },
    observeLongTasks: (cb) => {
      longTaskCb = cb
      return () => {
        longTaskCb = null
      }
    },
    dpr: () => 1.25,
    scaleFactor: () => 1.25
  }
  return {
    deps,
    lines,
    advance(ms) {
      t += ms
    },
    frame(ms) {
      t += ms
      const first = [...frames][0]
      if (first === undefined) throw new Error('no frame pending')
      frames.delete(first[0])
      first[1]()
    },
    tick() {
      interval?.()
    },
    data(widget, times) {
      const msg = { widget, payload: {} } as WidgetDataMessage
      for (let i = 0; i < times; i++) for (const cb of dataCbs) cb(msg)
    },
    longTasks(n) {
      longTaskCb?.(n)
    },
    live: () => ({
      frames: frames.size,
      interval: interval !== null,
      data: dataCbs.size,
      longTasks: longTaskCb === null ? 0 : 1
    })
  }
}

describe('startPerfProbe', () => {
  it('reports frame rate, gaps, hitches, data rates, long tasks and scale', () => {
    const h = harness()
    const stop = startPerfProbe(h.deps)
    // 5 s: 310 frames 16 ms apart and one 40 ms late (311 frames).
    for (let i = 0; i < 311; i++) h.frame(i === 100 ? 40 : 16)
    h.data('radar', 300)
    h.data('standings', 20)
    h.longTasks(2)
    h.tick()
    expect(h.lines).toEqual([
      '[perf] fps=62.2 maxGapMs=40.0 hitches=1 data=radar:60,standings:4 longTasks=2 dpr=1.25/1.25'
    ])
    // Counters start over every interval: 312 frames 16 ms apart, then 8 ms to the tick.
    for (let i = 0; i < 312; i++) h.frame(16)
    h.advance(PERF_INTERVAL_MS - 312 * 16)
    h.tick()
    expect(h.lines[1]).toBe(
      '[perf] fps=62.4 maxGapMs=16.0 hitches=0 data=- longTasks=0 dpr=1.25/1.25'
    )
    stop()
  })

  it('stops the frame loop, the interval and every listener', () => {
    const h = harness()
    const stop = startPerfProbe(h.deps)
    expect(h.live()).toEqual({ frames: 1, interval: true, data: 1, longTasks: 1 })
    stop()
    expect(h.live()).toEqual({ frames: 0, interval: false, data: 0, longTasks: 0 })
    stop()
    expect(h.lines).toEqual([])
  })
})
