<script setup lang="ts">
/**
 * Edit-mode chrome and interactions of one panel of an overlay window: the frame, the chips
 * (name, size, scale, the eye and padlock buttons, why a rule hides it, the radar covering it,
 * drop on another display), the resize handles, drag to move or resize and the mouse wheel.
 * A ghost (a widget the user disabled) is only an outline with its chip. Outside edit mode it
 * only draws the widget.
 *
 * The chips and notes are drawn in the window's chip layer (CHIP_LAYER, above every panel), over
 * the top of their panel: a panel painted later (the radar, a fitted sample) never covers them.
 * Dragging the name chip moves its own panel.
 *
 * Main decides when the window takes the mouse (over any panel's chip, over an unlocked panel,
 * or while a drag holds the lease), so this never asks for it: it only reports drags and where
 * its chip is (useEditSession).
 */
import { computed, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue'
import { acceleratorText, hiddenText, widgetTitle } from '@shared/i18n'
import { firstCombination } from '@shared/shortcuts'
import { TOPMOST_WIDGET, WIDGET_DEFS } from '@shared/widgets'
import { useI18n } from '../composables/useI18n'
import { useShortcuts } from '../composables/useShortcuts'
import { useWidgetSettings } from '../composables/useWidgetSettings'
import { vInlineStyle } from '../directives/inlineStyle'
import Icon from '../ui/Icon.vue'
import { CHIP_LAYER, injectSlot } from './contract'
import { handlesFor, type DragMode } from './dragMath'
import { hintTier, radarClashes, relativeRect, toggleMessage, type ToggleField } from './editChip'
import { createPanelEdit } from './panelEdit'
import { slotStyle } from './slotGeometry'
import { ANIMATION_FRAMES } from './timers'
import { injectEditSession } from './useEditSession'

const slot = injectSlot()
const session = injectEditSession()
const def = WIDGET_DEFS[slot.id]
const prefs = useWidgetSettings(slot.id)
const t = useI18n()
const shortcuts = useShortcuts()

const edit = createPanelEdit({
  slot,
  session,
  minSize: def.minSize,
  sizeModel: def.sizeModel,
  sendScaleStep: (msg) => window.overlay.scaleStep(msg),
  frames: ANIMATION_FRAMES
})
const { editable, crossing } = edit
const editMode = session.editing
const locked = slot.locked
const ghost = slot.ghost
const autoHeight = slot.autoHeight
const autoHidden = slot.autoHidden

const title = computed(() => widgetTitle(t.value, slot.id))
/** Why a rule hides the widget: 'Oculto en práctica'. */
const hiddenNote = computed(() => hiddenText(t.value, autoHidden.value.reason))
const handles = computed(() => handlesFor(autoHeight.value))

/**
 * How to use and leave edit mode, by panel width, with the shortcut's first key combination; left
 * out when it has none, only controller buttons ('Botón 3' beside the mouse wheel's "Rueda" says
 * nothing clear, and the controller's name does not fit).
 */
const hint = computed(() => {
  const f = t.value.core.editFrame
  const keys = acceleratorText(t.value, firstCombination(shortcuts.value.toggleEditMode))
  const tier = hintTier(slot.rect.value.width)
  if (keys === '') return tier === 'long' ? f.hintLongNoKey : f.hintShortNoKey
  return tier === 'long' ? f.hintLong(keys) : tier === 'short' ? f.hintShort(keys) : keys
})

/** '460 × auto' (auto-height widgets) or '460 × 252' (free widgets), as drawn now. */
const sizeText = computed(() => {
  const { width, height } = slot.rect.value
  return `${width} × ${autoHeight.value ? t.value.core.editFrame.autoHeight : height}`
})

/** 'Oculto' for a ghost, 'Bloqueado' when locked, else the size. */
const metaText = computed(() => {
  const f = t.value.core.editFrame
  if (ghost.value) return f.hidden
  return locked.value ? f.locked : sizeText.value
})

/** '100 %' (auto-height widgets, scaled by the wheel); null for free widgets. */
const scaleText = computed(() =>
  def.sizeModel === 'auto-height' ? t.value.core.percent(prefs.value.scale) : null
)

/** The chip's buttons: what a click does, as their tooltip. */
const eyeLabel = computed(() => {
  const f = t.value.core.editFrame
  return ghost.value ? f.show(title.value) : f.hide(title.value)
})
const lockLabel = computed(() => {
  const f = t.value.core.editFrame
  return locked.value ? f.unlock(title.value) : f.lock(title.value)
})

/**
 * The radar is painted above every panel (B05): on the radar, the panels it covers; on another
 * panel, that the radar covers it. Edit mode only.
 */
const clashes = computed(() =>
  editMode.value && !ghost.value ? radarClashes(slot.id, session.registry.slots.value) : []
)
const clashNote = computed(() => {
  const list = clashes.value
  if (list.length === 0) return null
  const f = t.value.core.editFrame
  if (slot.id !== TOPMOST_WIDGET) return f.underRadar
  return f.coversPanels(list.map((id) => widgetTitle(t.value, id)).join(', '))
})

function toggle(field: ToggleField): void {
  const msg = toggleMessage(slot, field, session.session(), editMode.value)
  if (msg !== null) window.overlay.widgetToggle(msg)
}

// ---- The chip layer: over the panel, above every panel ----------------------

/** On screen in edit mode: drawn (rule-hidden widgets are previewed) or a ghost. */
const chipsShown = computed(() => editMode.value && (slot.shown.value || ghost.value))
/** Exactly over the panel: the same device-pixel edges. */
const layerStyle = computed(() =>
  slotStyle(slot.rect.value, session.registry.display.value?.scaleFactor ?? 1)
)
/** The pointer is over the panel or its chip: the hint shows (both can be under it in turn). */
const overFrame = shallowRef(false)
const overChip = shallowRef(false)
// A chip that goes away under the pointer gets no pointerleave.
watch(chipsShown, (on) => {
  if (!on) overChip.value = false
})

// ---- Where the chip is: main takes the mouse over it ------------------------

const layerEl = useTemplateRef<HTMLElement>('layer')
const chipEl = useTemplateRef<HTMLElement>('chip')
const observer =
  typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measureChip())

