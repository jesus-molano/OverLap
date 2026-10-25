<script setup lang="ts">
/**
 * Static placeholder lines (no shimmer: nothing animates) for a widget that is connected but
 * has no payload yet, with an optional caption. They start on the rows' content line.
 */
withDefaults(defineProps<{ rows?: number; caption?: string }>(), { rows: 3 })
</script>

<template>
  <div class="ov-empty" aria-hidden="true">
    <span v-for="i in rows" :key="i" class="ov-empty__line" />
    <span v-if="caption" class="ov-empty__caption">{{ caption }}</span>
  </div>
</template>

<style>
.ov-empty {
  display: flex;
  flex-direction: column;
  gap: 0.45em;
  padding: 0.6em 0.6em 0.6em calc(var(--ov-bar-w) + 0.35em);
}

.ov-empty__line {
  height: 0.5em;
  border-radius: var(--ov-radius-chip);
  background: var(--ov-chip-faint);
}

/* Varied lengths, so it reads as rows rather than a block. */
.ov-empty__line:nth-child(4n + 1) {
  width: 78%;
}
.ov-empty__line:nth-child(4n + 2) {
  width: 62%;
}
.ov-empty__line:nth-child(4n + 3) {
  width: 70%;
}
.ov-empty__line:nth-child(4n) {
  width: 54%;
}

.ov-empty__caption {
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-caption);
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-caps);
  text-transform: uppercase;
  color: var(--ov-fg-muted);
}
</style>
