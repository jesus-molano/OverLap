<script setup lang="ts">
import { useI18n } from '../composables/useI18n'
import { useOverlayState } from '../composables/useOverlay'
import Icon from '../ui/Icon.vue'
import { createSlotRegistry, provideOverlayRegistry } from './slots'
import { computed } from 'vue'
import { useEditSession } from './useEditSession'
import WidgetSlot from './WidgetSlot.vue'

/**
 * Root of an overlay window (`?view=overlay`, one per display): every enabled widget main
 * places on this display (in edit mode the disabled ones too, as ghosts), each as an absolutely
 * positioned panel of this one document, in PAINT_ORDER (later ones on top, the radar above
 * all, as main hit-tests them). Above them all, the chip layer (CHIP_LAYER): the panels' edit
 * chips, so none is ever under another panel (main tests every chip before any panel). Nothing
 * until the first layout. In edit mode, while the game hides the mouse cursor (you are in the
 * car), a note says how to get it back.
 */
const { editMode, cursorHidden } = useOverlayState()
const t = useI18n()
const registry = createSlotRegistry()
provideOverlayRegistry(registry)
const session = useEditSession(registry)
const widgets = registry.widgets
/**
 * While a panel is dragged, the lines it snaps to (another panel's edge, the display's edge or
 * its middle), across the display (R38).
 */
const guideLines = computed(() => {
  const d = registry.display.value?.bounds
  const g = session.guides.value
  if (d === undefined || (g.xs.length === 0 && g.ys.length === 0)) return []
  return [
    ...g.xs.map((x) => ({
      key: `x${x}`,
      style: { left: `${x}px`, top: `${d.y}px`, width: '1px', height: `${d.height}px` }
    })),
    ...g.ys.map((y) => ({
      key: `y${y}`,
      style: { left: `${d.x}px`, top: `${y}px`, width: `${d.width}px`, height: '1px' }
    }))
  ]
})
</script>

<template>
  <div class="ov-overlay" :class="{ 'is-editing': editMode }">
    <WidgetSlot v-for="id in widgets" :key="id" :widget="id" />
    <div class="ov-chips" data-ov-chips />
    <div v-for="l in guideLines" :key="l.key" class="ov-guide" :style="l.style" />
    <div v-if="editMode && cursorHidden" class="ov-cursor-hint" role="status">
      <Icon name="alert" class="ov-cursor-hint__icon" />
      <span class="ov-cursor-hint__text">
        <strong>{{ t.core.editFrame.cursorHidden.title }}</strong>
        {{ t.core.editFrame.cursorHidden.body }}
      </span>
    </div>
  </div>
</template>

<style scoped>
/* The whole display, see-through (no background) and click-through outside the panels. */
.ov-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  contain: strict;
}

/*
 * The edit chips, above every panel (also the one being dragged, z-index 1). It takes no pointer
 * itself: only the chips in it do.
 */
.ov-chips {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

/* A snap guide (R38): a hairline in the edit colour, under the chips, never taking the mouse. */
.ov-guide {
  position: absolute;
  z-index: 2;
  background: var(--ov-edit);
  opacity: 0.85;
  pointer-events: none;
}

/*
 * Above every panel and chip, top centre of the display, never in the way of a click (main
 * gives the window the mouse only over panels and chips, and this takes none).
 */
.ov-cursor-hint {
  position: absolute;
  top: 9%;
  left: 50%;
  z-index: 3;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  box-sizing: border-box;
  width: max-content;
  max-width: min(640px, calc(100% - 32px));
  padding: 10px 16px;
  border: 1px solid var(--ov-warn);
  border-radius: var(--ov-radius);
  background: rgba(10, 12, 16, 0.94);
  transform: translateX(-50%);
  font: 400 14px/1.4 var(--ov-font-small);
  color: var(--ov-fg);
  pointer-events: none;
}

.ov-cursor-hint__icon {
  margin-top: 2px;
  font-size: 16px;
  color: var(--ov-warn);
}

.ov-cursor-hint__text strong {
  display: block;
  font-weight: 700;
}
</style>
