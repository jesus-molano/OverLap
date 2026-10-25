<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, useTemplateRef } from 'vue'
import type { WidgetId } from '@shared/widgets'
import { useElementSize } from '../../composables/useElementSize'
import { useAutoHeight } from '../../composables/useWidgetSettings'
import { provideSampleHost, provideWidgetId } from '../../composables/widgetContext'
import type { InlineStyle } from '../../view/styles'
import { WIDGET_COMPONENTS } from '../../widgets'
import { sampleBox } from './sampleBox'
import { useSampleHeight, useSampleWidth } from './useSampleWidth'

/**
 * Live sample of a settings page: the real widget component, drawing its own preview content
 * with the current options and appearance, at the widget's window size (scaled down to the
 * page when it is wider). What you see here is what the widget draws over the game.
 * `global`: name format and density follow the appearance (Apariencia page).
 */
const props = withDefaults(defineProps<{ widgetId: WidgetId; global?: boolean }>(), {
  global: false
})

// The page is keyed by the widget: the id never changes for this instance.
const id = props.widgetId
provideWidgetId(id)
/** Content height reported by an auto-height widget (null until it does). */
const contentHeight = shallowRef<number | null>(null)
// Applied on the next frame, like main resizing a widget window: resizing the box from inside
// the widget's own ResizeObserver delivery would make the observers loop within one frame.
let pendingHeight = 0
let frame = 0
provideSampleHost({
  reportHeight: (px) => {
    pendingHeight = px
    if (frame !== 0) return
    frame = requestAnimationFrame(() => {
      frame = 0
      contentHeight.value = pendingHeight
    })
  },
  globalAppearance: props.global
})
onBeforeUnmount(() => {
  if (frame !== 0) cancelAnimationFrame(frame)
  frame = 0
})

const autoHeight = useAutoHeight(id)
const width = useSampleWidth(id)
const windowHeight = useSampleHeight(id)
const area = useTemplateRef<HTMLElement>('area')
const areaSize = useElementSize(area)

const box = computed(() => {
  const h = autoHeight.value ? (contentHeight.value ?? windowHeight.value) : windowHeight.value
  return sampleBox(width.value, h, areaSize.value.w)
})
const outerStyle = computed<InlineStyle>(() => ({
  width: `${box.value.outerWidth}px`,
  height: `${box.value.outerHeight}px`
}))
const windowStyle = computed<InlineStyle>(() => ({
  width: `${box.value.width}px`,
  height: `${box.value.height}px`,
  transform: box.value.scale < 1 ? `scale(${box.value.scale})` : 'none'
}))
const component = WIDGET_COMPONENTS[id]
</script>

<template>
  <div ref="area" class="ws" aria-hidden="true">
    <div class="ws-box" :style="outerStyle">
      <!-- Stands in for the widget's window (its body styles included). -->
      <div class="ws-window" :style="windowStyle">
        <component :is="component" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.ws {
  display: flex;
  justify-content: center;
  width: 100%;
  min-width: 0;
  pointer-events: none;
}

.ws-box {
  position: relative;
  flex: none;
}

.ws-window {
  position: absolute;
  top: 0;
  left: 0;
  overflow: hidden;
  transform-origin: 0 0;
  font-family: var(--ov-font);
  font-size: 16px;
  line-height: normal;
  color: var(--ov-fg);
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
}
</style>
