<script setup lang="ts">
import type { LapKind } from '@renderer/view/carExtras'

/**
 * A lap time at plate height (lapCell / bestCell in view/carExtras): the class's fastest on the
 * purple plate filling its cell, the driver's own best in green over a green key, none dim. One
 * look for Posiciones' and Relativo's lap columns.
 */
defineProps<{ text: string; kind: LapKind }>()
</script>

<template>
  <span class="ov-laptime" :class="`is-${kind}`">{{ text }}</span>
</template>

<style>
/* Plate geometry, so a filled or keyed lap is exactly as tall as the row's other plates. */
.ov-laptime {
  display: inline-flex;
  align-items: center;
  height: var(--ov-plate-h);
  padding: 0 0.25em;
  border-radius: var(--ov-radius-chip);
  font-size: max(var(--ov-min-text), 0.85em);
  font-weight: var(--ov-w-text);
  line-height: 1;
}

/*
 * Fastest lap of the class: the purple plate (a racing convention; white reads at 4.8:1), filling
 * the whole cell so it reads at a glance, with a lit top edge like the other solid plates.
 */
.ov-laptime.is-best {
  justify-content: flex-end;
  width: 100%;
  padding: 0 0.3em;
  background: var(--ov-best-fill);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.22);
  color: #ffffff;
  font-weight: var(--ov-w-solid);
  text-shadow: none;
}

/* The driver's own best: green figures over a green key (a ring would mean a warning). */
.ov-laptime.is-pb {
  background: linear-gradient(var(--ov-good), var(--ov-good)) left bottom / 100% var(--ov-key-w)
    no-repeat;
  color: var(--ov-good);
  font-weight: var(--ov-w-strong);
}

.ov-laptime.is-none {
  color: var(--ov-fg-dim);
}
</style>
