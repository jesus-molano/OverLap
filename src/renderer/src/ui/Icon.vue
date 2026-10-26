<script setup lang="ts">
import { computed } from 'vue'
import { iconShapes, type AnyIconName } from './engineIcons'
import type { IconShape } from './icons'

const props = defineProps<{
  /** An icon of icons.ts or of engineIcons.ts (the warning lights). */
  name: AnyIconName
  /** Accessible label; without it the icon is decorative (aria-hidden). */
  label?: string
}>()

const shapes = computed<readonly IconShape[]>(() => iconShapes(props.name))
</script>

<template>
  <svg
    class="ov-icon"
    viewBox="0 0 16 16"
    width="1em"
    height="1em"
    focusable="false"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
  >
    <path
      v-for="(s, i) in shapes"
      :key="i"
      :d="s.d"
      :class="[
        s.kind === 'stroke' ? 'ov-icon__stroke' : 'ov-icon__fill',
        s.tint ? `ov-icon__${s.tint}` : ''
      ]"
      :fill-rule="s.evenodd ? 'evenodd' : undefined"
    />
  </svg>
</template>

<style>
.ov-icon {
  display: inline-block;
  flex: none;
  width: 1em;
  height: 1em;
  vertical-align: -0.125em;
  overflow: visible;
}

.ov-icon__fill {
  fill: currentColor;
}

.ov-icon__stroke {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Fixed tints are real flag colours: the same in every mode, colour-blind included. */
.ov-icon__orange {
  fill: var(--ov-flag-orange);
}

.ov-icon__ink {
  fill: var(--ov-flag-black);
}

.ov-icon__white {
  fill: var(--ov-flag-white);
}
</style>
