import { shallowRef, type ShallowRef } from 'vue'
import type { AutoHiddenMap, AutoHiddenState, OverlayLayout, RendererView } from '@shared/ipc'
import type { ShortcutStatusMap } from '@shared/shortcuts'
import type { OverlaySettings, OverlayStatus, WidgetPayloads } from '@shared/types'
import { WIDGET_IDS, type WidgetId } from '@shared/widgets'

/** States in which payloads are flowing; any other state means the last one is stale. */
export function isLive(status: OverlayStatus | null): boolean {
  return status?.state === 'connected' || status?.state === 'mock'
}

export const NOT_AUTO_HIDDEN: AutoHiddenState = Object.freeze({ hidden: false, reason: null })

/** The latest payload of each widget (an overlay window only receives the ones it hosts). */
export type LatestPayloads = { readonly [K in WidgetId]: ShallowRef<WidgetPayloads[K] | null> }

/** Each widget's visibility-rule state (NOT_AUTO_HIDDEN, or a frozen state while hidden). */
export type AutoHiddenRefs = { readonly [K in WidgetId]: ShallowRef<AutoHiddenState> }

/** Window-wide state pushed by main. Every value is replaced, never mutated. */
export interface OverlayState {
  readonly status: ShallowRef<OverlayStatus | null>
  readonly editMode: ShallowRef<boolean>
  /** Whole settings object; replaced on every change from main (bounds included). */
  readonly settings: ShallowRef<OverlaySettings | null>
  readonly view: ShallowRef<RendererView | null>
  /** Settings window: the user hid every overlay window (tray, shortcut). */
  readonly overlayHidden: ShallowRef<boolean>
  /** Settings window: how each configured shortcut is doing (null until main says). */
  readonly shortcutStatus: ShallowRef<ShortcutStatusMap | null>
  /**
   * Overlay windows: what this window hosts and where (the highest revision seen). Null in the
   * settings window, and until the first layout arrives.
   */
  readonly layout: ShallowRef<OverlayLayout | null>
  /**
   * Overlay windows: every widget's "Mostrar en" / "Ocultar en boxes" state (main sends every
   * widget's to every overlay window). Always shown in the settings window.
   */
  readonly autoHiddenOf: AutoHiddenRefs
  /**
   * Payloads, kept from the window's first moments on (before any widget component exists), so
   * the one main hands over when the window becomes ready is never lost. Dropped whenever the
   * connection stops being live (or comes back after a gap), for one widget when a rule hides it
   * or the window stops hosting it, so no widget keeps painting a frozen frame.
   */
  readonly latest: LatestPayloads
}

function emptyPayloads(): LatestPayloads {
  const out: Record<string, ShallowRef<unknown>> = {}
  for (const id of WIDGET_IDS) out[id] = shallowRef(null)
  return out as unknown as LatestPayloads
}

function shownEverywhere(): AutoHiddenRefs {
  const out: Record<string, ShallowRef<AutoHiddenState>> = {}
  for (const id of WIDGET_IDS) out[id] = shallowRef(NOT_AUTO_HIDDEN)
  return Object.freeze(out) as unknown as AutoHiddenRefs
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
  overlayHidden: shallowRef(false),
  shortcutStatus: shallowRef<ShortcutStatusMap | null>(null),
  layout: shallowRef<OverlayLayout | null>(null),
  autoHiddenOf: shownEverywhere(),
  latest: emptyPayloads()
}

function dropPayloads(s: OverlayState): void {
  for (const id of WIDGET_IDS) s.latest[id].value = null
}

/** A frozen copy of the state (no extra fields from the message), NOT_AUTO_HIDDEN when shown. */
function frozenState(a: AutoHiddenState): AutoHiddenState {
  return a.hidden ? Object.freeze({ hidden: true, reason: a.reason }) : NOT_AUTO_HIDDEN
}

/** Sets one widget's state unless it is the same; while hidden its payload only goes stale. */
function setAutoHidden(s: OverlayState, id: WidgetId, a: AutoHiddenState): void {
  const ref = s.autoHiddenOf[id]
  const cur = ref.value
  if (a.hidden !== cur.hidden || a.reason !== cur.reason) ref.value = frozenState(a)
  // While hidden the provider does not run: the last payload would only go stale.
  if (a.hidden) s.latest[id].value = null
}

/** Keeps the layout with the highest revision; a widget it no longer hosts loses its payload. */
function adoptLayout(s: OverlayState, next: OverlayLayout): void {
  const prev = s.layout.value
  if (prev !== null && next.revision <= prev.revision) return
  s.layout.value = next
  if (prev === null) return
  for (const p of prev.panels) {
    if (!next.panels.some((n) => n.widget === p.widget)) s.latest[p.widget].value = null
  }
}

let started = false

/**
 * Connection status, edit mode, settings, layout, auto-hide states, payloads, the hidden overlay,
 * the shortcuts' status and which page this window shows, shared by the whole window. The
 * listeners are registered once per window and live as long as it does. Safe to call outside
 * setup (no lifecycle hooks).
 */
export function useOverlayState(): OverlayState {
  if (!started) {
    started = true
    const s = overlayState
    // Events that arrive before the initial state resolves are newer: keep them.
    let editModeSeen = false
    let overlayHiddenSeen = false
    const autoHiddenSeen = new Set<WidgetId>()
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
      autoHiddenSeen.add(a.widget)
      setAutoHidden(s, a.widget, a)
    })
    window.overlay.onLayout((layout) => adoptLayout(s, layout))
    window.overlay.onOverlayHidden((hidden) => {
      overlayHiddenSeen = true
      s.overlayHidden.value = hidden
    })
    window.overlay.onShortcutStatus((status) => (s.shortcutStatus.value = status))
    void window.overlay.getInitialState().then((init) => {
      s.status.value ??= init.status
      if (!editModeSeen) s.editMode.value = init.editMode
      s.settings.value ??= init.settings
      s.view.value = init.view
      if (!overlayHiddenSeen) s.overlayHidden.value = init.overlayHidden
      s.shortcutStatus.value ??= init.shortcutStatus
      if (init.layout !== null) adoptLayout(s, init.layout)
      const map: AutoHiddenMap = init.autoHidden
      for (const id of WIDGET_IDS) {
        if (!autoHiddenSeen.has(id)) setAutoHidden(s, id, map[id] ?? NOT_AUTO_HIDDEN)
      }
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

/** One widget's visibility-rule state (`OverlayState.autoHiddenOf`); no listener of its own. */
export function useAutoHidden(widget: WidgetId): Readonly<ShallowRef<AutoHiddenState>> {
  return useOverlayState().autoHiddenOf[widget]
}
