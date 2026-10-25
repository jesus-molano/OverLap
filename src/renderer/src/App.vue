<script setup lang="ts">
import type { WidgetId } from '@shared/widgets'
import WidgetFrame from './components/WidgetFrame.vue'
import { provideWidgetId } from './composables/widgetContext'
import { WIDGET_COMPONENTS } from './widgets'

const props = defineProps<{ widgetId: WidgetId }>()

// The id never changes for the life of the window: composables below inject it.
provideWidgetId(props.widgetId)
</script>

<template>
  <WidgetFrame :widget-id="widgetId">
    <component :is="WIDGET_COMPONENTS[widgetId]" />
  </WidgetFrame>
</template>
