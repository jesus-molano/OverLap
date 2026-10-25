<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import { hiddenText, widgetTitle } from '@shared/i18n'
import type { EditDragMessage, ResizeHandle } from '@shared/ipc'
import { WIDGET_DEFS, type WidgetId } from '@shared/widgets'
import { useI18n } from '../composables/useI18n'
import { useOverlayState } from '../composables/useOverlay'
import Icon from '../ui/Icon.vue'

const props = defineProps<{ widgetId: WidgetId }>()

// autoHidden: a "Mostrar en" / "Ocultar en boxes" rule hides the widget outside edit mode.
const { editMode, settings, autoHidden } = useOverlayState()
const t = useI18n()
const def = computed(() => WIDGET_DEFS[props.widgetId])
const title = computed(() => widgetTitle(t.value, props.widgetId))
/** Why a rule hides the widget: 'Oculto en práctica'. */
const hiddenNote = computed(() => hiddenText(t.value, autoHidden.value.reason))
const widget = computed(() => settings.value?.widgets[props.widgetId])
// Main keeps a locked widget click-through even in edit mode; this only hides the edit UI.
const locked = computed(() => widget.value?.locked === true)
const editable = computed(() => editMode.value && !locked.value)
/** Main fits the height to the content: the user only sets the width (side handles). */
const autoHeight = computed(
  () => def.value.sizeModel === 'auto-height' && widget.value?.autoHeight !== false
)

const ALL_HANDLES: readonly ResizeHandle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
const SIDE_HANDLES: readonly ResizeHandle[] = ['e', 'w']
const handles = computed(() => (autoHeight.value ? SIDE_HANDLES : ALL_HANDLES))

// ---- Live size readout (resize events only happen in edit mode) ----

const size = shallowRef({ w: window.innerWidth, h: window.innerHeight })

function readSize(): void {
  const w = window.innerWidth
  const h = window.innerHeight
  if (w !== size.value.w || h !== size.value.h) size.value = { w, h }
}

watch(
  editMode,
  (on) => {
    if (on) {
      readSize()
      window.addEventListener('resize', readSize)
    } else {
      window.removeEventListener('resize', readSize)
    }
  },
  { immediate: true }
)

/** '460 × auto · 100 %' (auto-height widgets) or '460 × 252' (free widgets). */
const sizeText = computed(() => {
  const { w, h } = size.value
  const frame = t.value.core.editFrame
  const dims = `${w} × ${autoHeight.value ? frame.autoHeight : h}`
  if (def.value.sizeModel !== 'auto-height') return dims
  return `${dims} · ${t.value.core.percent(widget.value?.scale ?? 100)}`
})

// ---- Mouse wheel: bigger / smaller (main decides between scale and resize) ----

const WHEEL_INTERVAL_MS = 50
let lastWheelAt = -Infinity

function onWheel(e: WheelEvent): void {
  if (!editable.value || drag || e.deltaY === 0) return
  e.preventDefault()
  // One step per 50 ms whatever the wheel's resolution: a timestamp, no timer.
  if (e.timeStamp - lastWheelAt < WHEEL_INTERVAL_MS) return
  lastWheelAt = e.timeStamp
  window.overlay.editScale({ step: e.deltaY < 0 ? 1 : -1 })
}

// ---- Manual move / resize ----
// The window is frameless, transparent and non-focusable, where native
// drag/resize is unreliable. Main reads the cursor itself on every message
// (getCursorScreenPoint, DIP), so `move` is only a "pointer moved" tick, at
// most one per frame; dx/dy travel along for the contract but main ignores them.

interface Drag {
  el: HTMLElement
  pointerId: number
  mode: EditDragMessage['mode']
  startX: number
  startY: number
  dx: number
  dy: number
  /** Alt (or Shift) held: no edge snapping. */
  noSnap: boolean
  /** The pointer moved since the last message. */
  moved: boolean
  /** Pending requestAnimationFrame id, 0 when none. */
  raf: number
}

let drag: Drag | null = null

function send(d: Drag, phase: EditDragMessage['phase']): void {
  d.moved = false
  window.overlay.editDrag({ phase, mode: d.mode, dx: d.dx, dy: d.dy, noSnap: d.noSnap })
}

function track(d: Drag, e: PointerEvent): void {
  d.dx = Math.round(e.screenX - d.startX)
  d.dy = Math.round(e.screenY - d.startY)
  // Shift as well: the window never has keyboard focus, and Windows can report Alt late to it.
  d.noSnap = e.altKey || e.shiftKey
  d.moved = true
}

