import { computed, shallowRef, type ComputedRef, type ShallowRef } from 'vue'
import type { WidgetPayloads } from '@shared/types'
import type { WidgetId } from '@shared/widgets'
import { useFreshness } from './useFreshness'
import { isLive, useOverlayState, useWidgetData } from './useOverlay'
import { injectSampleHost } from './widgetContext'

/**
 * What a widget shows:
 * - `live`: current data.
 * - `preview`: edit mode without data: sample content through the normal pipeline, so the
 *   window can be placed and sized on realistic content.
 * - `offline`: no live connection: the status text (widgets that have one).
 * - `hidden`: nothing to show.
 */
export type WidgetPhase = 'live' | 'preview' | 'offline' | 'hidden'

export interface PhaseInput {
  /** A current payload with something to show. */
  hasData: boolean
  connectionLive: boolean
  editMode: boolean
  /** The widget shows the connection status while offline (standings, relative). */
  showsOffline: boolean
}

export function widgetPhase(i: PhaseInput): WidgetPhase {
  if (i.hasData && i.connectionLive) return 'live'
  if (i.editMode) return 'preview'
  if (!i.connectionLive && i.showsOffline) return 'offline'
  return 'hidden'
}

/**
 * What a widget draws: the live data, the preview sample, or else what it drew last, so the
 * content stays put while the panel fades out (and a hidden widget never re-renders).
 */
export function shownContent<T>(
  phase: WidgetPhase,
  live: T | null,
  preview: () => T,
  prev: T | null | undefined
): T | null {
  if (phase === 'live' && live !== null) return live
  // Only built in preview, so sample data costs nothing while racing.
  if (phase === 'preview') return preview()
  return prev ?? null
}

/** `shownContent` as a computed. */
export function useShownContent<T>(
  phase: () => WidgetPhase,
  live: () => T | null,
  preview: () => T
): ComputedRef<T | null> {
  return computed((prev) => shownContent(phase(), live(), preview, prev))
}

export interface PhaseOptions<K extends WidgetId> {
  showsOffline: boolean
  /** Whether a payload has anything to show (e.g. battle: `visible` with an opponent). */
  hasContent?: (d: WidgetPayloads[K]) => boolean
  /** The payload counts as gone after this long without a new one (60 Hz widgets). */
  staleMs?: number
}

export interface WidgetPhaseState<K extends WidgetId> {
  data: ShallowRef<WidgetPayloads[K] | null>
  phase: ComputedRef<WidgetPhase>
}

const ALWAYS_PREVIEW = computed<WidgetPhase>(() => 'preview')

/**
 * The widget's payload and phase (one place for live / preview / offline / hidden). Drawn as a
 * settings sample (see SampleHost) it is always the preview, with no payload listener at all.
 */
export function useWidgetPhase<K extends WidgetId>(id: K, o: PhaseOptions<K>): WidgetPhaseState<K> {
  if (injectSampleHost() !== null) {
    return { data: shallowRef(null) as ShallowRef<WidgetPayloads[K] | null>, phase: ALWAYS_PREVIEW }
  }
  const data = useWidgetData(id)
  const { status, editMode } = useOverlayState()
  const freshness = o.staleMs === undefined ? null : useFreshness(data, o.staleMs)
  const hasData = computed(() => {
    const d = data.value
    if (d === null) return false
    if (freshness !== null && !freshness.fresh.value) return false
    return o.hasContent === undefined || o.hasContent(d)
  })
  const phase = computed(() =>
    widgetPhase({
      hasData: hasData.value,
      connectionLive: isLive(status.value),
      editMode: editMode.value,
      showsOffline: o.showsOffline
    })
  )
  return { data, phase }
}
