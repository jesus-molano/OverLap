<script setup lang="ts">
import { useI18n } from '../../composables/useI18n'
import { sendCommand } from '../editor'

/**
 * Foot of the window, at the end of each page's options: how changes are kept and, in narrow
 * windows (no sidebar), the settings folder.
 */
const t = useI18n()

function openSettingsFolder(): void {
  sendCommand({ type: 'open-settings-folder' })
}
</script>

<template>
  <footer class="foot">
    <p class="foot-note">{{ t.settings.app.footNote }}</p>
    <button
      type="button"
      class="st-btn st-btn-ghost st-btn-sm narrow-only"
      @click="openSettingsFolder"
    >
      {{ t.settings.app.openFolder }}
    </button>
  </footer>
</template>

<style scoped>
.foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin-top: 20px;
}

.foot-note {
  color: var(--ov-fg-dim);
  font-size: 12px;
}

/* Two classes: above the specificity of .st-btn's display. */
.foot .narrow-only {
  display: none;
}

@media (max-width: 639px) {
  .foot .narrow-only {
    display: inline-flex;
  }
}
</style>
