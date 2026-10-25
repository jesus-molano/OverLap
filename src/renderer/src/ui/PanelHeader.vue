<script setup lang="ts">
import SimPill from './SimPill.vue'

/** Panel header: caps caption (and SIM pill) on the left, `meta` and the slot on the right. */
withDefaults(
  defineProps<{
    title: string
    /** Muted text after the title ('CARRERA', 'SoF 2.1k · 12 coches'). */
    meta?: string
    /** Show the SIM pill while the source is simulated. */
    sim?: boolean
  }>(),
  { sim: true }
)
</script>

<template>
  <header class="ov-head">
    <span class="ov-head__start">
      <span class="ov-head__title">{{ title }}</span>
      <SimPill v-if="sim" />
      <span v-if="meta" class="ov-head__meta">{{ meta }}</span>
    </span>
    <span v-if="$slots.default" class="ov-head__end"><slot /></span>
  </header>
</template>

<style>
.ov-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6em;
  min-width: 0;
  padding: 0.35em 0.7em;
  border-bottom: 1px solid var(--ov-border);
  line-height: 1.3;
  white-space: nowrap;
}

.ov-head__start,
.ov-head__end {
  display: flex;
  align-items: center;
  gap: 0.5em;
  min-width: 0;
}

.ov-head__end {
  flex: none;
}

.ov-head__title {
  flex: none;
  font-size: var(--ov-t-caption);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ov-fg-muted);
}

.ov-head__meta {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--ov-t-caption);
  color: var(--ov-fg-muted);
}
</style>
