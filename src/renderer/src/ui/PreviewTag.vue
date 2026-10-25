<script setup lang="ts">
import { useI18n } from '../composables/useI18n'
import { injectSampleHost } from '../composables/widgetContext'

/**
 * Marks sample content in edit mode ('VISTA PREVIA'): a caps tag at plate height ringed in the
 * edit blue. Not drawn in the settings window's live samples, whose stage already says it shows
 * sample data.
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
  display: inline-flex;
  flex: none;
  align-items: center;
  height: var(--ov-plate-h);
  padding: 0 0.45em;
  border-radius: var(--ov-radius-chip);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ov-edit) 70%, transparent);
  color: var(--ov-edit);
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-tag);
  font-weight: var(--ov-w-strong);
  line-height: 1;
  letter-spacing: var(--ov-track-tag);
  text-transform: uppercase;
  white-space: nowrap;
  text-shadow: none;
}
</style>
