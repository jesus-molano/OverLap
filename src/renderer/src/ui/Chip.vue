<script setup lang="ts">
import type { Tone } from './tones'

/**
 * Value cell `[label value]` at plate height (sector and lap deltas, budgets). The value takes
 * the tone's colour (neutral = foreground).
 */
withDefaults(
  defineProps<{
    /** Dim caption before the value ('S1', 'Últ'). */
    label?: string
    tone?: Tone
    /**
     * soft: a recessed cell keyed at the bottom in the tone (default); outline: the same cell
     * with a neutral ring (the current one); solid: a filled plate, dark text.
     */
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
  --ov-chip-key: var(--ov-tone);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3em;
  min-width: 0;
  height: var(--ov-plate-h);
  padding: 0 0.45em;
  border-radius: var(--ov-radius-chip);
  font-size: var(--ov-t-plate);
  font-weight: var(--ov-w-strong);
  line-height: 1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* The key is a background layer (not a box-shadow), so the outline's ring can coexist. The
   content is centred above the key (bottom padding = key), not over it: at small sizes the
   figures would otherwise sit on the line like underlined text. A 1 px inner shade along the
   top edge (0 blur) sinks the cell into the glass. */
.ov-chip--soft,
.ov-chip--outline {
  padding-bottom: var(--ov-key-w);
  background:
    linear-gradient(var(--ov-chip-key), var(--ov-chip-key)) left bottom / 100% var(--ov-key-w)
      no-repeat,
    var(--ov-well);
}

.ov-chip--soft {
  box-shadow: inset 0 1px 0 rgba(0, 0, 0, 0.35);
}

/* The ring takes the top pixel: the shade sits under it. */
.ov-chip--outline {
  box-shadow:
    inset 0 0 0 1px var(--ov-fg-muted),
    inset 0 2px 0 rgba(0, 0, 0, 0.35);
}

/* No meaning to key: a quiet neutral line. */
.ov-chip.ov-tone-neutral,
.ov-chip.ov-tone-dim {
  --ov-chip-key: var(--ov-rule);
}

.ov-chip--solid {
  background: var(--ov-tone);
  color: var(--ov-on-solid);
  font-weight: var(--ov-w-solid);
  text-shadow: none;
}

.ov-chip__label {
  font-family: var(--ov-font-small);
  font-size: max(var(--ov-min-text), 0.8em);
  font-weight: var(--ov-w-strong);
  color: var(--ov-fg-dim);
}

.ov-chip--solid .ov-chip__label {
  color: inherit;
  opacity: 0.7;
}
</style>
