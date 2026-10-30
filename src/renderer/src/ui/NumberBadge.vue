<script setup lang="ts">
import { computed } from 'vue'
import { vInlineStyle } from '../directives/inlineStyle'
import type { InlineStyle } from '../view/styles'

const props = withDefaults(
  defineProps<{
    /** As painted on the car ('23'); the plain variant adds the '#'. */
    number: string
    /**
     * filled: class colour chip (default); outlined: class colour ring; plain: '#23' text,
     * next to a class stripe.
     */
    variant?: 'filled' | 'outlined' | 'plain'
    /**
     * Lapping you / lapped: outlined, in the lap colour, with a corner notch that points up (a lap
     * ahead of you) or down (a lap behind): the same cue without the colour (R36).
     */
    lap?: 'ahead' | 'behind' | null
    /** `--cls` / `--cls-fg`; inherited from the row when omitted. */
    clsStyle?: InlineStyle
  }>(),
  { variant: 'filled', lap: null }
)

const shape = computed(() =>
  props.lap !== null && props.variant === 'filled' ? 'outlined' : props.variant
)
</script>

<template>
  <span
    v-inline-style="clsStyle"
    class="ov-num"
    :class="[`ov-num--${shape}`, lap ? `ov-num--lap-${lap}` : '']"
    >{{ shape === 'plain' ? `#${number}` : number }}</span
  >
</template>

<style>
/* A plate: the widget's one plate height, digits centred (clipped evenly when too long). */
.ov-num {
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: safe center;
  min-width: 2.1em;
  height: var(--ov-plate-h);
  overflow: hidden;
  padding: 0 0.25em;
  border-radius: var(--ov-radius-chip);
  font-size: var(--ov-t-plate);
  font-weight: var(--ov-w-solid);
  line-height: 1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  text-overflow: clip;
}

/* The class colour, with a 0-blur lip at the bottom edge so it reads as a raised plate. */
.ov-num--filled {
  background: var(--cls);
  color: var(--cls-fg);
  text-shadow: none;
  box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.22);
}

.ov-num--outlined {
  background: transparent;
  box-shadow: inset 0 0 0 max(1px, 0.09em) var(--cls);
  font-weight: var(--ov-w-strong);
}

/*
 * '#23' beside a class stripe. Always as wide as '#' and three digits (tabular), so the make, the
 * flag and the name after it line up down a column whatever the number.
 */
.ov-num--plain {
  justify-content: flex-start;
  min-width: 4ch;
  padding: 0;
  color: var(--ov-fg-muted);
  font-weight: var(--ov-w-name);
}

.ov-num--lap-ahead {
  color: var(--ov-lap-ahead);
}

.ov-num--lap-behind {
  color: var(--ov-lap-behind);
}

/*
 * The lap relation by shape as well as by colour (R36; red and blue are 1.1:1 apart in
 * lightness): a small solid notch in the plate's right corner, at the top for a car a lap ahead,
 * at the bottom for one a lap behind, like an arrow up or down. Drawn inside the plate (it adds
 * no width or height) in the lap colour, so it follows the colour-blind palette too.
 */
.ov-num--lap-ahead::after,
.ov-num--lap-behind::after {
  content: '';
  position: absolute;
  right: 0;
  width: 0.55em;
  height: 0.55em;
  background: currentcolor;
  pointer-events: none;
}

.ov-num--lap-ahead::after {
  top: 0;
  clip-path: polygon(0 0, 100% 0, 100% 100%);
}

.ov-num--lap-behind::after {
  bottom: 0;
  clip-path: polygon(100% 0, 100% 100%, 0 100%);
}
</style>
