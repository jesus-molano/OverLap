<script setup lang="ts">
import type { Tone } from './tones'

/** Caps status tag ('PIT', 'OUT', 'ÚLTIMA VUELTA'), optionally with a leading icon slot. */
withDefaults(
  defineProps<{
    tone?: Tone
    /**
     * solid: a filled plate, dark text (default; act now); outline: a plate ringed in the tone;
     * text: caps text in the tone, no box (a relation, not an alarm).
     */
    variant?: 'solid' | 'outline' | 'text'
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
  height: var(--ov-plate-h);
  padding: 0 0.4em;
  border-radius: var(--ov-radius-chip);
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-tag);
  line-height: 1;
  letter-spacing: var(--ov-track-tag);
  text-transform: uppercase;
  white-space: nowrap;
}

.ov-badge--solid {
  background: var(--ov-tone);
  color: var(--ov-on-solid);
  font-weight: var(--ov-w-solid);
  text-shadow: none;
}

.ov-badge--outline {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ov-tone) 70%, transparent);
  color: var(--ov-tone);
  font-weight: var(--ov-w-strong);
}

.ov-badge--text {
  height: auto;
  padding: 0;
  color: var(--ov-tone);
  font-weight: var(--ov-w-strong);
}
</style>
