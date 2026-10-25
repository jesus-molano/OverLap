/**
 * Main-process side of the overlay measurements, only with OVERLAY_PERF=1: every
 * PERF_INTERVAL_MS one line with the data messages per second of each widget, how often the
 * windows changed mouse mode and main's event-loop delay. Counting allocates nothing.
 */
import { monitorEventLoopDelay, type ELDHistogram } from 'node:perf_hooks'
import { WIDGET_IDS, type WidgetId } from '@shared/widgets'

export const PERF_INTERVAL_MS = 5_000

export function perfEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OVERLAY_PERF === '1'
}

function zeroCounts(): Record<WidgetId, number> {
  const out = {} as Record<WidgetId, number>
  for (const id of WIDGET_IDS) out[id] = 0
  return out
}

export class MainPerfLog {
  private readonly data = zeroCounts()
  private modeChanges = 0
  private histogram: ELDHistogram | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private since = 0

  start(): void {
    if (this.timer) return
    this.histogram = monitorEventLoopDelay({ resolution: 10 })
    this.histogram.enable()
    this.since = performance.now()
    this.timer = setInterval(() => this.report(), PERF_INTERVAL_MS)
  }

  countData(id: WidgetId): void {
    this.data[id]++
  }

  countModeChange(): void {
    this.modeChanges++
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.histogram?.disable()
    this.histogram = null
  }

  private report(): void {
    const now = performance.now()
    const seconds = Math.max(0.001, (now - this.since) / 1_000)
    this.since = now
    const rates = WIDGET_IDS.map((id) => `${id}=${(this.data[id] / seconds).toFixed(1)}`).join(' ')
    const h = this.histogram
    const p99 = h ? h.percentile(99) / 1e6 : 0
    const max = h ? h.max / 1e6 : 0
    console.log(
      `[perf:main] data/s ${rates} mouseModeChanges=${this.modeChanges} ` +
        `loopDelay p99=${p99.toFixed(1)}ms max=${max.toFixed(1)}ms`
    )
    for (const id of WIDGET_IDS) this.data[id] = 0
    this.modeChanges = 0
    h?.reset()
  }
}
