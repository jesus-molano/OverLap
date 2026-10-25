<script setup lang="ts">
import {
  ALERT_BAR_INSET,
  ALERT_BLOOM_PAD,
  ALERT_HALF_H,
  ALERT_WASH_W,
  BG_HALF,
  type SideAlertStyle
} from './geometry'

/**
 * Side alert of the radar (an SVG group): a wash from the outer edge, the bar and its bloom (the
 * bar's glow as a faint wider copy, no blur filter). Drawn for the left side; `mirrored` flips
 * it to the right. Static gradients: only the group opacity and the bar width ever change.
 */
defineProps<{
  alert: SideAlertStyle
  mirrored: boolean
  washUrl: string
  barUrl: string
}>()
</script>

<template>
  <g
    class="radar-alert"
    :transform="mirrored ? 'scale(-1 1)' : undefined"
    :style="{ opacity: alert.opacity }"
  >
    <rect
      :x="-BG_HALF"
      :y="-ALERT_HALF_H"
      :width="ALERT_WASH_W"
      :height="ALERT_HALF_H * 2"
      :fill="washUrl"
    />
    <rect
      class="radar-alert__bloom"
      :x="-BG_HALF + ALERT_BAR_INSET - ALERT_BLOOM_PAD"
      :y="-ALERT_HALF_H"
      :width="alert.barWidth + ALERT_BLOOM_PAD * 2"
      :height="ALERT_HALF_H * 2"
      :rx="alert.barWidth / 2 + ALERT_BLOOM_PAD"
      :fill="barUrl"
    />
    <rect
      :x="-BG_HALF + ALERT_BAR_INSET"
      :y="-ALERT_HALF_H"
      :width="alert.barWidth"
      :height="ALERT_HALF_H * 2"
      :rx="alert.barWidth / 2"
      :fill="barUrl"
    />
  </g>
</template>

<style scoped>
/* Only on alert level changes (the parent's v-memo patches nothing else). */
.radar-alert {
  transition: opacity 150ms ease;
}

.radar-alert__bloom {
  fill-opacity: 0.3;
}
</style>
