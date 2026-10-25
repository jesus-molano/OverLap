<script setup lang="ts">
import type { Tone } from './tones'

/** Caps status tag ('PIT', 'OUT', 'ÚLTIMA VUELTA'), optionally with a leading icon slot. */
withDefaults(
  defineProps<{
    tone?: Tone
    /** solid: filled, dark text (default); outline: ring in the tone colour. */
    variant?: 'solid' | 'outline'
  }>(),
  { tone: 'neutral', variant: 'solid' }
)
</script>

<template>
  <span class="ov-badge" :class="[`ov-tone-${tone}`, `ov-badge--${variant}`]"><slot /></span>
</template>

<style>
.ov-badge {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.25em;
  padding: 0 0.35em;
  border-radius: var(--ov-radius-chip);
  font-size: var(--ov-t-tag);
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}

.ov-badge--solid {
  background: var(--ov-tone);
  color: var(--ov-on-solid);
  text-shadow: none;
}

.ov-badge--outline {
  box-shadow: inset 0 0 0 1px var(--ov-tone);
  color: var(--ov-tone);
}
</style>
