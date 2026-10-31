<script setup lang="ts">
import { computed } from 'vue'
import { isElementVisible } from '@shared/elements'
import { OPTION_SCHEMA, clampOption } from '@shared/settingsSchema'
import { spotterSideEqual } from '@shared/spotter'
import type { SpotterSide } from '@shared/types'
import { useShownContent, useWidgetPhase } from '@renderer/composables/useWidgetPhase'
import { useOption } from '@renderer/composables/useWidgetSettings'
import { useWidgetSurface } from '@renderer/composables/useWidgetSurface'
import { vInlineStyle } from '@renderer/directives/inlineStyle'
import { previewSpotter } from './preview'
import SpotterPillar from './SpotterPillar.vue'

/** No payload for this long hides the spotter, though the status may still say connected. */
const STALE_MS = 300

const onlyAlongside = useOption('spotter', 'onlyAlongside')
const barWidth = useOption('spotter', 'barWidth')
const barStyle = useOption('spotter', 'barStyle')
const parts = useOption('spotter', 'parts')
const showNear = computed(() => isElementVisible(parts.value, 'nearCap'))
const showTwo = computed(() => isElementVisible(parts.value, 'twoMark'))

const { surfaceStyle, halo } = useWidgetSurface()
// While you drive the pillars show with a car alongside (or about to be), or always without
// «Solo con un coche al lado»; out of the car, never.
const { data, phase } = useWidgetPhase('spotter', {
  showsOffline: false,
  hasContent: (d) => d.active && (d.visible || !onlyAlongside.value),
  staleMs: STALE_MS
})
const shown = computed(() => phase.value === 'live' || phase.value === 'preview')
/** Live data, the sample in edit mode, or the last frame (kept through the fade-out). */
const content = useShownContent(
  () => phase.value,
  () => data.value,
  () => previewSpotter(barStyle.value)
)

const EMPTY: SpotterSide = {
  count: 0,
  segs: [],
  cover: 0,
  unknown: false,
  nearFront: 0,
  nearRear: 0,
  close: 0
}
// Each pillar keeps its previous side while what it draws is the same: a pass on one side
// re-renders only that pillar.
const left = computed<SpotterSide>((prev) => {
  const s = content.value?.left ?? EMPTY
  return prev !== undefined && spotterSideEqual(prev, s) ? prev : s
})
const right = computed<SpotterSide>((prev) => {
  const s = content.value?.right ?? EMPTY
  return prev !== undefined && spotterSideEqual(prev, s) ? prev : s
})

const style = computed(() => ({
  ...surfaceStyle.value,
  '--sp-w': `${clampOption(OPTION_SCHEMA.spotter.barWidth, barWidth.value)}px`
}))
</script>

<template>
  <div
    v-inline-style="style"
    class="spotter ov-root ov-fade ov-surface"
    :class="{ 'is-shown': shown, 'ov-halo': halo }"
  >
    <SpotterPillar
      v-memo="[left, barStyle, showNear, showTwo]"
      :side="left"
      :bar-style="barStyle"
      at="left"
      :show-near="showNear"
      :show-two="showTwo"
    />
    <SpotterPillar
      v-memo="[right, barStyle, showNear, showTwo]"
      :side="right"
      :bar-style="barStyle"
      at="right"
      :show-near="showNear"
      :show-two="showTwo"
    />
  </div>
</template>

<style scoped>
/* Its own compositor layer: the 60 Hz fills repaint this panel only. No glass between the
   pillars: the window's width is only the gap between them, over the game. */
.spotter {
  will-change: transform;
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  width: 100%;
  height: 100%;
  background: transparent;
}
</style>
