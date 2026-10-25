<script setup lang="ts">
import { TYRE_UNKNOWN } from '@renderer/view/carExtras'

/**
 * A tyre compound's letter in a ring at plate height, like the marking on a tyre wall; a dim
 * dash when the compound is unknown. Monochrome on purpose: the letter is the meaning, so the
 * colour-blind palette has nothing to change.
 */
defineProps<{ letter: string }>()
</script>

<template>
  <span class="ov-tyre" :class="{ 'is-unknown': letter === TYRE_UNKNOWN }">{{ letter }}</span>
</template>

<style>
.ov-tyre {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--ov-plate-h);
  height: var(--ov-plate-h);
  border-radius: 50%;
  box-shadow: inset 0 0 0 max(1px, 0.09em) var(--ov-fg-muted);
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-tag);
  font-weight: var(--ov-w-strong);
  line-height: 1;
  color: var(--ov-fg);
}

.ov-tyre.is-unknown {
  box-shadow: none;
  color: var(--ov-fg-dim);
}
</style>
