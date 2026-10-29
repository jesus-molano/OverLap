<script setup lang="ts">
import { injectCustomizeHost } from './customize'

/**
 * A widget page's reference section (the warning lights' legend, the delta's saved records):
 * what to read, not to set. On a widget page it moves after "Personalizar" (WidgetPage's own
 * place for it), so the editors stay right after the options; anywhere else it stays in place.
 */
const host = injectCustomizeHost()
</script>

<template>
  <!-- Deferred: the host's element is the page's, mounted after its options. -->
  <Teleport defer :to="host ? `#${host.appendixId}` : 'body'" :disabled="host === null">
    <slot />
  </Teleport>
</template>
