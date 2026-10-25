/**
 * Frame-rate probe of an overlay window, only with `?perf=1` (main adds it with OVERLAY_PERF=1).
 * Every PERF_INTERVAL_MS it logs one line to the console, which main forwards to its log:
 *
 *   [perf] fps=59.8 maxGapMs=18.2 hitches=0 data=radar:60,inputs:60 longTasks=0 dpr=1.25/1.25
 *
 * - fps: requestAnimationFrame callbacks per second (the rate the document can draw at).
 * - maxGapMs / hitches: the longest time between two frames, and the gaps over HITCH_MS.
 * - data: payloads received per second, per widget.
 * - longTasks: main-thread tasks over 50 ms (PerformanceObserver 'longtask').
 * - dpr: devicePixelRatio / the layout's scale factor (they must match).
 *
 * The frame loop allocates nothing; the line is built once per interval. Everything stops when
 * the returned function is called.
 */
import type { Unsubscribe } from '@shared/ipc'
import type { WidgetDataMessage } from '@shared/types'
import { WIDGET_IDS, type WidgetId } from '@shared/widgets'
import { overlayState } from '../composables/useOverlay'
import { ANIMATION_FRAMES, type Frames } from './timers'

export const PERF_INTERVAL_MS = 5_000
/** A frame gap longer than this is a hitch (more than one and a half 60 Hz frames). */
const HITCH_MS = 25

export interface PerfProbeDeps {
  frames: Frames
  /** Monotonic ms (performance.now). */
  now(): number
  setInterval(cb: () => void, ms: number): unknown
  clearInterval(handle: unknown): void
  log(line: string): void
  onData(cb: (msg: WidgetDataMessage) => void): Unsubscribe
  /** Calls `cb` with the number of new long tasks; returns the disconnect, null if unsupported. */
  observeLongTasks(cb: (count: number) => void): (() => void) | null
  dpr(): number
  /** The layout's scale factor; null before the first layout. */
  scaleFactor(): number | null
}

function observeLongTasks(cb: (count: number) => void): (() => void) | null {
  if (typeof PerformanceObserver === 'undefined') return null
  try {
    const observer = new PerformanceObserver((list) => cb(list.getEntries().length))
    observer.observe({ type: 'longtask', buffered: false })
    return () => observer.disconnect()
  } catch {
    return null
  }
}

function windowDeps(): PerfProbeDeps {
  return {
    frames: ANIMATION_FRAMES,
    now: () => performance.now(),
    setInterval: (cb, ms) => setInterval(cb, ms),
    clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
    log: (line) => console.info(line),
    onData: (cb) => window.overlay.onData(cb),
    observeLongTasks,
    dpr: () => window.devicePixelRatio,
    scaleFactor: () => overlayState.layout.value?.display.scaleFactor ?? null
  }
}

/** Rounded to one decimal, for the log line. */
function fixed1(v: number): string {
  return (Math.round(v * 10) / 10).toFixed(1)
}

/** Starts the probe; returns the function that stops it. */
export function startPerfProbe(deps: PerfProbeDeps = windowDeps()): () => void {
  const counts = Object.fromEntries(WIDGET_IDS.map((id) => [id, 0])) as Record<WidgetId, number>
  let frames = 0
  let maxGap = 0
  let hitches = 0
  let longTasks = 0
  let lastFrame = -1
  let since = deps.now()
  let raf = 0
  let stopped = false

  function onFrame(): void {
    if (stopped) return
    const t = deps.now()
    if (lastFrame >= 0) {
      const gap = t - lastFrame
      if (gap > maxGap) maxGap = gap
      if (gap > HITCH_MS) hitches++
    }
    lastFrame = t
    frames++
    raf = deps.frames.request(onFrame)
  }

  function report(): void {
    const t = deps.now()
    const seconds = Math.max(t - since, 1) / 1000
    const data: string[] = []
    for (const id of WIDGET_IDS) {
      if (counts[id] > 0) data.push(`${id}:${Math.round(counts[id] / seconds)}`)
      counts[id] = 0
    }
    const scale = deps.scaleFactor()
    deps.log(
      `[perf] fps=${fixed1(frames / seconds)} maxGapMs=${fixed1(maxGap)} hitches=${hitches}` +
        ` data=${data.length > 0 ? data.join(',') : '-'} longTasks=${longTasks}` +
        ` dpr=${deps.dpr()}/${scale ?? '-'}`
    )
    frames = 0
    maxGap = 0
    hitches = 0
    longTasks = 0
    since = t
  }

  const stopData = deps.onData((msg) => {
    counts[msg.widget]++
  })
  const stopLongTasks = deps.observeLongTasks((n) => {
    longTasks += n
  })
  const interval = deps.setInterval(report, PERF_INTERVAL_MS)
  raf = deps.frames.request(onFrame)

  return () => {
    if (stopped) return
    stopped = true
    deps.frames.cancel(raf)
    deps.clearInterval(interval)
    stopData()
    stopLongTasks?.()
  }
}