function flush(): void {
  if (!drag) return
  drag.raf = 0
  if (drag.moved) send(drag, 'move')
}

function onPointerDown(e: PointerEvent, mode: EditDragMessage['mode']): void {
  if (!editable.value || drag || e.button !== 0 || !e.isPrimary) return
  const el = e.currentTarget
  if (!(el instanceof HTMLElement)) return
  e.preventDefault()
  el.setPointerCapture(e.pointerId)
  drag = {
    el,
    pointerId: e.pointerId,
    mode,
    startX: e.screenX,
    startY: e.screenY,
    dx: 0,
    dy: 0,
    noSnap: e.altKey || e.shiftKey,
    moved: false,
    raf: 0
  }
  el.addEventListener('pointermove', onPointerMove)
  el.addEventListener('pointerup', onPointerEnd)
  el.addEventListener('pointercancel', onPointerEnd)
  el.addEventListener('lostpointercapture', onPointerEnd)
  send(drag, 'start')
}

function onPointerMove(e: PointerEvent): void {
  if (!drag || e.pointerId !== drag.pointerId) return
  track(drag, e)
  if (drag.raf === 0) drag.raf = requestAnimationFrame(flush)
}

function onPointerEnd(e: PointerEvent): void {
  if (!drag || e.pointerId !== drag.pointerId) return
  if (e.type === 'pointerup') track(drag, e)
  endDrag()
}

/**
 * Finishes the current drag (if any) with `end`, which main also applies as a
 * last step. A widget locked mid-drag sends nothing more (main rejects drags
 * of locked widgets anyway).
 */
function endDrag(): void {
  const d = drag
  if (!d) return
  drag = null
  if (d.raf !== 0) cancelAnimationFrame(d.raf)
  d.el.removeEventListener('pointermove', onPointerMove)
  d.el.removeEventListener('pointerup', onPointerEnd)
  d.el.removeEventListener('pointercancel', onPointerEnd)
  d.el.removeEventListener('lostpointercapture', onPointerEnd)
  if (d.el.hasPointerCapture(d.pointerId)) d.el.releasePointerCapture(d.pointerId)
  if (!locked.value) send(d, 'end')
}

watch(editable, (on) => {
  if (!on) endDrag()
})

onBeforeUnmount(() => {
  endDrag()
  window.removeEventListener('resize', readSize)
})
</script>

<template>
  <div
    class="frame"
    :class="{ editing: editable, 'locked-edit': editMode && locked, 'auto-h': autoHeight }"
    @pointerdown="onPointerDown($event, 'move')"
    @wheel="onWheel"
  >
    <div class="content">
      <slot />
    </div>
    <div v-if="editMode" class="edit-layer" aria-hidden="true">
      <div class="chip" :class="{ 'chip-locked': locked }">
        <Icon v-if="locked" name="lock" class="lock" />
        <span class="chip-title">{{ title }}</span>
        <span class="chip-meta">· {{ locked ? t.core.editFrame.locked : sizeText }}</span>
      </div>
      <div v-if="autoHidden.hidden" class="chip chip-note">
        <Icon name="eye-off" class="eye-off" />
        <span class="chip-meta">{{ hiddenNote }}</span>
      </div>
      <div v-if="!locked" class="hint">
        <span class="hint-long">{{ t.core.editFrame.hintLong }}</span>
        <span class="hint-short">{{ t.core.editFrame.hintShort }}</span>
        <span class="hint-tiny">Ctrl+Shift+E</span>
      </div>
    </div>
    <template v-if="editable">
      <div
        v-for="h in handles"
        :key="h"
        class="handle"
        :class="`handle-${h}`"
        @pointerdown.stop="onPointerDown($event, h)"
      >
        <span v-if="autoHeight" class="grip" />
      </div>
    </template>
  </div>
</template>

<style scoped>
/* The window's root: fixed to the viewport, so nothing inside can reflow or paint past it. */
.frame {
  position: relative;
  width: 100vw;
  height: 100vh;
  box-sizing: border-box;
  contain: strict;
}

.content {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
}

/* ---- Edit mode ---------------------------------------------------------- */

.frame.editing {
  cursor: move;
  touch-action: none;
}

/* The widget is inert while positioning: every pointer goes to the frame. */
.frame.editing > .content {
  pointer-events: none;
}

/* Backdrop behind the widget, so even an empty or faded widget can be placed. */
.frame.editing::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: var(--ov-radius);
  background: var(--ov-edit-backdrop);
}

