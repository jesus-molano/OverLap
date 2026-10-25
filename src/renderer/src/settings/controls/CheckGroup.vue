<script setup lang="ts">
import { useId } from 'vue'

/** A titled group of checkboxes (ToggleControl kind="checkbox") laid out in a wrapping row. */
withDefaults(
  defineProps<{
    legend: string
    help?: string
    /** Disables every control inside (native fieldset behaviour). */
    disabled?: boolean
    /** Help shown in the warning colour. */
    warn?: boolean
  }>(),
  { help: undefined, disabled: false, warn: false }
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
  </fieldset>
</template>

<style scoped>
.help {
  margin-top: 8px;
}
</style>
