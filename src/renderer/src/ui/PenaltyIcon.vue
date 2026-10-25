<script setup lang="ts">
import type { CarPenalty } from '@shared/types'
import Icon from './Icon.vue'

/**
 * A car's flag badge after its name (standings, relative): the black flag, the meatball, or a
 * warning (iRacing's furled black flag, drawn as the black-and-white warning flag). The shape
 * carries the meaning and the colours are the real flags', so the colour-blind palette changes
 * nothing here.
 */
defineProps<{ penalty: CarPenalty }>()
</script>

<template>
  <Icon v-if="penalty === 'black'" name="flag" class="is-ink" />
  <Icon v-else-if="penalty === 'furled'" name="flag-warning" class="is-ink" />
  <Icon v-else name="meatball" />
</template>

<style scoped>
/* The real black (and white) flags, outlined in ink so they read on the dark glass. */
.is-ink {
  color: var(--ov-flag-black);
  stroke: var(--ov-fg);
  stroke-width: 0.6;
}
</style>
