<script setup lang="ts">
import type { TrafficKind } from '@shared/types'
import Icon from '@renderer/ui/Icon.vue'

/**
 * Kind icon of a traffic line, pointing the way the car moves relative to you: a double chevron
 * up for a faster car coming from behind, a chevron down for a slower car coming back to you;
 * the kit's warning triangle for a hazard. Same box and sizing as ui/Icon.vue (16 x 16 units,
 * 1em, currentColor); the chevrons are local because the kit has none.
 */
defineProps<{ kind: TrafficKind }>()

const CHEVRONS: Readonly<Record<Exclude<TrafficKind, 'hazard'>, string>> = {
  faster: 'M3.5 8.25 8 3.75l4.5 4.5M3.5 12.75 8 8.25l4.5 4.5',
  slower: 'M3.5 5.75 8 10.25l4.5-4.5'
}
</script>

<template>
  <Icon v-if="kind === 'hazard'" name="warning" />
  <svg
    v-else
    class="ov-icon"
    viewBox="0 0 16 16"
    width="1em"
    height="1em"
    focusable="false"
    aria-hidden="true"
  >
    <path class="tr-chevron" :d="CHEVRONS[kind]" />
  </svg>
</template>

<style scoped>
.tr-chevron {
  fill: none;
  stroke: currentColor;
  /* The kit's chevron stroke (the delta trend's too). */
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
