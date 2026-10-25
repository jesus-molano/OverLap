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
    /** Lapping you / lapped: outlined, in the lap colour. */
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

/* '#23' beside a class stripe. */
.ov-num--plain {
  justify-content: flex-start;
  min-width: 0;
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
</style>