/** Relative to the layer, which sits exactly on the panel. */
function measureChip(): void {
  const layer = layerEl.value
  const chip = chipEl.value
  const rect =
    layer !== null && chip !== null
      ? relativeRect(layer.getBoundingClientRect(), chip.getBoundingClientRect())
      : null
  session.reportChip(slot.id, rect)
}

const stopChip = watch(
  chipEl,
  (el, prev) => {
    if (prev) observer?.unobserve(prev)
    if (el) observer?.observe(el)
    measureChip()
  },
  { flush: 'post' }
)
// The chip is centred: a new panel width moves it even when its own size stays.
const stopWidth = watch(
  () => slot.rect.value.width,
  () => measureChip(),
  { flush: 'post' }
)

function onPointerDown(e: PointerEvent, mode: DragMode): void {
  const el = e.currentTarget
  if (el instanceof HTMLElement) edit.pointerDown(e, el, mode)
}

function onWheel(e: WheelEvent): void {
  edit.wheel(e)
}

onBeforeUnmount(() => {
  stopChip()
  stopWidth()
  observer?.disconnect()
  session.reportChip(slot.id, null)
  edit.dispose()
})
</script>

<template>
  <div
    class="frame"
    :class="{
      editing: editable,
      'locked-edit': editMode && locked && !ghost,
      'ghost-edit': editMode && ghost,
      'radar-clash': clashNote !== null,
      'auto-h': autoHeight
    }"
    @pointerdown="onPointerDown($event, 'move')"
    @wheel="onWheel"
    @pointerenter="overFrame = true"
    @pointerleave="overFrame = false"
  >
    <div class="content" :class="{ 'is-ghost': ghost }">
      <slot />
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
  <Teleport v-if="chipsShown" defer :to="CHIP_LAYER">
    <div
      ref="layer"
      v-inline-style="layerStyle"
      class="edit-layer"
      :data-ov-chips-of="slot.id"
      :class="{ hovered: editable && (overFrame || overChip) }"
    >
      <div
        ref="chip"
        class="chip chip-main"
        :class="{ 'chip-locked': locked && !ghost, 'chip-ghost': ghost, 'chip-move': editable }"
        @pointerdown="onPointerDown($event, 'move')"
        @wheel="onWheel"
        @pointerenter="overChip = true"
        @pointerleave="overChip = false"
      >
        <span class="chip-title">{{ title }}</span>
        <span class="chip-meta">{{ metaText }}</span>
        <span v-if="!locked && !ghost && scaleText" class="chip-meta chip-scale">{{
          scaleText
        }}</span>
        <span class="chip-actions">
          <button
            type="button"
            class="chip-btn"
            :class="{ 'is-off': ghost }"
            :title="eyeLabel"
            :aria-label="eyeLabel"
            :aria-pressed="!ghost"
            @pointerdown.stop
            @click.stop="toggle('visible')"
          >
            <Icon :name="ghost ? 'eye-off' : 'eye'" />
          </button>
          <button
            type="button"
            class="chip-btn"
            :class="{ 'is-locked': locked }"
            :title="lockLabel"
            :aria-label="lockLabel"
            :aria-pressed="locked"
            @pointerdown.stop
            @click.stop="toggle('locked')"
          >
            <Icon :name="locked ? 'lock' : 'unlock'" />
          </button>
        </span>
      </div>
      <div v-if="crossing" class="chip chip-drop" aria-hidden="true">
        <span class="chip-meta">{{ t.core.editFrame.dropOnOtherDisplay }}</span>
      </div>
      <div v-if="autoHidden.hidden && !ghost" class="chip chip-note" aria-hidden="true">
        <Icon name="eye-off" class="eye-off" />
        <span class="chip-meta">{{ hiddenNote }}</span>
      </div>
      <div v-if="clashNote !== null" class="chip chip-clash" aria-hidden="true">
        <Icon name="warning" class="clash-icon" />
        <span class="chip-meta">{{ clashNote }}</span>
      </div>
      <div v-if="!locked && !ghost" class="hint" aria-hidden="true">
        {{ hint }}
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Fills its panel; the panel (.ov-slot) holds the size and the paint containment. */
.frame {
  position: relative;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.content {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
}

/* A ghost never draws its widget (it gets no data either): only the outline and the chip. */
.content.is-ghost {
  display: none;
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
.frame.editing::before,
.frame.ghost-edit::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: var(--ov-radius);
  background: var(--ov-edit-backdrop);
}

/* A ghost: half the backdrop, so it reads as "not there", yet can be found. */
.frame.ghost-edit::before {
  opacity: 0.45;
}

/*
 * Drawn on top, outside the layout (toggling edit mode never reflows the widget): a 1 px frame
 * with 12 x 2 px crop marks at the corners. Eight background layers, edit mode only.
 */
.frame.editing::after,
.frame.locked-edit::after,
.frame.ghost-edit::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  border: 1px solid var(--ov-edit-line);
  border-radius: 0;
  background:
    linear-gradient(var(--ov-edit), var(--ov-edit)) left top / 12px 2px no-repeat,
    linear-gradient(var(--ov-edit), var(--ov-edit)) left top / 2px 12px no-repeat,
    linear-gradient(var(--ov-edit), var(--ov-edit)) right top / 12px 2px no-repeat,
    linear-gradient(var(--ov-edit), var(--ov-edit)) right top / 2px 12px no-repeat,
    linear-gradient(var(--ov-edit), var(--ov-edit)) left bottom / 12px 2px no-repeat,
    linear-gradient(var(--ov-edit), var(--ov-edit)) left bottom / 2px 12px no-repeat,
    linear-gradient(var(--ov-edit), var(--ov-edit)) right bottom / 12px 2px no-repeat,
    linear-gradient(var(--ov-edit), var(--ov-edit)) right bottom / 2px 12px no-repeat;
  /* The marks sit on the frame line's outer corner, not 1 px inside it. */
  background-origin: border-box;
  pointer-events: none;
}

