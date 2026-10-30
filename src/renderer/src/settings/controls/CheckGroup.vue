<script setup lang="ts">
import { useId } from 'vue'
import PreviewNote from './PreviewNote.vue'
import type { PreviewNoteSpec } from './previewNote'

/** A titled group of checkboxes (ToggleControl kind="checkbox") laid out in a wrapping row. */
withDefaults(
  defineProps<{
    legend: string
    help?: string
    /** Disables every control inside (native fieldset behaviour). */
    disabled?: boolean
    /** Help shown in the warning colour. */
    warn?: boolean
    /** Why the preview does not show it (PreviewNote: no room, or the session only). */
    note?: PreviewNoteSpec
  }>(),
  { help: undefined, disabled: false, warn: false, note: undefined }
)

const helpId = `${useId()}-help`
</script>

<template>
  <fieldset class="st-fieldset" :disabled="disabled" :aria-describedby="help ? helpId : undefined">
    <legend class="st-label">{{ legend }}</legend>
    <div class="st-checks">
      <slot />
    </div>
    <p v-if="help" :id="helpId" class="st-help help" :class="{ 'st-help-warn': warn }">
      {{ help }}
    </p>
    <PreviewNote :note="note" class="note" />
  </fieldset>
</template>

<style scoped>
.help,
.note {
  margin-top: 8px;
}

.help + .note {
  margin-top: 2px;
}
</style>
