<script setup lang="ts">
import { useOverlayState } from '../composables/useOverlay'
import { createSlotRegistry, provideOverlayRegistry } from './slots'
import { useEditSession } from './useEditSession'
import WidgetSlot from './WidgetSlot.vue'

/**
 * Root of an overlay window (`?view=overlay`, one per display): every enabled widget main
 * places on this display, each as an absolutely positioned panel of this one document, in
 * WIDGET_IDS order (later ones on top, as main hit-tests them). Nothing until the first layout.
 */
const { editMode } = useOverlayState()
const registry = createSlotRegistry()
provideOverlayRegistry(registry)
useEditSession(registry)
const widgets = registry.widgets
</script>

<template>
  <div class="ov-overlay" :class="{ 'is-editing': editMode }">
    <WidgetSlot v-for="id in widgets" :key="id" :widget="id" />
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
</style>
