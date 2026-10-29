<script setup lang="ts">
import SimPill from './SimPill.vue'

/**
 * Panel header: a faint band with a rule under it. Caps caption (and SIM tag) on the left,
 * `meta` and the slot on the right. Its left padding puts the title on the rows' content line.
 */
withDefaults(
  defineProps<{
    title: string
    /** Dim text after the title ('CARRERA', 'SoF 2.1k'). */
    meta?: string
    /** Show the SIM tag while the source is simulated. */
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
  /* Room for a plate-high tag (SIM, preview) whether one shows or not: no jump between modes. */
  min-height: calc(var(--ov-plate-h) + 0.7em + 1px);
  padding: 0.35em 0.6em 0.35em calc(var(--ov-bar-w) + 0.35em);
  background: var(--ov-head-grad), var(--ov-bg-head);
  border-bottom: 1px solid var(--ov-rule);
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
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-caption);
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-caps);
  text-transform: uppercase;
  color: var(--ov-fg-muted);
}

/* Real information (session, SoF, car count) on the header band: muted, not dim (dim drops
   under 3:1 on the band over a bright sky). The title steps above it by weight and caps. */
.ov-head__meta {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-caption);
  font-weight: var(--ov-w-text);
  color: var(--ov-fg-muted);
}
</style>
