<script setup lang="ts">
import { useI18n } from '../composables/useI18n'
import { injectSampleHost } from '../composables/widgetContext'

/**
 * Marks sample content in edit mode ('VISTA PREVIA'). Not drawn in the settings window's live
 * samples, whose stage already says it shows sample data.
 */
defineProps<{ text?: string }>()

const t = useI18n()
const inSample = injectSampleHost() !== null
</script>

<template>
  <span v-if="!inSample" class="ov-preview-tag">{{ text ?? t.widgets.common.preview }}</span>
</template>

<style>
.ov-preview-tag {
  flex: none;
  padding: 0 0.5em;
  border-radius: var(--ov-radius-pill);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ov-edit) 70%, transparent);
  color: var(--ov-edit);
  font-size: max(var(--ov-min-text), 0.65em);
  font-weight: 700;
  line-height: 1.45;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  text-shadow: none;
}
</style>
