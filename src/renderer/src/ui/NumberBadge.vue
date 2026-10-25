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
.ov-num {
  display: inline-block;
  flex: none;
  min-width: 2.1em;
  overflow: hidden;
  padding: 0 0.25em;
  border-radius: var(--ov-radius-chip);
  font-size: max(var(--ov-min-text), 0.82em);
  font-weight: 700;
  line-height: 1.35;
  font-variant-numeric: tabular-nums;
  text-align: center;
  white-space: nowrap;
  text-overflow: clip;
}

.ov-num--filled {
  background: var(--cls);
  color: var(--cls-fg);
  text-shadow: none;
}

.ov-num--outlined {
  background: transparent;
  box-shadow: inset 0 0 0 max(1px, 0.09em) var(--cls);
}

.ov-num--plain {
  min-width: 0;
  padding: 0;
  color: var(--ov-fg-muted);
  text-align: left;
}

.ov-num--lap-ahead {
  color: var(--ov-lap-ahead);
}

.ov-num--lap-behind {
  color: var(--ov-lap-behind);
}
</style>
