<script setup lang="ts">
import { computed } from 'vue'
import { useAppearance } from '../composables/useAppearance'
import { useI18n } from '../composables/useI18n'
import { useOverlayState } from '../composables/useOverlay'

/** 'SIM' while the data comes from the simulated source (and appearance.showSimPill is on). */
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
  flex: none;
  padding: 0 0.5em;
  border-radius: var(--ov-radius-pill);
  box-shadow: inset 0 0 0 1px var(--ov-info);
  color: var(--ov-info);
  font-size: max(var(--ov-min-text), 0.68em);
  font-weight: 700;
  line-height: 1.45;
  letter-spacing: 0.08em;
  white-space: nowrap;
}
</style>
