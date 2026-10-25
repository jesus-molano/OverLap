<script setup lang="ts">
import { computed } from 'vue'
import { statusText } from '@shared/i18n'
import type { ConnectionState } from '@shared/types'
import { useI18n } from '../composables/useI18n'
import { useOverlayState } from '../composables/useOverlay'

const { status } = useOverlayState()
const t = useI18n()
const state = computed<ConnectionState>(() => status.value?.state ?? 'starting')
const label = computed(() => t.value.core.statusChip[state.value])
// The whole status line (e.g. why it failed), shown on hover.
const detail = computed(() => (status.value ? statusText(t.value, status.value) : undefined))
</script>

<template>
  <span class="chip" :class="`chip-${state}`" role="status" :title="detail">
    <span class="dot" aria-hidden="true" />
    {{ label }}
  </span>
</template>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 3px 10px;
  border: 1px solid var(--st-border-hi);
  border-radius: var(--st-radius-sm);
  background: var(--st-surface);
  color: var(--ov-fg);
  font-size: 12px;
  line-height: 1.4;
  white-space: nowrap;
}

/* Grey until there is something to say: the accent means you, never a state. */
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ov-fg-dim);
}

.chip-connected .dot {
  background: var(--st-ok);
}

.chip-mock .dot {
  background: var(--ov-edit);
}

.chip-error {
  border-color: color-mix(in srgb, var(--ov-danger) 50%, transparent);
}

.chip-error .dot {
  background: var(--ov-danger);
}
</style>
