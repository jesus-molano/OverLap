import { shallowRef, type ShallowRef } from 'vue'
import type { AutoHiddenState, RendererView } from '@shared/ipc'
import type { OverlaySettings, OverlayStatus, WidgetPayloads } from '@shared/types'
import { WIDGET_IDS, type WidgetId } from '@shared/widgets'

/** States in which payloads are flowing; any other state means the last one is stale. */
export function isLive(status: OverlayStatus | null): boolean {
  return status?.state === 'connected' || status?.state === 'mock'
}

export const NOT_AUTO_HIDDEN: AutoHiddenState = Object.freeze({ hidden: false, reason: null })

/** The latest payload of each widget (a widget window only ever receives its own). */
export type LatestPayloads = { readonly [K in WidgetId]: ShallowRef<WidgetPayloads[K] | null> }

/** Window-wide state pushed by main. Every value is replaced, never mutated. */
export interface OverlayState {
  readonly status: ShallowRef<OverlayStatus | null>
  readonly editMode: ShallowRef<boolean>
  /** Whole settings object; replaced on every change from main (bounds included, while dragging). */
  readonly settings: ShallowRef<OverlaySettings | null>
  readonly view: ShallowRef<RendererView | null>
  /** A "Mostrar en" / "Ocultar en boxes" rule hides this window's widget (widget windows only). */
  readonly autoHidden: ShallowRef<AutoHiddenState>
  /**
   * Payloads, kept from the window's first moments on (before any widget component exists), so
   * the one main hands over when the window becomes ready is never lost. Dropped whenever the
   * connection stops being live (or comes back after a gap) and when a rule hides the widget,
   * so no widget keeps painting a frozen frame.
   */
  readonly latest: LatestPayloads
}

function emptyPayloads(): LatestPayloads {
  const out: Record<string, ShallowRef<unknown>> = {}
  for (const id of WIDGET_IDS) out[id] = shallowRef(null)
  return out as unknown as LatestPayloads
}

/**
 * The module store behind `useOverlayState`. Read it directly only where `useOverlayState()`
 * has already run in this window (it registers the listeners).
 */
export const overlayState: OverlayState = {
  status: shallowRef<OverlayStatus | null>(null),
  editMode: shallowRef(false),
  settings: shallowRef<OverlaySettings | null>(null),
  view: shallowRef<RendererView | null>(null),
  autoHidden: shallowRef<AutoHiddenState>(NOT_AUTO_HIDDEN),
  latest: emptyPayloads()
}

function dropPayloads(s: OverlayState): void {
  for (const id of WIDGET_IDS) s.latest[id].value = null
}

let started = false

/**
 * Connection status, edit mode, settings, auto-hide state, payloads and which page this window
 * shows, shared by the whole window. The listeners are registered once per window and live as
 * long as it does. Safe to call outside setup (no lifecycle hooks).
 */
export function useOverlayState(): OverlayState {
  if (!started) {
    started = true
    const s = overlayState
    // Events that arrive before the initial state resolves are newer: keep them.
    let editModeSeen = false
    // Status and data share one ordered channel (telemetry -> main -> renderer), so a payload
    // never arrives before the status that makes it live again.
    window.overlay.onStatus((v) => {
      const prev = s.status.value
      s.status.value = v
      // Gone, or back after a gap: what was shown belongs to the old connection.
      if (!isLive(v) || (prev !== null && !isLive(prev))) dropPayloads(s)
    })
    window.overlay.onData((msg) => {
      // Each IPC message is a fresh object: a shallowRef swap is the whole update.
      ;(s.latest[msg.widget] as ShallowRef<unknown>).value = msg.payload
    })
    window.overlay.onEditMode((e) => {
      editModeSeen = true
      s.editMode.value = e
    })
    window.overlay.onSettings((v) => (s.settings.value = v))
    window.overlay.onAutoHidden((a) => {
      const cur = s.autoHidden.value
      if (a.hidden !== cur.hidden || a.reason !== cur.reason) {
        s.autoHidden.value = a.hidden ? Object.freeze({ ...a }) : NOT_AUTO_HIDDEN
      }
      // While hidden the provider does not run: the last payload would only go stale.
      if (a.hidden) dropPayloads(s)
    })
    void window.overlay.getInitialState().then((init) => {
      s.status.value ??= init.status
      if (!editModeSeen) s.editMode.value = init.editMode
      s.settings.value ??= init.settings
      s.view.value = init.view
    })
  }
  return overlayState
}

/**
 * Latest payload of one widget (see `OverlayState.latest`): no deep reactivity over the car
 * arrays, and no listener of its own to release.
 */
export function useWidgetData<K extends WidgetId>(widget: K): ShallowRef<WidgetPayloads[K] | null> {
  return useOverlayState().latest[widget]
}