/* Locked: no backdrop, so it shows as configured; a dim dashed outline marks where it is. */
.frame.locked-edit::after {
  border: 1px dashed var(--ov-locked);
  background: none;
}

/* A ghost: a dashed outline in the muted text colour, no crop marks (it cannot be moved). */
.frame.ghost-edit::after {
  border: 1px dashed var(--ov-fg-muted);
  background: none;
}

/* The radar covers part of this panel (or this radar covers another): a warning outline. */
.frame.radar-clash::after {
  border-color: var(--ov-warn);
}

/*
 * In the chip layer, exactly over its panel (position and size inline), clipped to it like the
 * panel. Top centre, so the chips cover the header at most, never the rows. It takes no pointer
 * itself: only the name chip does (it moves its panel) and its buttons. No stacking context of
 * its own (no z-index, no containment): every name chip of the window sits above every note.
 */
.edit-layer {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding-top: 4px;
  box-sizing: border-box;
  overflow: hidden;
  pointer-events: none;
}

.chip {
  display: flex;
  align-items: center;
  gap: 0.5em;
  max-width: calc(100% - 16px);
  padding: 2px 8px;
  border: 1px solid color-mix(in srgb, var(--ov-edit) 55%, transparent);
  border-radius: var(--ov-radius-inner);
  background: rgba(10, 12, 16, 0.92);
  font: 600 11px/1.3 var(--ov-font-small);
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
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  color: var(--ov-fg-muted);
}

