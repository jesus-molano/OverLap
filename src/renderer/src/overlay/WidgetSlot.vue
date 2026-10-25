<script setup lang="ts">
import type { WidgetId } from '@shared/widgets'
import { providePanelHost, provideWidgetId } from '../composables/widgetContext'
import { vInlineStyle } from '../directives/inlineStyle'
import { WIDGET_COMPONENTS } from '../widgets'
import { provideSlot } from './contract'
import EditFrame from './EditFrame.vue'
import { injectOverlayRegistry, useSlot, useSlotErrorBoundary } from './slots'

/**
 * One widget's panel in the overlay window: absolutely positioned where main (or an edit
 * interaction) puts it, fitted to the content of an auto-height widget, isolated from the
 * other panels (paint, layout and errors). Not drawn while a rule hides it (edit mode previews
 * it); the widget component is created the first time it is shown and then kept.
 */
const props = defineProps<{ widget: WidgetId }>()

// Keyed by the widget in OverlayApp: the id never changes for this instance.
const id = props.widget
const { handle, host, style, shown, mounted, dragging } = useSlot(injectOverlayRegistry(), id)
provideWidgetId(id)
provideSlot(handle)
providePanelHost(host)
useSlotErrorBoundary(id)
const component = WIDGET_COMPONENTS[id]
</script>

<template>
  <div
    v-inline-style="style"
    class="ov-slot"
    :class="{ 'is-hidden': !shown, 'is-dragging': dragging }"
    :data-ov-slot="id"
  >
    <EditFrame>
      <component :is="component" v-if="mounted" />
    </EditFrame>
  </div>
</template>

<style scoped>
/* Position and size are inline (slotStyle). Strict containment: a 60 Hz widget repaints and
   lays out its own panel only, never the others. No background: the window stays see-through. */
.ov-slot {
  position: absolute;
  contain: strict;
}

/* A rule hides it (outside edit mode): not drawn, not laid out, not hit-tested. */
.ov-slot.is-hidden {
  display: none;
}

/* Only edit mode takes the mouse, and main lets it through only over an unlocked panel. */
.ov-overlay.is-editing .ov-slot {
  pointer-events: auto;
}

/* The panel being dragged stays above the others. */
.ov-slot.is-dragging {
  z-index: 1;
}
</style>
