<script setup lang="ts">
import { useI18n } from '../../composables/useI18n'

/**
 * Foot of the window, at the end of each page's options: how changes are kept. The settings
 * folder is on «Acerca de y ayuda» and in the tray (R40).
 */
const t = useI18n()
</script>

<template>
  <footer class="foot">
    <p class="foot-note">{{ t.settings.app.footNote }}</p>
  </footer>
</template>

<style scoped>
.foot {
  margin-top: 24px;
}

.foot-note {
  color: var(--ov-fg-dim);
  font-size: var(--st-t-help);
}
</style>
