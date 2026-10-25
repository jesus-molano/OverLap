<script setup lang="ts">
import { computed } from 'vue'
import { ICONS, type IconName, type IconShape } from './icons'

const props = defineProps<{
  name: IconName
  /** Accessible label; without it the icon is decorative (aria-hidden). */
  label?: string
}>()

const shapes = computed<readonly IconShape[]>(() => ICONS[props.name])
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

.ov-icon__warn {
  fill: var(--ov-warn);
}

.ov-icon__ink {
  fill: #0b0c0e;
}
</style>