/* The scale after the size, set off by a hairline rather than a dot. */
.chip-scale {
  flex: none;
  padding-left: 0.5em;
  box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.16);
}

.chip-locked {
  border-color: var(--ov-locked);
}

.chip-ghost {
  border-color: var(--ov-fg-dim);
}

/* The notes and the hint: under every name chip, theirs or another panel's. */
.chip,
.hint {
  position: relative;
  z-index: 1;
}

/*
 * The name chip takes the pointer even over a panel painted above its own: it is its handle. Above
 * every note, so another panel's note never hides its buttons.
 */
.chip-main {
  z-index: 2;
  pointer-events: auto;
}

.chip-move {
  cursor: move;
  touch-action: none;
}

/* The eye and the padlock: buttons of the name chip. */
.chip-actions {
  display: flex;
  flex: none;
  gap: 2px;
  margin: -1px -5px -1px 0;
  padding-left: 0.4em;
  box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.16);
}

.chip-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 17px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: none;
  font-size: 12px;
  color: var(--ov-fg-muted);
  cursor: pointer;
  pointer-events: auto;
}

.chip-btn:hover {
  background: color-mix(in srgb, var(--ov-edit) 30%, transparent);
  color: var(--ov-fg);
}

/* State, not decoration: the crossed eye of a ghost and the closed padlock stand out. */
.chip-btn.is-off {
  color: var(--ov-warn);
}

.chip-btn.is-locked {
  color: var(--ov-fg);
}

/* The pointer left this display mid-move: releasing moves the widget there. */
.chip-drop {
  border-color: var(--ov-edit);
}

.chip-drop .chip-meta {
  color: var(--ov-fg);
}

/* A rule hides this widget outside edit mode. */
.chip-note,
.chip-clash {
  border-color: color-mix(in srgb, var(--ov-warn) 60%, transparent);
}

.chip-note .chip-meta,
.chip-clash .chip-meta {
  color: var(--ov-fg);
}

.eye-off,
.clash-icon {
  color: var(--ov-warn);
}

/* Only while the pointer is over the panel: the chip alone says what and how big. */
.hint {
  display: none;
  max-width: calc(100% - 16px);
  padding: 1px 7px;
  border-radius: var(--ov-radius-inner);
  background: rgba(10, 12, 16, 0.85);
  font: 400 11px/1.3 var(--ov-font-small);
  color: var(--ov-fg-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.edit-layer.hovered .hint {
  display: block;
}

/* ---- Resize handles: ~8 px edges, ~14 px corners (the crop marks show them) ---- */

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
  left: 2px;
  width: 4px;
  height: 16px;
  margin-top: -8px;
  border-radius: 2px;
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
</style>
