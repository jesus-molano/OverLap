/**
 * The panels of an overlay window (OverlayApp, WidgetSlot): the window's slot registry, and
 * each panel's slot: where it is drawn (the layout rect from main, the drag rect of an edit
 * interaction, or a committed rect awaiting main's acknowledgement, with the fitted height of an
 * auto-height widget), whether it is shown, and what it sends back to main (`BoundsCommit`s
 * stamped with the layout's session and revision and the window's sequence numbers).
 *
 * Rects are window-local CSS px (= DIP at zoom 1), integers. Nothing here allocates per data
 * frame: a panel's rect and style change only with the layout, a fit or an edit interaction.
 */
import {
  computed,
  inject,
  onErrorCaptured,
  onScopeDispose,
  provide,
  shallowRef,
  watch,
  type ComponentPublicInstance,
  type ComputedRef,
  type InjectionKey,
  type ShallowRef
} from 'vue'
import { deepEqual } from '@shared/equal'
import type { BoundsCommit, OverlayDisplay, OverlayLayout, OverlayPanel } from '@shared/ipc'
import { widgetShown } from '@shared/panelGeometry'
import { rectsEqual } from '@shared/settings'
import type { Point, Rect, Size } from '@shared/types'
import { PAINT_ORDER, WIDGET_DEFS, type WidgetId } from '@shared/widgets'
import { useAutoHidden, useOverlayState } from '../composables/useOverlay'
import { useWidgetSettings } from '../composables/useWidgetSettings'
import type { PanelHost } from '../composables/widgetContext'
import { reuseView } from '../view/reuse'
import type { InlineStyle } from '../view/styles'
import { createCommitTracker, type CommitTracker } from './commitTracker'
import type { SlotHandle, SlotRegistry } from './contract'
import { createHeightGate } from './heightGate'
import { sanitizeContentHeight, slotRect, slotStyle } from './slotGeometry'
import { ANIMATION_FRAMES, GLOBAL_TIMERS, type Frames, type Timers } from './timers'

/** What the slots need from the window (fakes in tests). */
export interface SlotEnv {
  commitBounds(msg: BoundsCommit): void
  frames: Frames
  timers: Timers
  now(): number
  warn(message: string): void
}

function windowEnv(): SlotEnv {
  return {
    commitBounds: (msg) => window.overlay.commitBounds(msg),
    frames: ANIMATION_FRAMES,
    timers: GLOBAL_TIMERS,
    now: () => Date.now(),
    warn: (message) => console.warn(message)
  }
}

/** What a slot registers with its window. */
interface SlotEntry {
  readonly handle: SlotHandle
  /** Its pending commit was acknowledged (or expired): draw main's rect again. */
  settle(): void
}

/** The registry of an overlay window, with what its own slots need. */
export interface OverlayRegistry extends SlotRegistry {
  /** The window's layout; null until the first. */
  readonly layout: Readonly<ShallowRef<OverlayLayout | null>>
  /** The widgets this window hosts, PAINT_ORDER (later ones on top). Same array while equal. */
  readonly widgets: ComputedRef<readonly WidgetId[]>
  readonly env: SlotEnv
  /** Sequence numbers and pending commits of the whole window. */
  readonly tracker: CommitTracker<WidgetId>
  /** Adds a slot; the returned function removes it (and drops its pending commit). */
  register(entry: SlotEntry): () => void
}

const NO_WIDGETS: readonly WidgetId[] = Object.freeze([])

/**
 * The registry of this overlay window (OverlayApp's setup, once). Everything it installs is
 * removed with that scope.
 */