/* Border drawn on top, outside the layout: toggling edit mode never reflows the widget. */
.frame.editing::after,
.frame.locked-edit::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  border: 2px dashed var(--ov-edit);
  border-radius: var(--ov-radius);
  pointer-events: none;
}

/* Locked: no backdrop, so it shows as configured; a dim outline marks where it is. */
.frame.locked-edit::after {
  border: 1px dashed var(--ov-locked);
}

/* Top centre, so the chips cover the header at most, never the rows. */
.edit-layer {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding-top: 4px;
  pointer-events: none;
  container: ov-frame / inline-size;
}

.chip {
  display: flex;
  align-items: center;
  gap: 0.35em;
  max-width: calc(100% - 16px);
  padding: 2px 8px;
  border: 1px solid color-mix(in srgb, var(--ov-edit) 55%, transparent);
  border-radius: 999px;
  background: rgba(10, 12, 16, 0.9);
  font: 600 11px/1.3 var(--ov-font);
  color: var(--ov-fg);
  white-space: nowrap;
}

.chip-title {
  flex: none;
}

.chip-meta {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
  color: var(--ov-fg-muted);
}

.chip-locked {
  border-color: var(--ov-locked);
}

/* A rule hides this widget outside edit mode. */
.chip-note {
  border-color: color-mix(in srgb, var(--ov-warn) 60%, transparent);
}

.chip-note .chip-meta {
  color: var(--ov-fg);
}

.lock {
  color: var(--ov-fg-muted);
}

.eye-off {
  color: var(--ov-warn);
}

/* Only while the pointer is over the widget: the chip alone says what and how big. */
.hint {
  display: none;
  max-width: calc(100% - 16px);
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(10, 12, 16, 0.85);
  font: 500 10.5px/1.3 var(--ov-font);
  color: var(--ov-fg-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.frame.editing:hover .hint {
  display: block;
}

/* Longest hint that fits the window width (the window is the container). */
.hint-long,
.hint-short {
  display: none;
}

@container ov-frame (min-width: 230px) {
  .hint-tiny {
    display: none;
  }
  .hint-short {
    display: inline;
  }
}

@container ov-frame (min-width: 330px) {
  .hint-short {
    display: none;
  }
  .hint-long {
    display: inline;
  }
}

/* ---- Resize handles: ~8 px edges, ~14 px corners ------------------------- */

.handle {
  position: absolute;
  z-index: 3;
  touch-action: none;
}

.handle-n,
.handle-s {
  left: 14px;
  right: 14px;
  height: 8px;
  cursor: ns-resize;
}

.handle-e,
.handle-w {
  top: 14px;
  bottom: 14px;
  width: 8px;
  cursor: ew-resize;
}

/* Auto height: the sides are the only handles, full height, each with a grip. */
.auto-h .handle-e,
.auto-h .handle-w {
  top: 0;
  bottom: 0;
}

.handle-n {
  top: 0;
}
.handle-s {
  bottom: 0;
}
.handle-e {
  right: 0;
}
.handle-w {
  left: 0;
}

.handle-n:hover,
.handle-s:hover,
.handle-e:hover,
.handle-w:hover {
  background: color-mix(in srgb, var(--ov-edit) 30%, transparent);
}

.grip {
  position: absolute;
  top: 50%;
  left: 1px;
  width: 6px;
  height: 18px;
  margin-top: -9px;
  border-radius: 3px;
  background: var(--ov-edit);
  opacity: 0.8;
}

.handle:hover .grip {
  opacity: 1;
}

.handle-ne,
.handle-nw,
.handle-se,
.handle-sw {
  width: 14px;
  height: 14px;
}

.handle-nw {
  top: 0;
  left: 0;
  cursor: nwse-resize;
}
.handle-ne {
  top: 0;
  right: 0;
  cursor: nesw-resize;
}
.handle-sw {
  bottom: 0;
  left: 0;
  cursor: nesw-resize;
}
.handle-se {
  bottom: 0;
  right: 0;
  cursor: nwse-resize;
}

/* Corner markers. */
.handle-ne::after,
.handle-nw::after,
.handle-se::after,
.handle-sw::after {
  content: '';
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 2px;
  background: var(--ov-edit);
}

.handle-nw::after {
  top: 3px;
  left: 3px;
}
.handle-ne::after {
  top: 3px;
  right: 3px;
}
.handle-sw::after {
  bottom: 3px;
  left: 3px;
}
.handle-se::after {
  bottom: 3px;
  right: 3px;
}

.handle:hover::after {
  transform: scale(1.5);
}
</style>
