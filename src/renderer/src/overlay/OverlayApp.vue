<script setup lang="ts">
import { useI18n } from '../composables/useI18n'
import { useOverlayState } from '../composables/useOverlay'
import Icon from '../ui/Icon.vue'
import { createSlotRegistry, provideOverlayRegistry } from './slots'
import { useEditSession } from './useEditSession'
import WidgetSlot from './WidgetSlot.vue'

/**
 * Root of an overlay window (`?view=overlay`, one per display): every enabled widget main
 * places on this display (in edit mode the disabled ones too, as ghosts), each as an absolutely
 * positioned panel of this one document, in PAINT_ORDER (later ones on top, the radar above
 * all, as main hit-tests them). Nothing until the first layout. In edit mode, while the game
 * hides the mouse cursor (you are in the car), a note says how to get it back.
 */
const { editMode, cursorHidden } = useOverlayState()
const t = useI18n()
const registry = createSlotRegistry()
provideOverlayRegistry(registry)
useEditSession(registry)
const widgets = registry.widgets
</script>

<template>
  <div class="ov-overlay" :class="{ 'is-editing': editMode }">
    <WidgetSlot v-for="id in widgets" :key="id" :widget="id" />
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
 * Above every panel, top centre of the display, never in the way of a click (main gives the
 * window the mouse only over panels and chips, and this takes none).
 */
.ov-cursor-hint {
  position: absolute;
  top: 9%;
  left: 50%;
  z-index: 2;
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