export function createSlotRegistry(env: SlotEnv = windowEnv()): OverlayRegistry {
  const { layout } = useOverlayState()
  const entries = new Map<WidgetId, SlotEntry>()
  const slots = shallowRef<readonly SlotHandle[]>([])

  const display = computed<OverlayDisplay | null>((prev) => {
    const d = layout.value?.display ?? null
    return prev !== undefined && prev !== null && d !== null && deepEqual(prev, d) ? prev : d
  })
  const widgets = computed<readonly WidgetId[]>((prev) => {
    const panels = layout.value?.panels ?? []
    const next = PAINT_ORDER.filter((id) => panels.some((p) => p.widget === id))
    if (prev !== undefined && prev.length === next.length && prev.every((w, i) => w === next[i])) {
      return prev
    }
    return next.length === 0 ? NO_WIDGETS : next
  })

  const tracker = createCommitTracker<WidgetId>({
    onSettled: (id) => entries.get(id)?.settle(),
    onExpired: (id, seq) =>
      env.warn(`[overlay] ${id}: commit ${seq} was never acknowledged, dropped`),
    timers: env.timers,
    now: env.now
  })
  // Sync: the acknowledgement and the new rects of the same layout are drawn in one render.
  const stopAck = watch(
    layout,
    (l) => {
      if (l !== null) tracker.ack(l.ackSeq)
    },
    { flush: 'sync', immediate: true }
  )

  function publish(): void {
    const next: SlotHandle[] = []
    for (const id of PAINT_ORDER) {
      const e = entries.get(id)
      if (e !== undefined) next.push(e.handle)
    }
    slots.value = next
  }

  onScopeDispose(() => {
    stopAck()
    tracker.dispose()
    entries.clear()
  })

  return {
    slots,
    display,
    slot: (id) => entries.get(id)?.handle,
    layout,
    widgets,
    env,
    tracker,
    register(entry) {
      const id = entry.handle.id
      entries.set(id, entry)
      publish()
      return () => {
        if (entries.get(id) !== entry) return
        entries.delete(id)
        tracker.forget(id)
        publish()
      }
    }
  }
}

const OVERLAY_REGISTRY: InjectionKey<OverlayRegistry> = Symbol('overlay-registry')

/** OverlayApp: the registry for its slots (the edit layer gets it from `useEditSession`). */
export function provideOverlayRegistry(registry: OverlayRegistry): void {
  provide(OVERLAY_REGISTRY, registry)
}

/** WidgetSlot: the registry of its window (setup only). Throws outside OverlayApp. */
export function injectOverlayRegistry(): OverlayRegistry {
  const registry = inject(OVERLAY_REGISTRY, null)
  if (registry === null) throw new Error('injectOverlayRegistry(): not inside OverlayApp')
  return registry
}

/** Everything WidgetSlot draws one panel with. */
export interface SlotView {
  readonly handle: SlotHandle
  /** For the widget below (auto height, reveal). */
  readonly host: PanelHost
  /** Inline style of the slot element (position and size, edges on device pixels). */
  readonly style: ComputedRef<InlineStyle>
  /** The widget is rendered. */
  readonly shown: ComputedRef<boolean>
  /** The panel is on screen at all: the widget is shown, or it is a ghost in edit mode. */
  readonly onScreen: ComputedRef<boolean>
  /** The widget component exists: from the first time it is shown, for the slot's whole life. */
  readonly mounted: ComputedRef<boolean>
  /** An edit interaction draws its own rect. */
  readonly dragging: ComputedRef<boolean>
}

interface FitWaiter {
  resolve(): void
  timer: unknown
}

function copyRect(r: Rect): Rect {
  return { x: r.x, y: r.y, width: r.width, height: r.height }
}

/** A whole number in [0, max] (0 for anything that is not a finite number). */
function clampInt(v: number, max: number): number {
  return Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v))) : 0
}

/**
 * One panel of the window (WidgetSlot's setup). Everything it installs is removed with that
 * scope: the slot leaves the registry, its timers and frame are cancelled and a pending
 * `waitForFit` resolves.
 */
