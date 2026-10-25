<script setup lang="ts">
import { computed } from 'vue'
import { useAppearance } from '../composables/useAppearance'
import { useI18n } from '../composables/useI18n'
import { useOverlayState } from '../composables/useOverlay'

/**
 * 'SIM' tag while the data comes from the simulated source (and appearance.showSimPill is on):
 * a caps tag at plate height ringed in the information blue.
 */
const { status } = useOverlayState()
const appearance = useAppearance()
const t = useI18n()
const shown = computed(() => status.value?.source === 'mock' && appearance.value.showSimPill)
</script>

<template>
  <span v-if="shown" class="ov-sim" :title="t.widgets.common.simTitle">{{
    t.widgets.common.sim
  }}</span>
</template>

<style>
.ov-sim {
  display: inline-flex;
  flex: none;
  align-items: center;
  height: var(--ov-plate-h);
  padding: 0 0.45em;
  border-radius: var(--ov-radius-chip);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ov-info) 70%, transparent);
  color: var(--ov-info);
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-tag);
  font-weight: var(--ov-w-strong);
  line-height: 1;
  letter-spacing: var(--ov-track-tag);
  white-space: nowrap;
}
</style>
