import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MainPerfLog, PERF_INTERVAL_MS, perfEnabled } from './overlayPerf'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('MainPerfLog', () => {
  it('logs the data rate of every widget and the mouse-mode changes every interval', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const perf = new MainPerfLog()
    perf.start()
    for (let n = 0; n < 300; n++) perf.countData('radar')
    perf.countData('standings')
    perf.countModeChange()
    vi.advanceTimersByTime(PERF_INTERVAL_MS)
    const line = String(log.mock.lastCall?.[0])
    expect(line).toMatch(/^\[perf:main\] data\/s /)
    expect(line).toContain('radar=60.0')
    expect(line).toContain('standings=0.2')
    expect(line).toContain('inputs=0.0')
    expect(line).toContain('mouseModeChanges=1')
    expect(line).toMatch(/loopDelay p99=\d+\.\dms max=\d+\.\dms$/)
    // The counters start over.
    vi.advanceTimersByTime(PERF_INTERVAL_MS)
    expect(String(log.mock.lastCall?.[0])).toContain('radar=0.0')
    perf.dispose()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('is on only with OVERLAY_PERF=1', () => {
    expect(perfEnabled({ OVERLAY_PERF: '1' })).toBe(true)
    expect(perfEnabled({ OVERLAY_PERF: '0' })).toBe(false)
    expect(perfEnabled({})).toBe(false)
  })
})
