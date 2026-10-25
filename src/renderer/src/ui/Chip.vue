<script setup lang="ts">
import type { Tone } from './tones'

/** Value chip: `[label value]` tinted by tone (sector and lap deltas, budgets). */
withDefaults(
  defineProps<{
    /** Muted caption before the value ('S1', 'Últ'). */
    label?: string
    tone?: Tone
    /** soft: tinted (default); solid: filled, dark text; outline: ring. */
    variant?: 'soft' | 'solid' | 'outline'
  }>(),
  { tone: 'neutral', variant: 'soft' }
)
</script>

<template>
  <span class="ov-chip" :class="[`ov-tone-${tone}`, `ov-chip--${variant}`]">
    <span v-if="label" class="ov-chip__label">{{ label }}</span>
    <span class="ov-chip__value"><slot /></span>
  </span>
</template>

<style>
.ov-chip {
  display: inline-flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.3em;
  min-width: 0;
  padding: 0.1em 0.4em;
  border-radius: var(--ov-radius-chip);
  font-size: max(var(--ov-min-text), 0.8em);
  font-weight: 700;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.ov-chip--soft {
  background: color-mix(in srgb, var(--ov-tone) 16%, transparent);
}

.ov-chip--solid {
  background: var(--ov-tone);
  color: var(--ov-on-solid);
  text-shadow: none;
}

.ov-chip--outline {
  box-shadow: inset 0 0 0 1px var(--ov-tone);
}

.ov-chip__label {
  font-weight: 600;
  color: var(--ov-fg-muted);
}

.ov-chip--solid .ov-chip__label {
  color: inherit;
  opacity: 0.7;
}
</style>