export function useSlot(registry: OverlayRegistry, id: WidgetId): SlotView {
  const { editMode } = useOverlayState()
  const autoHidden = useAutoHidden(id)
  const prefs = useWidgetSettings(id)
  const def = WIDGET_DEFS[id]
  const env = registry.env
  const fallbackRect: Rect = Object.freeze({
    x: 0,
    y: 0,
    width: def.minSize.width,
    height: def.minSize.height
  })
  let disposed = false

  // The last panel main sent: while the slot unmounts, the next layout may not have it.
  const panel = computed<OverlayPanel | null>(
    (prev) => registry.layout.value?.panels.find((p) => p.widget === id) ?? prev ?? null
  )
  const layoutRect = computed<Rect>((prev) => {
    const r = panel.value?.rect ?? fallbackRect
    return prev !== undefined && rectsEqual(prev, r) ? prev : r
  })
  const placement = computed(() => panel.value?.placement ?? 0)
  const dragRect = shallowRef<Rect | null>(null)
  const pendingRect = shallowRef<Rect | null>(null)
  /** Content height applied (heightGate, on the next frame); null before the first report. */
  const fitted = shallowRef<number | null>(null)

  const autoHeight = computed(() => def.sizeModel === 'auto-height' && prefs.value.autoHeight)
  const locked = computed(() => prefs.value.locked)
  const ghost = computed(() => panel.value?.ghost === true)
  const shown = computed(() =>
    widgetShown({
      userVisible: !ghost.value,
      autoHidden: autoHidden.value.hidden,
      editing: editMode.value
    })
  )
  const onScreen = computed(() => shown.value || (ghost.value && editMode.value))
  // Latched: once true it no longer reads `shown`.
  const mounted = computed<boolean>((prev) => prev === true || shown.value)
  const dragging = computed(() => dragRect.value !== null)

  const drawn = computed<Rect>((prev) => {
    const base = dragRect.value ?? pendingRect.value ?? layoutRect.value
    const d = registry.display.value
    const r =
      d === null
        ? base
        : slotRect({
            base,
            autoHeight: autoHeight.value,
            anchor: prefs.value.anchor,
            fitted: fitted.value,
            workArea: d.workArea,
            minHeight: def.minSize.height
          })
    return prev !== undefined && rectsEqual(prev, r) ? prev : r
  })
  const style = computed<InlineStyle>((prev) =>
    reuseView(prev, slotStyle(drawn.value, registry.display.value?.scaleFactor ?? 1))
  )
  const size = computed<Size>((prev) => {
    const { width, height } = drawn.value
    return prev !== undefined && prev.width === width && prev.height === height
      ? prev
      : { width, height }
  })

  // ---- Auto height -------------------------------------------------------

  const waiters = new Set<FitWaiter>()
  let frame = 0

  function settleWaiter(w: FitWaiter): void {
    if (!waiters.delete(w)) return
    env.timers.clearTimeout(w.timer)
    w.resolve()
  }

  function settleWaiters(): void {
    for (const w of [...waiters]) settleWaiter(w)
  }

  // On the next frame, never inside the ResizeObserver delivery that measured the content:
  // resizing the panel there would make the observers loop within one frame.
  function applyFit(): void {
    frame = 0
    fitted.value = gate.applied
    // After the slot re-rendered (Vue flushes before these continuations run).
    settleWaiters()
  }

  const gate = createHeightGate({
    onChange: () => {
      if (frame === 0 && !disposed) frame = env.frames.request(applyFit)
    },
    timers: env.timers
  })

  /**
   * The height main has for this panel: the layout's, or the last 'fit' sent since (main applies
   * a fit without sending a layout back). Main clamps it to the same work area, so both agree.
   */
  let mainHeight = layoutRect.value.height

  // Turned off: forget every height, so turning it back on never jumps to an old one first.
  // Main's height is the layout's again: main sends its current rects before the settings that
  // turn auto height off, and a fit that crossed them was rejected, so assuming it was applied
  // would keep the next fit of that same height from ever being sent.
  const stopAutoHeight = watch(
    autoHeight,
    (on) => {
      if (on) return
      gate.reset()
      mainHeight = layoutRect.value.height
    },
    { flush: 'sync' }
  )

  const host: PanelHost = {
    reportHeight(px) {
      // A ghost keeps its saved height: its widget, if it exists, is not drawn.
      if (disposed || !autoHeight.value || ghost.value) return
      const h = sanitizeContentHeight(px)
      if (h !== null) gate.report(h, !shown.value)
    },
    waitForFit(timeoutMs) {
      if (disposed) return Promise.resolve()
      return new Promise<void>((resolve) => {
        const w: FitWaiter = { resolve, timer: null }
        w.timer = env.timers.setTimeout(() => settleWaiter(w), Math.max(0, timeoutMs))
        waiters.add(w)
      })
    },
    size
  }

  // ---- Commits -----------------------------------------------------------

  /**
   * Height to tell main for an auto-height panel; null while an interaction owns the rect, and
   * for a ghost (main ignores its fits).
   */
  const fitToSend = computed(() =>
    autoHeight.value && !ghost.value && dragRect.value === null && pendingRect.value === null
      ? drawn.value.height
      : null
  )
  const stopMainHeight = watch(
    layoutRect,
    (r) => {
      mainHeight = r.height
    },
    { flush: 'sync' }
  )
  const stopFit = watch(
    [fitToSend, layoutRect],
    ([height]) => {
      const layout = registry.layout.value
      if (height === null || layout === null || height === mainHeight) return
      mainHeight = height
      env.commitBounds({
        session: layout.session,
        seq: registry.tracker.nextSeq(),
        widget: id,
        kind: 'fit',
        height
      })
    },
    { flush: 'post' }
  )

  /** Draws what is drawn now until main acknowledges `seq`. */
  function hold(rect: Rect): number {
    pendingRect.value = rect
    dragRect.value = null
    const seq = registry.tracker.nextSeq()
    registry.tracker.hold(id, seq)
    return seq
  }

  const handle: SlotHandle = {
    id,
    rect: drawn,
    autoHeight,
    locked,
    ghost,
    shown,
    autoHidden,
    placement,
    setDragRect(rect) {
      if (!disposed) dragRect.value = rect
    },
    commit(kind) {
      const layout = registry.layout.value
      if (disposed || dragRect.value === null || layout === null) return
      const rect = drawn.value
      const seq = hold(rect)
      env.commitBounds({
        session: layout.session,
        seq,
        widget: id,
        kind,
        revision: layout.revision,
        rect: copyRect(rect)
      })
    },
    dropOutside(grab: Point) {
      const layout = registry.layout.value
      if (disposed || layout === null) return
      const rect = drawn.value
      const seq = hold(rect)
      env.commitBounds({
        session: layout.session,
        seq,
        widget: id,
        kind: 'drop-outside',
        grab: { x: clampInt(grab.x, rect.width), y: clampInt(grab.y, rect.height) },
        size: { width: rect.width, height: rect.height }
      })
    }
  }

  const unregister = registry.register({
    handle,
    settle: () => {
      pendingRect.value = null
    }
  })

  onScopeDispose(() => {
    disposed = true
    unregister()
    stopAutoHeight()
    stopMainHeight()
    stopFit()
    gate.dispose()
    if (frame !== 0) env.frames.cancel(frame)
    frame = 0
    settleWaiters()
  })

  return { handle, host, style, shown, onScreen, mounted, dragging }
}

/**
 * WidgetSlot's error boundary: logs an error of its widget (render, watcher, lifecycle hook or
 * async chunk) and stops it there, so one widget never stops the others.
 */
export function slotErrorHandler(
  id: WidgetId,
  log: (...args: unknown[]) => void = console.error
): (err: unknown, instance: ComponentPublicInstance | null, info: string) => false {
  return (err, _instance, info) => {
    log(`[overlay] ${id}:`, info, err)
    return false
  }
}

/** Installs `slotErrorHandler` on the current component (setup only). */
export function useSlotErrorBoundary(id: WidgetId, log?: (...args: unknown[]) => void): void {
  onErrorCaptured(slotErrorHandler(id, log))
}
