<script setup lang="ts">
/**
 * Edit-mode chrome and interactions of one panel of an overlay window: the frame, the chips
 * (name, size, scale, lock, why a rule hides it, drop on another display), the resize handles,
 * drag to move or resize and the mouse wheel. Outside edit mode it only draws the widget.
 *
 * Main decides when the window takes the mouse (only over an unlocked panel, or while a drag
 * holds the lease), so this never asks for it: it only reports drags (useEditSession).
 */
import { computed, onBeforeUnmount } from 'vue'
import { acceleratorText, hiddenText, widgetTitle } from '@shared/i18n'
import { WIDGET_DEFS } from '@shared/widgets'
import { useI18n } from '../composables/useI18n'
import { useShortcuts } from '../composables/useShortcuts'
import { useWidgetSettings } from '../composables/useWidgetSettings'
import Icon from '../ui/Icon.vue'
import { injectSlot } from './contract'
import { handlesFor, type DragMode } from './dragMath'
import { createPanelEdit } from './panelEdit'
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
const autoHeight = slot.autoHeight
const autoHidden = slot.autoHidden

const title = computed(() => widgetTitle(t.value, slot.id))
/** Why a rule hides the widget: 'Oculto en práctica'. */
const hiddenNote = computed(() => hiddenText(t.value, autoHidden.value.reason))
const handles = computed(() => handlesFor(autoHeight.value))

/** How to use and leave edit mode, by panel width; the shortcut is left out when it has none. */
const hints = computed(() => {
  const f = t.value.core.editFrame
  const keys = acceleratorText(t.value, shortcuts.value.toggleEditMode)
  if (keys === '') return { long: f.hintLongNoKey, short: f.hintShortNoKey, tiny: f.hintShortNoKey }
  return { long: f.hintLong(keys), short: f.hintShort(keys), tiny: keys }
})

/** '460 × auto' (auto-height widgets) or '460 × 252' (free widgets), as drawn now. */
const sizeText = computed(() => {
  const { width, height } = slot.rect.value
  return `${width} × ${autoHeight.value ? t.value.core.editFrame.autoHeight : height}`
})

/** '100 %' (auto-height widgets, scaled by the wheel); null for free widgets. */
const scaleText = computed(() =>
  def.sizeModel === 'auto-height' ? t.value.core.percent(prefs.value.scale) : null
)

function onPointerDown(e: PointerEvent, mode: DragMode): void {
  const el = e.currentTarget
  if (el instanceof HTMLElement) edit.pointerDown(e, el, mode)
}

function onWheel(e: WheelEvent): void {
  edit.wheel(e)
}

onBeforeUnmount(() => edit.dispose())
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
        <span class="chip-meta">{{ locked ? t.core.editFrame.locked : sizeText }}</span>
        <span v-if="!locked && scaleText" class="chip-meta chip-scale">{{ scaleText }}</span>
      </div>
      <div v-if="crossing" class="chip chip-drop">
        <span class="chip-meta">{{ t.core.editFrame.dropOnOtherDisplay }}</span>
      </div>
      <div v-if="autoHidden.hidden" class="chip chip-note">
        <Icon name="eye-off" class="eye-off" />
        <span class="chip-meta">{{ hiddenNote }}</span>
      </div>
      <div v-if="!locked" class="hint">
        <span class="hint-long">{{ hints.long }}</span>
        <span class="hint-short">{{ hints.short }}</span>
        <span class="hint-tiny">{{ hints.tiny }}</span>
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

/*
 * Drawn on top, outside the layout (toggling edit mode never reflows the widget): a 1 px frame
 * with 12 x 2 px crop marks at the corners. Eight background layers, edit mode only.
 */
.frame.editing::after,
.frame.locked-edit::after {
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

/* The pointer left this display mid-move: releasing moves the widget there. */
.chip-drop {
  border-color: var(--ov-edit);
}

.chip-drop .chip-meta {
  color: var(--ov-fg);
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

.frame.editing:hover .hint {
  display: block;
}

/* Longest hint that fits the panel width (the edit layer is the container). */
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
