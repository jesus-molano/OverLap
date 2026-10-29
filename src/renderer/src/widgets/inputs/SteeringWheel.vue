<script setup lang="ts">
/**
 * One of the pedals' steering wheels, drawn straight ahead (wheel.ts). Static: its parent turns
 * the box it sits in, so the drawing only changes with the style.
 */
import { FORMULA, MINIMAL, REALISTIC, WHEEL_VIEWBOX, type WheelStyle } from './wheel'

defineProps<{ wheel: WheelStyle }>()
</script>

<template>
  <svg class="sw" :viewBox="WHEEL_VIEWBOX" aria-hidden="true">
    <g v-if="wheel === 'minimal'">
      <circle class="sw__line" :r="MINIMAL.ringR" :stroke-width="MINIMAL.ringW" />
      <path class="sw__mark-line" :d="MINIMAL.mark" :stroke-width="MINIMAL.markW" />
    </g>
    <g v-else-if="wheel === 'realistic'">
      <path class="sw__fill" :d="REALISTIC.spokes" />
      <circle class="sw__line" :r="REALISTIC.rimR" :stroke-width="REALISTIC.rimW" />
      <path class="sw__grip" :d="REALISTIC.grips" :stroke-width="REALISTIC.gripW" />
      <circle class="sw__fill" :r="REALISTIC.hubR" />
      <circle class="sw__pad" :r="REALISTIC.padR" />
      <path class="sw__mark-line" :d="REALISTIC.mark" :stroke-width="REALISTIC.markW" />
    </g>
    <g v-else>
      <path class="sw__body" :d="FORMULA.body" />
      <rect
        v-for="(g, i) in FORMULA.grips"
        :key="i"
        class="sw__grip-fill"
        :x="g.x"
        :y="g.y"
        :width="g.w"
        :height="g.h"
        :rx="g.r"
      />
      <path class="sw__grip" :d="FORMULA.topEdge" :stroke-width="FORMULA.topEdgeW" />
      <rect
        class="sw__pad"
        :x="FORMULA.screen.x"
        :y="FORMULA.screen.y"
        :width="FORMULA.screen.w"
        :height="FORMULA.screen.h"
        :rx="FORMULA.screen.r"
      />
      <circle
        v-for="(b, i) in FORMULA.buttons"
        :key="i"
        class="sw__button"
        :cx="b[0]"
        :cy="b[1]"
        :r="b[2]"
      />
      <rect
        class="sw__mark"
        :x="FORMULA.mark.x"
        :y="FORMULA.mark.y"
        :width="FORMULA.mark.w"
        :height="FORMULA.mark.h"
        :rx="FORMULA.mark.r"
      />
    </g>
  </svg>
</template>

<style scoped>
/* Light on the dark glass, the accent only at 12 o'clock (--wheel-accent, set by the widget). */
.sw {
  display: block;
  width: 100%;
  height: 100%;
}

.sw__line,
.sw__grip,
.sw__mark-line {
  fill: none;
  stroke-linecap: butt;
}

.sw__line {
  stroke: color-mix(in srgb, var(--ov-fg) 72%, transparent);
}

/* The hands' part of the rim: a shade brighter. */
.sw__grip {
  stroke: color-mix(in srgb, var(--ov-fg) 86%, transparent);
}

.sw__fill {
  fill: color-mix(in srgb, var(--ov-fg) 58%, transparent);
}

/* The yoke's rubber: lighter than the body, inside its outline. */
.sw__grip-fill {
  fill: color-mix(in srgb, var(--ov-fg) 52%, var(--ov-bg));
}

/* The yoke: a dark carbon body outlined, so it reads on the dark glass. */
.sw__body {
  fill: color-mix(in srgb, var(--ov-fg) 26%, var(--ov-bg));
  stroke: color-mix(in srgb, var(--ov-fg) 72%, transparent);
  stroke-width: 0.6;
}

/* The horn pad and the yoke's display: recessed, like the gauges' wells. */
.sw__pad {
  fill: var(--ov-bg);
}

.sw__button {
  fill: color-mix(in srgb, var(--ov-fg) 82%, transparent);
}

.sw__mark-line {
  stroke: var(--wheel-accent);
}

.sw__mark {
  fill: var(--wheel-accent);
}
</style>
