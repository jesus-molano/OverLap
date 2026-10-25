import { computed, watch, type ComputedRef } from 'vue'
import type { WidgetPhase } from '@renderer/composables/useWidgetPhase'
import type { RadarData } from '@shared/types'
import { NO_MARKS, WIDGET_PRECISION, sameMarks, toCarMarks, type CarMark } from './geometry'
import { LaneEaser } from './laneEaser'

/**
 * The cars the radar draws from the shown frame (`content`), as a computed that keeps its
 * previous array unless what it draws changed: a payload that moves nothing visible does not
 * re-render, and while hidden the content is frozen, so no payload can repaint an invisible
 * radar.
 *
 * A car changing lane (coming alongside, or back in your lane after its side hold) slides there
 * over ~170 ms instead of jumping a lane in one frame: only its x, one step per frame computed,
 * so nothing ticks once the cars settle (laneEaser.ts). The easer forgets every car the moment
 * the phase changes, before the next frame is computed: a radar shown again, the preview or the
 * live data after it draws every car straight at its lane, never from a stale one. The payload
 * carries no session id: a new session normally passes through a hidden radar (out of the car,
 * payloads stale, or dropped with the connection), and the easer only ever knows the cars of the
 * last frame drawn, each forgotten the frame it leaves the radar. A car still beside you across
 * a session switch is the same car (same CarIdx within an event): at worst it slides once.
 */
export function useCarMarks(
  content: () => RadarData | null,
  phase: () => WidgetPhase,
  now: () => number = () => performance.now()
): ComputedRef<readonly CarMark[]> {
  const easer = new LaneEaser({ posSteps: WIDGET_PRECISION.pos })
  watch(phase, () => easer.reset(), { flush: 'sync' })
  return computed<readonly CarMark[]>((prev) => {
    const d = content()
    const marks = d !== null ? toCarMarks(d.cars, d.rangeM, WIDGET_PRECISION) : NO_MARKS
    const next = easer.ease(marks, now())
    return prev !== undefined && sameMarks(prev, next) ? prev : next
  })
}
