<script setup lang="ts">
import type { HeadsView } from './heads'

/**
 * The column heads row under the header bars (heads.ts): the car rows' grid, so every caption
 * sits over its column, in the columns' order. Fixed height (layout.ts HEADS_EM), so the height
 * maths never depend on it and contain: strict is safe.
 */
defineProps<{ heads: HeadsView }>()
</script>

<template>
  <div class="sd-heads" aria-hidden="true">
    <span
      v-for="h in heads"
      :key="h.id"
      class="sd-hcell"
      :class="`is-${h.align}`"
      :data-el="h.el"
      >{{ h.label }}</span
    >
  </div>
</template>

<style scoped>
/* The rows' own grid and paddings (StandingsWidget .sd-car), so the tracks line up. */
.sd-heads {
  display: grid;
  flex: none;
  grid-template-columns: var(--sd-cols);
  align-items: center;
  column-gap: 0.4em;
  height: var(--sd-heads-h);
  padding: 0 0.6em 0 calc(var(--ov-bar-w) + 0.35em);
  overflow: hidden;
  white-space: nowrap;
  contain: strict;
}

.sd-hcell {
  min-width: 0;
  overflow: hidden;
  font-family: var(--ov-font-small);
  font-size: max(var(--ov-min-text), 0.6em);
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-tag);
  color: var(--ov-fg-dim);
}

.sd-hcell.is-start {
  text-align: left;
}

.sd-hcell.is-center {
  text-align: center;
}

.sd-hcell.is-end {
  text-align: right;
}
</style>
