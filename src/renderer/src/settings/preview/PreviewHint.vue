<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import { optionSetter } from '../editor'
import { useDraft } from '../useDraft'
import { GHOST_ZONES } from './previewEdit'
import { injectPreviewEdit } from './usePreviewEdit'

/**
 * The line above a widget page's preview that says it is editable ("Arrastra en la vista
 * previa para ordenar; clic para mostrar u ocultar"), on a page with element lists, until you
 * dismiss it (settingsWindow.previewHint, remembered across reopenings).
 */
const t = useI18n()
const edit = injectPreviewEdit()
const windowOptions = useOptions('settingsWindow')
const hint = useDraft<boolean>(
  () => windowOptions.value.previewHint,
  optionSetter('settingsWindow')('previewHint')
)
const shown = computed(() => hint.value.value && edit !== null && edit.zones.value.size > 0)
/** Whether a hidden element of this page can show ghosted; else its way back is its list. */
const ghosted = computed(() =>
  edit === null ? false : [...edit.zones.value.keys()].some((z) => GHOST_ZONES.has(z))
)
</script>

<template>
  <div v-if="shown" class="pe-hint">
    <span class="pe-hint-icon" aria-hidden="true">⠿</span>
    <p class="pe-hint-text">
      <span class="pe-hint-main">{{ t.settings.preview.hint }}</span>
      <span class="pe-hint-more">{{
        ghosted ? t.settings.preview.hintMore : t.settings.preview.hintMoreList
      }}</span>
    </p>
    <button
      type="button"
      class="st-btn st-btn-sm st-btn-ghost pe-hint-close"
      :aria-label="t.settings.preview.hintDismissLabel"
      @click="hint.commit(false)"
    >
      {{ t.settings.preview.hintDismiss }}
    </button>
  </div>
</template>

<style scoped>
.pe-hint {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  padding: 5px 6px 5px 10px;
  border: 1px solid var(--st-border);
  border-radius: var(--st-radius);
  background: var(--st-surface);
}

.pe-hint-icon {
  display: inline-flex;
  flex: none;
  color: var(--ov-fg-muted);
  font-size: 14px;
}

.pe-hint-text {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  gap: 0 8px;
  min-width: 0;
  font-size: 12.5px;
}

.pe-hint-main {
  color: var(--ov-fg);
}

.pe-hint-more {
  color: var(--ov-fg-muted);
}

.pe-hint-close {
  flex: none;
}
</style>
